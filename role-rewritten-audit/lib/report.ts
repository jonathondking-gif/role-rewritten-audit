import type { AuditRecord, AuditFinding } from "./store";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Re-render the resume as annotated HTML — the "coach's red pen."
 * Each finding's quoted text is highlighted inline (red = critical,
 * amber = warning) with a numbered badge; annotations are listed separately.
 * Matching is tolerant: exact, then case-insensitive, then whitespace-normalized.
 */
export function renderAnnotatedResumeHtml(
  resumeText: string,
  findings: AuditFinding[]
): string {
  type Span = { start: number; end: number; fid: number; severity: string };
  const spans: Span[] = [];
  const lower = resumeText.toLowerCase();
  const normText = normalize(resumeText);

  // Longest quotes first so specific matches win over short substrings.
  const ordered = findings
    .map((f, i) => ({ f, i }))
    .sort((a, b) => b.f.quote.length - a.f.quote.length);

  for (const { f, i } of ordered) {
    const q = f.quote.trim();
    if (q.length < 4) continue;
    let start = resumeText.indexOf(q);
    if (start === -1) start = lower.indexOf(q.toLowerCase());
    if (start === -1) {
      const nq = normalize(q);
      const ni = normText.indexOf(nq);
      if (ni !== -1) {
        // Map normalized index back approximately by scanning for a window.
        const approx = resumeText.toLowerCase().indexOf(nq.split(" ")[0]);
        if (approx !== -1) {
          start = approx;
        } else continue;
      } else continue;
    }
    const end = start + q.length;
    // Skip if it overlaps an already-placed span.
    if (spans.some((s) => start < s.end && end > s.start)) continue;
    spans.push({ start, end: Math.min(end, resumeText.length), fid: i, severity: f.severity });
  }

  spans.sort((a, b) => a.start - b.start);

  let html = "";
  let cursor = 0;
  for (const s of spans) {
    html += escapeHtml(resumeText.slice(cursor, s.start));
    const cls = s.severity === "critical" ? "rr-crit" : "rr-warn";
    html += `<mark class="${cls}" data-fid="${s.fid}">${escapeHtml(
      resumeText.slice(s.start, s.end)
    )}<sup class="rr-badge">${s.fid + 1}</sup></mark>`;
    cursor = s.end;
  }
  html += escapeHtml(resumeText.slice(cursor));
  // Preserve line breaks of the original resume.
  return html.replace(/\n/g, "<br>");
}

export function scoreColor(score: number): string {
  if (score >= 75) return "#1D6FE0";
  if (score >= 50) return "#E8A317";
  return "#D93B30";
}

function findingItem(f: AuditFinding, i: number): string {
  const fixHtml =
    i === 0 && f.fix
      ? `<div style="margin-top:10px;background:#EAF3FF;border-radius:8px;padding:10px 12px;font-size:14px;color:#0D2A4C;line-height:1.5"><div style="font-size:11px;font-weight:700;color:#1557B8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">How I would fix it (free sample)</div>${escapeHtml(f.fix)}</div>`
      : `<div style="margin-top:8px;font-size:13px;font-weight:700;color:#1557B8">My rewrite of this line is included in your rebuild.</div>`;
  const color = f.severity === "critical" ? "#D93B30" : "#E8A317";
  const label = f.severity === "critical" ? "Critical" : "Warning";
  return `
    <div style="border-left:4px solid ${color};padding:12px 16px;margin:0 0 12px;background:#fff;border-radius:0 8px 8px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)">
      <div style="font-size:12px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${i + 1}. ${label}: ${escapeHtml(f.section)}</div>
      <div style="font-size:13px;color:#526379;font-style:italic;margin-bottom:6px">“${escapeHtml(f.quote)}”</div>
      <div style="font-size:14px;color:#0D2A4C;line-height:1.5">${escapeHtml(f.note)}</div>${fixHtml}
    </div>`;
}

