"use client";

import { useEffect, useState } from "react";
import { loadResumeFile } from "@/lib/resumeFile";
import { buildStream, locateQuote, type TextPiece } from "@/lib/highlight";

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
  midLine: boolean; // text sits just left of the mark, so the badge goes above it
}

interface Page {
  src: string;
  ratio: number; // height / width
  boxes: Box[];
}

type Status = "loading" | "ready" | "nofile" | "docx" | "error";

interface PdfItem extends TextPiece {
  transform: number[];
  width: number;
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

    pages.push({ src: canvas.toDataURL("image/png"), ratio: base.height / base.width, boxes });
  }
  return pages;
}

export default function ResumeMarkup({
  auditId,
  findings,
  annotatedHtml,
  locked,
}: {
  auditId: string;
  findings: Finding[];
  annotatedHtml: string;
  locked: boolean;
}) {
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
            Your resume, marked up
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
          How a company&apos;s ATS reads it
        </button>
      </div>

      <p className="mb-4 text-sm text-[#526379]">
        <span className="mr-3 inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#D93B30]" /> critical
        </span>
        <span className="mr-3 inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#FFE27A]" /> warning
        </span>
        {tab === "ats"
          ? "Most companies run resumes through an Applicant Tracking System (ATS). This is the text it pulls from your file. Anything scrambled or missing here is scrambled or missing for the recruiter searching for you."
          : locked
          ? "Numbers match the notes in your full report."
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
            Marking up your resume…
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
                <img src={pg.src} alt={`Page ${pi + 1} of your resume`} className="absolute inset-0 h-full w-full" />
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
                    {b.badge && !b.midLine && (
                      <button
                        type="button"
                        onClick={() => jump(b.n)}
                        aria-label={`Note ${b.n}`}
                        className={`absolute flex h-3.5 min-w-3.5 items-center right-full top-1/2 mr-0.5 -translate-y-1/2 sm:mr-1 justify-center rounded-full px-0.5 text-[8px] sm:h-5 sm:min-w-5 sm:px-1 sm:text-[11px] font-extrabold leading-none text-white shadow`}
                        style={{ background: b.severity === "critical" ? "#D93B30" : "#B97F0A" }}
                      >
                        {b.n}
                      </button>
                    )}
                  </div>
                ))}
                {pg.boxes
                  .filter((b) => b.badge && b.midLine)
                  .map((b, idx, arr) => {
                    const crowd = arr.slice(0, idx).filter((o) => Math.abs(o.top - b.top) < 2.5).length;
                    return (
                    <button
                      key={`m${b.n}`}
                      type="button"
                      onClick={() => jump(b.n)}
                      aria-label={`Note ${b.n}`}
                      className="absolute flex h-3.5 min-w-3.5 -translate-x-1/2 items-center justify-center rounded-full px-0.5 text-[8px] font-extrabold leading-none text-white shadow sm:h-5 sm:min-w-5 sm:px-1 sm:text-[11px]"
                      style={{
                        left: `${95.5 - crowd * 3.6}%`,
                        top: `${b.top + b.height / 2}%`,
                        transform: "translate(-50%, -50%)",
                        background: b.severity === "critical" ? "#D93B30" : "#B97F0A",
                      }}
                    >
                      {b.n}
                    </button>
                    );
                  })}
              </div>
            ))}
            {locked && marked > 0 && (
              <p className="text-center text-sm font-semibold text-[#0D2A4C]">
                {marked} {marked === 1 ? "problem" : "problems"} marked on your resume. Unlock your full report below to see what each one costs you and how to fix it.
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
