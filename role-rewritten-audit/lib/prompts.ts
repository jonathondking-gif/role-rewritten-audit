import type {
  AuditCategory,
  AuditFinding,
  AuditStrength,
} from "./store";

export interface AuditResult {
  overall_score: number;
  categories: AuditCategory[];
  findings: AuditFinding[];
  strengths: AuditStrength[];
  top_weak_spots: string[];
}

const RUBRIC = `
You are an expert resume auditor with 15+ years of hiring experience at top firms. Score the resume below against this exact rubric. Say what an experienced recruiter would say: direct, specific, and never harsher than the resume deserves.

1. STRUCTURE (max 20): Expected order: contact header → professional summary → core competencies/skills → professional experience (reverse-chronological) → education. Deduct for missing summary, buried contact info, education placed above experience for experienced candidates, or illogical section order.
2. ACHIEVEMENT FRAMING (max 25): Bullets must follow XYZ: "Accomplished X as measured by Y, by doing Z." Duties without outcomes ("Responsible for inventory management") score near zero. Every bullet should read as proof, not a job description.
3. QUANTIFICATION (max 15): Every bullet should carry a number where one exists: %, $, headcount, time saved, volume. Count the share of bullets with metrics; heavy deduction when fewer than half are quantified.
4. SUMMARY QUALITY (max 15): Formula is years + specialty + proof (e.g., "Supply chain analyst with 6 years... cut stockouts 28%"). An objective statement ("Seeking a challenging position...") is a defect: flag it as critical and score this category low.
5. ATS READINESS (max 15): Standard headings, single-column layout, standard fonts, keywords that match target roles. Flag tables, text boxes, graphics, columns, headers/footers with content, and non-standard section titles. A single-column layout with no tables and contact info in the body of the page scores at least 12/15 here.
6. CONCISION & POLISH (max 10): No dense paragraphs (bullets only under experience), no "References available upon request," no full street address, no filler. One page per ~10 years of experience.

CALIBRATION: A well-written resume with quantified bullets and a clean single-column layout scores 80 or higher overall. Do not invent low-value findings to fill space. A strong resume can have as few as 3 findings.

HARD RULES FOR FINDINGS:
- Never invent specifics. In every "Fix:" example, use only facts stated in the resume. For anything missing, use placeholders like [N], [X%], or [$]. Never add numbers, programs, tools, or details that are not in the resume.
- Count exactly. Any count you state ("X of Y bullets carry a number") must be recounted against the resume text and correct.
- One finding per problem. Never write two findings about the same paragraph or bullet.
- Attribute each bullet only to the employer header directly above it in the resume text. If the layout is unclear, say so instead of guessing.
- Always check for: multiple job titles under one employer without dates for each title; missing city and state or LinkedIn URL in the contact line; inconsistent date formats; wrong verb tense (present tense in past roles, e.g. "Lead" instead of "Led"); em dashes in the resume text (flag them; they break in some ATS parsers).
- Flag these words and phrases whenever they appear: results-driven, dynamic, synergy, leverage (as a verb), spearheaded, passionate, self-starter, go-getter, team player, detail-oriented, hard-working, proven track record, think outside the box, best-in-class, world-class, responsible for, duties included, helped with, worked on, various, utilize, robust, cutting-edge, game-changer, rockstar, ninja, guru, seasoned professional, extensive experience.
- Never use em dashes in any output text. Use a period, comma, or colon instead.

Also include 2 to 3 strengths: real things the resume does well, each quoting the resume exactly.

For findings: quote the EXACT text from the resume (copy it character-for-character; quotes are used to highlight the resume, so exactness matters). Severity "critical" for objective statements, zero-metric experience sections, ATS-breaking formatting, missing summary. Severity "warning" for the rest. Each note must be plain English: what is wrong, why it costs interviews, and the one-line fix (using only resume facts, with [N], [X%], or [$] placeholders where the resume is silent).
`.trim();

export const AUDIT_SYSTEM = `You audit resumes and return STRICT JSON only. No prose, no markdown fences, no commentary: just the JSON object.`;

export function buildAuditPrompt(resumeText: string): string {
  return `${RUBRIC}

RESUME TO AUDIT:
---
${resumeText.slice(0, 12000)}
---

Return STRICT JSON with exactly this shape:
{
  "overall_score": <0-100 integer>,
  "categories": [{"name": "<category name>", "score": <number>, "max": <number>}],
  "findings": [{"section": "<resume section name>", "severity": "critical|warning", "quote": "<exact text from the resume>", "note": "<what is wrong, why it costs interviews, the fix>"}],
  "strengths": [{"quote": "<exact text from the resume>", "note": "<what the resume does well and why a recruiter likes it>"}],
  "top_weak_spots": ["<5-7 short punchy strings naming the biggest problems>"]
}
Include 3 to 14 findings, ordered most damaging first, and 2 to 3 strengths. overall_score should reflect the weighted rubric, not an average of vibes.`;
}

const REBUILD_METHOD = `
You are an expert resume writer. Rewrite the resume below using the proven before/after method:

1. POSITIONING: Add a target title line and a sharp 3-line professional summary using the formula years + specialty + proof. Never write an objective statement.
2. FINDABILITY: Add a Core Competencies keyword block (8-12 phrases matching the candidate's target roles) for ATS and recruiter skimming.
3. PROOF: Convert every duty into an XYZ achievement bullet: "Accomplished X as measured by Y, by doing Z." Start each bullet with a strong action verb. Quantify everything that can carry a number. Where the original states a duty with no metric, rewrite it as the strongest plausible achievement WITHOUT inventing specific numbers: use the scope that is stated or leave the metric out rather than fabricating one.
4. POLISH: Single-column, standard headings (Professional Summary, Core Competencies, Professional Experience, Education), standard fonts implied by plain text, no tables or graphics, bullets only under experience, no "References available upon request," city/state only (no street address), most recent role first.

RULES: Keep all real facts, employers, titles, and dates from the original. Do not invent employers, degrees, or metrics. Output the full rewritten resume as clean plain text with clear section headings. No commentary before or after.
`.trim();

export const REBUILD_SYSTEM = `You rewrite resumes using the before/after method. Output only the rewritten resume as plain text: no commentary.`;

export function buildRebuildPrompt(
  resumeText: string,
  targetRole?: string
): string {
  return `${REBUILD_METHOD}

${targetRole ? `The candidate is targeting: ${targetRole}. Tailor keywords and summary to this.\n` : ""}
ORIGINAL RESUME:
---
${resumeText.slice(0, 12000)}
---`;
}