/** Full email-safe HTML audit report (inline styles throughout). */
export function buildAuditEmailHtml(a: AuditRecord, resultsUrl: string, pageCids: string[] = []): string {
  const color = scoreColor(a.overallScore);
  const cats = a.categories
    .map(
      (c) => `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#526379;margin-bottom:4px">
          <span>${escapeHtml(c.name)}</span><span><strong style="color:#0D2A4C">${c.score}</strong>/${c.max}</span>
        </div>
        <div style="background:#E0E7F1;border-radius:999px;height:8px">
          <div style="background:${color};border-radius:999px;height:8px;width:${Math.round(
            (c.score / c.max) * 100
          )}%"></div>
        </div>
      </div>`
    )
    .join("");

  const findings = a.findings.slice(0, 3).map(findingItem).join("");
  const extra = a.findings.length - 3;
  const moreHtml =
    extra > 0
      ? `<div style="border:2px dashed #1D6FE0;background:#EAF3FF;border-radius:10px;padding:16px;text-align:center"><div style="font-size:16px;font-weight:700;color:#0D2A4C">${extra} more ${extra === 1 ? "problem is" : "problems are"} marked on your resume</div><div style="font-size:14px;color:#526379;margin-top:4px">Your full audit, with every problem explained and every line rewritten, comes with any package.</div></div>`
      : "";
  const strengths = (a.strengths ?? [])
    .map(
      (s) => `
      <div style="border-left:4px solid #1D6FE0;padding:12px 16px;margin:0 0 12px;background:#fff;border-radius:0 8px 8px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)">
        <div style="font-size:13px;color:#526379;font-style:italic;margin-bottom:6px">"${escapeHtml(s.quote)}"</div>
        <div style="font-size:14px;color:#0D2A4C;line-height:1.5">${escapeHtml(s.note)}</div>
      </div>`
    )
    .join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F6F9FE;font-family:'Plus Jakarta Sans',Arial,Helvetica,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <div style="background:#0D2A4C;color:#fff;border-radius:12px;padding:28px;text-align:center;margin-bottom:20px">
      <div style="font-size:14px;text-transform:uppercase;letter-spacing:.1em;color:#9DB2CC;margin-bottom:8px">Role Rewritten: Free Resume Audit</div>
      <div style="font-size:56px;font-weight:800;color:${color}">${a.overallScore}<span style="font-size:24px;color:#9DB2CC">/100</span></div>
      <div style="font-size:14px;color:#DCE9FF;margin-top:8px">Your resume, graded like a hiring manager grades it.</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:20px">
      <div style="font-size:16px;font-weight:700;color:#0D2A4C;margin-bottom:12px">Category breakdown</div>${cats}
    </div>
    <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:20px">
      ${pageCids.length
        ? `<div style="font-size:16px;font-weight:700;color:#0D2A4C;margin-bottom:12px">Your resume, marked up</div>
      ${pageCids.map((cid, i) => `<img src="cid:${cid}" alt="Page ${i + 1} of your resume, marked up" width="592" style="display:block;width:100%;max-width:592px;height:auto;border:1px solid #E0E7F1;border-radius:6px;margin:0 0 12px">`).join("")}`
        : `<div style="font-size:16px;font-weight:700;color:#0D2A4C;margin-bottom:12px">How a company's ATS reads your resume</div>
      <div style="font-size:13px;line-height:1.7;color:#0D2A4C;background:#F6F9FE;border:1px solid #E0E7F1;border-radius:8px;padding:16px;font-family:Georgia,serif">${renderAnnotatedResumeHtml(a.resumeText, a.findings)}</div>`}
      <div style="font-size:12px;color:#526379;margin-top:8px"><span style="display:inline-block;width:12px;height:12px;background:#D93B30;border-radius:3px;vertical-align:middle"></span> critical &nbsp;<span style="display:inline-block;width:12px;height:12px;background:#FFE27A;border-radius:3px;vertical-align:middle"></span> warning. Numbered to match the notes below.</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:20px">
      <div style="font-size:16px;font-weight:700;color:#0D2A4C;margin-bottom:12px">What's working</div>${strengths}
    </div>
    <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:20px">
      <div style="font-size:16px;font-weight:700;color:#0D2A4C;margin-bottom:12px">The problems costing you the most</div>${findings}${moreHtml}
    </div>
    <div style="background:#0D2A4C;border-radius:12px;padding:28px;text-align:center">
      <div style="color:#fff;font-size:18px;font-weight:700;margin-bottom:8px">Want every line fixed?</div>
      <div style="color:#9DB2CC;font-size:14px;margin-bottom:16px">AI drafts it. A recruiter with 15+ years of hiring experience reviews every line before it reaches you.</div>
      <a href="${escapeHtml(resultsUrl)}" style="display:inline-block;background:#1D6FE0;color:#fff;font-weight:700;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none">Get my resume rebuilt, from $179</a>
    </div>
    <div style="text-align:center;font-size:12px;color:#526379;margin-top:16px">Role Rewritten. Written by a recruiter. Built to get past one.</div>
  </div></body></html>`;
}

/** Every finding with its fix, for Jon's lead alert. Not shown to visitors. */
export function buildFullFindingsHtml(findings: AuditFinding[]): string {
  return findings
    .map((f, i) => {
      const color = f.severity === "critical" ? "#D93B30" : "#E8A317";
      return `<div style="border-left:4px solid ${color};padding:8px 12px;margin:0 0 10px">
        <div style="font-size:12px;font-weight:700;color:${color};text-transform:uppercase">${i + 1}. ${escapeHtml(f.severity)}: ${escapeHtml(f.section)}</div>
        <div style="font-size:13px;color:#526379;font-style:italic">"${escapeHtml(f.quote)}"</div>
        <div style="font-size:14px;color:#0D2A4C">${escapeHtml(f.note)}</div>
        ${f.fix ? `<div style="font-size:14px;color:#1557B8;margin-top:4px"><strong>Fix:</strong> ${escapeHtml(f.fix)}</div>` : ""}
      </div>`;
    })
    .join("");
}
