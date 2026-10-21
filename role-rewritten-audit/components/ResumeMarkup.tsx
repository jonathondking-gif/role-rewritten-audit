"use client";

import { useEffect, useState } from "react";
import { loadResumeFile } from "@/lib/resumeFile";
import { buildStream, locateQuote, type TextPiece } from "@/lib/highlight";
import { setMarkedPages } from "@/lib/markedPages";

interface Finding {
  severity: "critical" | "warning";
  quote: string;
}

interface Box {
  n: number; // finding number, 1-based
  severity: "critical" | "warning";
  left: number; // percentages of the page
  top: number;
  width: number;
  height: number;
  badge: boolean;
  midLine: boolean; // text sits just left of the mark, so the badge goes in the right margin
  bx?: number; // badge center, percent of page width
  by?: number; // badge center, percent of page height
}

/**
 * Give every badge a spot that does not overlap another badge. Badges sit
 * just left of their mark, or in the right margin when the mark starts
 * mid-line. Crowded badges step further left.
 */
function placeBadges(boxes: Box[]) {
  const placed: { x: number; y: number }[] = [];
  const DX = 2.8; // percent of width between badge centers
  const DY = 2.0; // percent of height between badge centers
  const free = (x: number, y: number) => !placed.some((p) => Math.abs(p.y - y) < DY && Math.abs(p.x - x) < DX);
  boxes
    .filter((b) => b.badge)
    .sort((a, b) => a.top - b.top)
    .forEach((b) => {
      const y = b.top + b.height / 2;
      const home = b.midLine ? 95.5 : b.left - 1.9;
      // Try the usual spot, then two steps left, then the right margin.
      const tries = b.midLine
        ? [home, home - DX, home - 2 * DX, home - 3 * DX]
        : [home, home - DX, home - 2 * DX, 95.5, 95.5 - DX, 95.5 - 2 * DX];
      const x = tries.find((t) => free(t, y)) ?? tries[tries.length - 1];
      placed.push({ x, y });
      b.bx = x;
      b.by = y;
    });
}

interface Page {
  src: string;
  ratio: number; // height / width
  boxes: Box[];
  flat: string; // JPEG with marks drawn on, for the email
}

type Status = "loading" | "ready" | "nofile" | "docx" | "error";

interface PdfItem extends TextPiece {
  transform: number[];
  width: number;
}

/** Draw the marks and numbered badges onto a copy of the page, for email. */
function flatten(canvas: HTMLCanvasElement, boxes: Box[]): string {
  const out = document.createElement("canvas");
  const scale = Math.min(1, 1100 / canvas.width);
  out.width = Math.round(canvas.width * scale);
  out.height = Math.round(canvas.height * scale);
  const ctx = out.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  const W = out.width, H = out.height;
  for (const b of boxes) {
    const x = (b.left / 100) * W, y = (b.top / 100) * H, w = (b.width / 100) * W, h = (b.height / 100) * H;
    const crit = b.severity === "critical";
    ctx.fillStyle = crit ? "rgba(217,59,48,.16)" : "rgba(255,214,64,.38)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = crit ? "#D93B30" : "#E8A317";
    ctx.fillRect(x, y + h - 3, w, 3);
  }
  for (const b of boxes) {
    if (!b.badge) continue;
    const y = ((b.by ?? b.top) / 100) * H;
    const x = ((b.bx ?? b.left) / 100) * W;
    const label = String(b.n);
    ctx.font = "800 19px Arial, sans-serif";
    const r = Math.max(15, ctx.measureText(label).width / 2 + 7);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = b.severity === "critical" ? "#D93B30" : "#B97F0A";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y + 0.5);
  }
  return out.toDataURL("image/jpeg", 0.82);
}

