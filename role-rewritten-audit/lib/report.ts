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
  if (score >= 75) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

function findingItem(f: AuditFinding, i: number): string {
  const color = f.severity === "critical" ? "#dc2626" : "#d97706";
  const label = f.severity === "critical" ? "Critical" : "Warning";
  return `
    <div style="border-left:4px solid ${color};padding:12px 16px;margin:0 0 12px;background:#fff;border-radius:0 8px 8px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)">
      <div style="font-size:12px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${i + 1}. ${label} — ${escapeHtml(f.section)}</div>
      <div style="font-size:13px;color:#374151;font-style:italic;margin-bottom:6px">“${escapeHtml(f.quote)}”</div>
      <div style="font-size:14px;color:#111827;line-height:1.5">${escapeHtml(f.note)}</div>
    </div>`;
}

/** Full email-safe HTML audit report (inline styles throughout). */
export function buildAuditEmailHtml(a: AuditRecord, resultsUrl: string): string {
  const color = scoreColor(a.overallScore);
  const cats = a.categories
    .map(
      (c) => `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#374151;margin-bottom:4px">
          <span>${escapeHtml(c.name)}</span><span><strong>${c.score}</strong>/${c.max}</span>
        </div>
        <div style="background:#e5e7eb;border-radius:999px;height:8px">
          <div style="background:${color};border-radius:999px;height:8px;width:${Math.round(
            (c.score / c.max) * 100
          )}%"></div>
        </div>
      </div>`
    )
    .join("");

  const findings = a.findings.map(findingItem).join("");
  const weakSpots = a.topWeakSpots
    .map((w) => `<li style="margin-bottom:6px">${escapeHtml(w)}</li>`)
    .join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <div style="background:#111827;color:#fff;border-radius:12px;padding:28px;text-align:center;margin-bottom:20px">
      <div style="font-size:14px;text-transform:uppercase;letter-spacing:.1em;color:#9ca3af;margin-bottom:8px">Role Rewritten — Free Resume Audit</div>
      <div style="font-size:56px;font-weight:800;color:${color}">${a.overallScore}<span style="font-size:24px;color:#9ca3af">/100</span></div>
      <div style="font-size:14px;color:#d1d5db;margin-top:8px">Your resume, graded like a hiring manager grades it.</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:20px">
      <div style="font-size:16px;font-weight:700;margin-bottom:12px">Category breakdown</div>${cats}
    </div>
    <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:20px">
      <div style="font-size:16px;font-weight:700;margin-bottom:12px">Your resume, marked up</div>
      <div style="font-size:13px;line-height:1.7;color:#111827;background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;padding:16px;font-family:Georgia,serif">${renderAnnotatedResumeHtml(a.resumeText, a.findings)}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:8px"><span style="display:inline-block;width:12px;height:12px;background:#fecaca;border-radius:3px;vertical-align:middle"></span> critical &nbsp;<span style="display:inline-block;width:12px;height:12px;background:#fde68a;border-radius:3px;vertical-align:middle"></span> warning — numbered to match the notes below</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:20px">
      <div style="font-size:16px;font-weight:700;margin-bottom:12px">What to fix, in order</div>${findings}
    </div>
    <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:20px">
      <div style="font-size:16px;font-weight:700;margin-bottom:12px">Biggest weak spots</div>
      <ul style="font-size:14px;color:#111827;padding-left:20px;margin:0">${weakSpots}</ul>
    </div>
    <div style="background:#111827;border-radius:12px;padding:28px;text-align:center">
      <div style="color:#fff;font-size:18px;font-weight:700;margin-bottom:8px">Want this rebuilt properly?</div>
      <div style="color:#9ca3af;font-size:14px;margin-bottom:16px">AI drafts it. A 20-year hiring veteran reviews every line before it reaches you.</div>
      <a href="${escapeHtml(resultsUrl)}" style="display:inline-block;background:#dc2626;color:#fff;font-weight:700;font-size:16px;padding:14px 32px;border-radius:8px;text-decoration:none">Get my resume rebuilt — from $179</a>
    </div>
    <div style="text-align:center;font-size:12px;color:#9ca3af;margin-top:16px">Role Rewritten · Every resume crosses a real hiring manager's desk.</div>
  </div></body></html>`;
}
