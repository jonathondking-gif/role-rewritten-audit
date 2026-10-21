import type { AuditFinding } from "./store";

/**
 * Rule checks the AI misses too often to rely on. They run on the text of the
 * LinkedIn PDF export and add findings with exact quotes, so the marks land on
 * the visitor's own PDF.
 */

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const PERSONAL_DOMAINS = ["gmail", "googlemail", "yahoo", "outlook", "hotmail", "live", "msn", "icloud", "me", "mac", "aol", "proton", "protonmail", "comcast", "verizon", "att", "sbcglobal", "bellsouth", "gmx", "zoho", "yandex", "mail"];

const RANGE_RE = new RegExp(
  `\\b(${MONTHS.join("|")})\\s+(\\d{4})\\s*[-–—]\\s*(present|(?:${MONTHS.join("|")})\\s+\\d{4})`,
  "gi"
);

function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** A work email at the employer the profile lists as current. */
export function currentEmployerEmail(text: string): AuditFinding | null {
  const lines = text.split(/\n/).map((l) => l.trim());
  const presentAt = lines
    .map((l, i) => (/\b(present)\b/i.test(l) && new RegExp(RANGE_RE.source, "i").test(l) ? i : -1))
    .filter((i) => i >= 0);
  if (!presentAt.length) return null;
  const nearby = squash(presentAt.flatMap((i) => lines.slice(Math.max(0, i - 3), i)).join(" "));

  const emails = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*/g) ?? [];
  for (const email of emails) {
    const label = email.split("@")[1].split(".")[0].toLowerCase();
    if (label.length < 3 || PERSONAL_DOMAINS.includes(label)) continue;
    if (!nearby.includes(squash(label))) continue;
    return {
      section: "Contact",
      severity: "warning",
      quote: email,
      note: "Your contact email is at your current employer. Recruiters who message it reach your employer's inbox, which can expose a confidential search and loses you the message when you leave.",
      fix: "Replace it with a personal email you check every day.",
    };
  }
  return null;
}

interface Range {
  text: string;
  start: number;
  end: number;
}

function monthIndex(month: string, year: string): number {
  return Number(year) * 12 + MONTHS.indexOf(month.toLowerCase());
}

/**
 * Date ranges that partly overlap, such as one job ending after the next one
 * starts. A range fully inside another (a second title at the same company)
 * is left alone. Overlaps of a month or less are normal handoffs.
 */
export function overlappingDates(text: string, now = new Date()): AuditFinding[] {
  const ranges: Range[] = [];
  for (const m of text.matchAll(RANGE_RE)) {
    const start = monthIndex(m[1], m[2]);
    const endPart = m[3].trim();
    const end = /present/i.test(endPart)
      ? now.getFullYear() * 12 + now.getMonth()
      : monthIndex(endPart.split(/\s+/)[0], endPart.split(/\s+/)[1]);
    if (end >= start) ranges.push({ text: m[0], start, end });
  }
  const out: AuditFinding[] = [];
  for (let i = 0; i < ranges.length && out.length < 2; i++) {
    for (let j = i + 1; j < ranges.length && out.length < 2; j++) {
      const [a, b] = ranges[i].start <= ranges[j].start ? [ranges[i], ranges[j]] : [ranges[j], ranges[i]];
      const contained = b.end <= a.end;
      const overlap = Math.min(a.end, b.end) - b.start;
      if (contained || overlap < 2) continue;
      out.push({
        section: "Experience dates",
        severity: "warning",
        quote: a.text,
        note: `These dates overlap ${b.text} by about ${overlap} months. A recruiter will ask whether you held both jobs at once, and an unexplained overlap reads like a mistake.`,
        fix: "Correct the dates, or add a line explaining the overlap (for example, a transition period or a part-time role).",
      });
    }
  }
  return out;
}

/** HTML codes that leaked into the text, such as "P&amp;L" shown instead of "P&L". */
export function htmlGlitch(text: string): AuditFinding | null {
  const m = text.match(/\S*&(?:amp|lt|gt|quot|apos|nbsp|#\d{2,5}|#x[0-9a-f]{2,4});\S*/i);
  if (!m) return null;
  const shown = m[0].replace(/[,.;:]+$/, "");
  const fixed = shown
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&apos;|&#39;|&#x27;/gi, "'").replace(/&nbsp;/gi, " ");
  return {
    section: "Text glitch",
    severity: "warning",
    quote: shown,
    note: `Your profile shows "${shown}" where you meant "${fixed}". It's a copy-and-paste glitch, and recruiters read it as carelessness.`,
    fix: `Edit that section on LinkedIn and retype "${fixed}".`,
  };
}

/** Adds rule findings the AI didn't already make. */
export function addRuleFindings(findings: AuditFinding[], text: string): AuditFinding[] {
  const extra = [htmlGlitch(text), currentEmployerEmail(text), ...overlappingDates(text)].filter((f): f is AuditFinding => !!f);
  const seen = findings.map((f) => (f.quote ?? "").toLowerCase());
  const fresh = extra.filter((e) => {
    const q = e.quote.toLowerCase();
    return !seen.some((s) => s && (s.includes(q) || q.includes(s)));
  });
  return [...findings, ...fresh].slice(0, 16);
}