async function renderPdf(bytes: ArrayBuffer, findings: Finding[]): Promise<Page[]> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes.slice(0)));
  const pages: Page[] = [];
  const placed = new Set<number>();

  for (let p = 1; p <= Math.min(pdf.numPages, 4); p++) {
    const page = await pdf.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const sharp = page.getViewport({ scale: 2 });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(sharp.width);
    canvas.height = Math.floor(sharp.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx, viewport: sharp, canvas } as any).promise;

    const content = await page.getTextContent();
    const items = (content.items as unknown[]).filter(
      (it): it is PdfItem => typeof (it as PdfItem).str === "string" && Array.isArray((it as PdfItem).transform)
    );
    const stream = buildStream(items);
    const boxes: Box[] = [];

    findings.forEach((f, i) => {
      if (placed.has(i)) return;
      const ranges = locateQuote(stream, items, f.quote);
      if (!ranges) return;
      placed.add(i);
      // A quote can pick up stray words from elsewhere on the page when the
      // PDF's text order differs from its layout (for example a name merged
      // into an address). Keep the biggest cluster of pieces that sit close
      // together and drop the strays.
      const sorted = ranges.sort((a, b) => a.piece - b.piece);
      const pos = sorted.map((r) => {
        const it = items[r.piece];
        const [x, y] = base.convertToViewportPoint(it.transform[4], it.transform[5]);
        const h = Math.hypot(it.transform[2], it.transform[3]) || 10;
        return { y, h, x0: x + r.from * it.width, x1: x + r.to * it.width, chars: Array.from(it.str).length * (r.to - r.from) };
      });
      const clusters: number[][] = [];
      sorted.forEach((_, idx) => {
        const last = clusters[clusters.length - 1];
        if (last) {
          const prev = pos[last[last.length - 1]];
          const cur = pos[idx];
          const h = Math.min(prev.h, cur.h);
          const sameLine = Math.abs(cur.y - prev.y) <= h * 0.6 && Math.abs(prev.h - cur.h) <= h * 0.5;
          const nextLine = cur.y > prev.y && cur.y - prev.y <= h * 2.6;
          // same line and close together, or wrapped onto the next line down
          const together = sameLine ? cur.x0 - prev.x1 <= h * 3 : nextLine && cur.x0 <= prev.x1 + h;
          if (together) {
            last.push(idx);
            return;
          }
        }
        clusters.push([idx]);
      });
      const weight = (c: number[]) => c.reduce((sum, idx) => sum + pos[idx].chars, 0);
      const keep = clusters.reduce((best, c) => (weight(c) > weight(best) ? c : best), clusters[0]);
      keep
        .map((idx) => sorted[idx])
        .forEach((r, k) => {
          const it = items[r.piece];
          const [, , c, d, e, fy] = it.transform;
          const [x, y] = base.convertToViewportPoint(e, fy);
          const fontH = Math.hypot(c, d) || 10;
          const left = x + r.from * it.width;
          const width = Math.max(4, (r.to - r.from) * it.width);
          const top = y - fontH * 0.92;
          const height = fontH * 1.22;
          const midLine =
            k === 0 &&
            (r.from > 0.02 ||
              items.some((o) => {
                if (o === it || !o.str.trim()) return false;
                const [ox, oy] = base.convertToViewportPoint(o.transform[4], o.transform[5]);
                return Math.abs(oy - y) <= fontH * 0.6 && ox < left && ox + o.width > left - fontH * 3;
              }));
          boxes.push({
            n: i + 1,
            severity: f.severity,
            left: (left / base.width) * 100,
            top: (top / base.height) * 100,
            width: (width / base.width) * 100,
            height: (height / base.height) * 100,
            badge: k === 0,
            midLine,
          });
        });
    });

    placeBadges(boxes);
    pages.push({ src: canvas.toDataURL("image/png"), ratio: base.height / base.width, boxes, flat: flatten(canvas, boxes) });
  }
  return pages;
}

