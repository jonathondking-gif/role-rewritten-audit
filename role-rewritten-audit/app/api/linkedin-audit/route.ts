import { NextRequest, NextResponse } from "next/server";
import { renderAnnotatedResumeHtml } from "@/lib/report";
import { parseResume } from "@/lib/parse";
import { callClaudeStructured, AUDIT_MODEL } from "@/lib/anthropic";
import type { AuditResult } from "@/lib/prompts";
import {
  LINKEDIN_CATEGORIES,
  LINKEDIN_SCHEMA,
  LINKEDIN_SYSTEM,
  buildLinkedInPrompt,
  looksLikeLinkedInExport,
} from "@/lib/linkedinPrompts";
import { uid, type AuditCategory, type AuditRecord } from "@/lib/store";
import { saveAudit, linkedinHash, getAuditByHash, rememberHash } from "@/lib/db";

export const maxDuration = 120;

const MAX_BYTES = 5 * 1024 * 1024;

function payload(record: AuditRecord) {
  return {
    id: record.id,
    kind: "linkedin",
    target_role: record.targetRole ?? "",
    overall_score: record.overallScore,
    weak_spots_preview: record.topWeakSpots.slice(0, 3),
    unlocked: false,
    categories: record.categories,
    findings: record.findings,
    strengths: record.strengths,
    top_weak_spots: record.topWeakSpots,
    annotated_html: renderAnnotatedResumeHtml(record.resumeText, record.findings),
    file_name: record.fileName,
  };
}

/**
 * Line the model's categories up with the fixed LinkedIn rubric, so the bars
 * always show the same five categories with the same maxes. If the model
 * skipped or renamed one, keep what it returned rather than guess.
 */
function normalizeCategories(cats: AuditCategory[] | undefined): AuditCategory[] {
  const list = (cats ?? []).filter((c) => typeof c?.score === "number");
  const out: AuditCategory[] = [];
  for (const def of LINKEDIN_CATEGORIES) {
    const key = def.name.split(" ")[0].toLowerCase();
    const hit = list.find((c) => (c.name || "").toLowerCase().startsWith(key));
    if (!hit) return list;
    out.push({ name: def.name, max: def.max, score: Math.max(0, Math.min(def.max, Math.round(hit.score))) });
  }
  return out;
}

/** Overall score is the categories added up, so the headline matches the bars. */
function scoreFrom(cats: AuditCategory[], fallback: number): number {
  const valid = cats.filter((c) => typeof c.max === "number" && c.max > 0);
  const max = valid.reduce((s, c) => s + c.max, 0);
  if (max === 0) return Math.max(0, Math.min(100, Math.round(fallback)));
  const got = valid.reduce((s, c) => s + Math.max(0, Math.min(c.score, c.max)), 0);
  return Math.round((got / max) * 100);
}

function yes(v: FormDataEntryValue | null): boolean {
  return typeof v === "string" && v.toLowerCase() === "yes";
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const targetRole = String(form.get("targetRole") ?? "").trim().slice(0, 120);
    const hasPhoto = yes(form.get("hasPhoto"));
    const hasBanner = yes(form.get("hasBanner"));

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (!targetRole) {
      return NextResponse.json(
        { error: "Tell me the job title you're aiming for, so I can check your profile against it." },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File is too large. Please upload a PDF under 5MB." },
        { status: 400 }
      );
    }
    const name = file.name || "linkedin-profile.pdf";
    if (!/\.pdf$/i.test(name)) {
      return NextResponse.json(
        { error: "Please upload the PDF from LinkedIn's Save to PDF button." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const answers = JSON.stringify({ r: targetRole.toLowerCase(), p: hasPhoto, b: hasBanner });
    const hash = linkedinHash(buffer, answers);
    const cached = await getAuditByHash(hash);
    if (cached) {
      const copy: AuditRecord = {
        ...cached,
        id: uid("lia"),
        createdAt: new Date().toISOString(),
        email: undefined,
        unlocked: false,
      };
      await saveAudit(copy);
      return NextResponse.json(payload(copy));
    }

    let text: string;
    try {
      text = await parseResume(buffer, name);
    } catch {
      return NextResponse.json(
        { error: "I couldn't read that PDF. Download it again from LinkedIn (More, then Save to PDF) and try once more." },
        { status: 400 }
      );
    }
    if (!looksLikeLinkedInExport(text)) {
      return NextResponse.json(
        {
          error:
            "That doesn't look like a LinkedIn profile PDF. On your LinkedIn profile, click More (or Resources), then Save to PDF, and upload that file. Want your resume checked instead? Use the resume audit.",
        },
        { status: 400 }
      );
    }

    let result: AuditResult | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3 && !result; attempt++) {
      try {
        result = await callClaudeStructured<AuditResult>({
          model: AUDIT_MODEL,
          system: LINKEDIN_SYSTEM,
          prompt: buildLinkedInPrompt(text, { targetRole, hasPhoto, hasBanner }),
          toolName: "submit_audit",
          toolDescription: "Submit the completed LinkedIn profile audit.",
          schema: LINKEDIN_SCHEMA,
          maxTokens: 8192,
        });
        if (typeof result?.overall_score !== "number" || !Array.isArray(result.findings)) {
          result = null;
          throw new Error("Audit form came back incomplete.");
        }
      } catch (e) {
        lastErr = e;
        console.error(`[linkedin-audit] attempt ${attempt + 1} failed`, e);
      }
    }
    if (!result) throw lastErr ?? new Error("Model did not return an audit.");

    const findings = (result.findings ?? []).map((f) => ({ ...f, quote: (f.quote ?? "").trim() }));
    let weakSpots = result.top_weak_spots ?? [];
    if (!weakSpots.length && findings.length) {
      weakSpots = findings.slice(0, 6).map((f) => {
        const first = f.note.split(/(?<=[.!?])\s/)[0] || f.note;
        return `${f.section}: ${first}`.slice(0, 140);
      });
    }
    const categories = normalizeCategories(result.categories);

    const id = uid("lia");
    const record: AuditRecord = {
      id,
      kind: "linkedin",
      targetRole,
      createdAt: new Date().toISOString(),
      fileName: name,
      resumeText: text,
      overallScore: scoreFrom(categories, result.overall_score),
      categories,
      findings,
      strengths: result.strengths ?? [],
      topWeakSpots: weakSpots,
      unlocked: false,
    };
    await saveAudit(record);
    await rememberHash(hash, id);

    return NextResponse.json(payload(record));
  } catch (e) {
    console.error("[linkedin-audit] error:", e);
    return NextResponse.json(
      { error: "The audit failed. Please try again in a moment." },
      { status: 500 }
    );
  }
}