export default function ResumeMarkup({
  auditId,
  findings,
  annotatedHtml,
  locked,
  kind = "resume",
}: {
  auditId: string;
  findings: Finding[];
  annotatedHtml: string;
  locked: boolean;
  kind?: "resume" | "linkedin";
}) {
  const li = kind === "linkedin";
  const thing = li ? "profile" : "resume";
  const [tab, setTab] = useState<"resume" | "ats">("resume");
  const [status, setStatus] = useState<Status>("loading");
  const [pages, setPages] = useState<Page[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const file = await loadResumeFile(auditId);
      if (cancelled) return;
      if (!file) {
        setStatus("nofile");
        setTab("ats");
        return;
      }
      if (!/\.pdf$/i.test(file.name)) {
        setStatus("docx");
        setTab("ats");
        return;
      }
      try {
        const rendered = await renderPdf(file.bytes, findings);
        if (cancelled) return;
        setPages(rendered);
        setMarkedPages(auditId, rendered.map((p) => p.flat).filter(Boolean).slice(0, 3));
        setStatus("ready");
      } catch (e) {
        console.error("[markup] render failed", e);
        if (!cancelled) {
          setStatus("error");
          setTab("ats");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auditId, findings]);

  const marked = new Set(pages.flatMap((p) => p.boxes.map((b) => b.n))).size;
  const canShowResume = status === "ready" || status === "loading";

  function jump(n: number) {
    if (locked) return;
    document.getElementById(`finding-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="rounded-2xl border border-[#E0E7F1] bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {canShowResume && (
          <button
            role="tab"
            aria-selected={tab === "resume"}
            onClick={() => setTab("resume")}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              tab === "resume" ? "bg-[#0D2A4C] text-white" : "bg-[#EAF3FF] text-[#0D2A4C]"
            }`}
          >
            Your {thing}, marked up
          </button>
        )}
        <button
          role="tab"
          aria-selected={tab === "ats"}
          onClick={() => setTab("ats")}
          className={`rounded-full px-4 py-2 text-sm font-bold ${
            tab === "ats" ? "bg-[#0D2A4C] text-white" : "bg-[#EAF3FF] text-[#0D2A4C]"
          }`}
        >
          {li ? "Profile text" : <>How a company&apos;s ATS reads it</>}
        </button>
      </div>

      <p className="mb-4 text-sm text-[#526379]">
        <span className="mr-3 inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#D93B30]" /> critical
        </span>
        <span className="mr-3 inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#FFE27A]" /> warning
        </span>
        {tab === "ats" && li
          ? "This is the text from your LinkedIn PDF, with the same marks."
          : tab === "ats"
          ? "Most companies run resumes through an Applicant Tracking System (ATS). This is the text it pulls from your file. Anything scrambled or missing here is scrambled or missing for the recruiter searching for you."
          : locked
          ? "Numbered by damage. #1 costs you the most."
          : "Tap a number to jump to its note."}
      </p>

      {status === "docx" && tab === "ats" && (
        <p className="mb-4 rounded-lg bg-[#EAF3FF] px-4 py-3 text-sm text-[#0D2A4C]">
          Upload a PDF to see your resume exactly as you designed it, with every mark on the page.
        </p>
      )}

      {tab === "resume" ? (
        status === "loading" ? (
          <div className="flex h-64 items-center justify-center text-[#526379]">
            <div className="mr-3 h-6 w-6 animate-spin rounded-full border-4 border-[#E0E7F1] border-t-[#1D6FE0]" />
            Marking up your {thing}…
          </div>
        ) : (
          <div className="-mx-2 space-y-4 rounded-lg bg-[#F6F9FE] p-1.5 sm:mx-0 sm:p-5">
            {pages.map((pg, pi) => (
              <div
                key={pi}
                className="relative mx-auto w-full max-w-[760px] overflow-hidden rounded bg-white shadow-[0_10px_30px_-18px_rgba(0,0,0,.5)]"
                style={{ aspectRatio: `1 / ${pg.ratio}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pg.src} alt={`Page ${pi + 1} of your ${thing}`} className="absolute inset-0 h-full w-full" />
                {pg.boxes.map((b, bi) => (
                  <div
                    key={bi}
                    className="absolute"
                    style={{
                      left: `${b.left}%`,
                      top: `${b.top}%`,
                      width: `${b.width}%`,
                      height: `${b.height}%`,
                      background: b.severity === "critical" ? "rgba(217,59,48,.16)" : "rgba(255,214,64,.38)",
                      borderBottom: `2px solid ${b.severity === "critical" ? "#D93B30" : "#E8A317"}`,
                    }}
                  >
                  </div>
                ))}
                {pg.boxes
                  .filter((b) => b.badge)
                  .map((b) => (
                    <button
                      key={`b${b.n}`}
                      type="button"
                      onClick={() => jump(b.n)}
                      aria-label={`Note ${b.n}`}
                      className="absolute flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] font-extrabold leading-none text-white shadow sm:h-5 sm:min-w-5 sm:px-1 sm:text-[11px]"
                      style={{
                        left: `${b.bx ?? b.left}%`,
                        top: `${b.by ?? b.top}%`,
                        transform: "translate(-50%, -50%)",
                        background: b.severity === "critical" ? "#D93B30" : "#B97F0A",
                      }}
                    >
                      {b.n}
                    </button>
                  ))}
              </div>
            ))}
            {locked && marked > 0 && (
              <p className="text-center text-sm font-semibold text-[#0D2A4C]">
                {marked} {marked === 1 ? "problem" : "problems"} marked on your {thing}. Enter your email below to see what the top 3 cost you.
              </p>
            )}
          </div>
        )
      ) : (
        <div
          className="rounded-lg border border-[#E0E7F1] bg-[#F6F9FE] p-5 font-serif text-[15px] leading-7 text-[#0D2A4C]"
          dangerouslySetInnerHTML={{ __html: annotatedHtml }}
        />
      )}
    </div>
  );
}
