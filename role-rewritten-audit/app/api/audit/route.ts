import { NextRequest, NextResponse } from "next/server";
import { parseResume, looksLikeResume } from "@/lib/parse";
import { callClaudeStructured, AUDIT_MODEL } from "@/lib/anthropic";
import { AUDIT_SYSTEM, AUDIT_SCHEMA, buildAuditPrompt, type AuditResult } from "@/lib/prompts";
import { saveAudit, uid, type AuditRecord } from "@/lib/store";

export const maxDuration = 120;

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File is too large. Please upload a resume under 5MB." },
        { status: 400 }
      );
    }
    const name = file.name || "resume";
    if (!/\.(pdf|docx)$/i.test(name)) {
      return NextResponse.json(
        { error: "Please upload a PDF or DOCX resume." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text: string;
    try {
      text = await parseResume(buffer, name);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not read that file." },
        { status: 400 }
      );
    }
    if (!looksLikeResume(text)) {
      return NextResponse.json(
        {
          error:
            "That doesn't look like a resume. We couldn't find the usual sections. Try a different file.",
        },
        { status: 400 }
      );
    }

    // The model occasionally returns malformed JSON — retry once before failing.
    let result: AuditResult | null = null;
    let lastErr: unknown = null;
    // Retry up to 3 times on an empty or unreadable answer.
    for (let attempt = 0; attempt < 3 && !result; attempt++) {
      try {
        result = await callClaudeStructured<AuditResult>({
          model: AUDIT_MODEL,
          system: AUDIT_SYSTEM,
          prompt: buildAuditPrompt(text),
          toolName: "submit_audit",
          toolDescription: "Submit the completed resume audit.",
          schema: AUDIT_SCHEMA,
          maxTokens: 8192,
        });
        if (typeof result?.overall_score !== "number" || !Array.isArray(result.findings)) {
          result = null;
          throw new Error("Audit form came back incomplete.");
        }
      } catch (e) {
        lastErr = e;
        console.error(`[audit] attempt ${attempt + 1} failed`, e);
      }
    }
    if (!result) throw lastErr ?? new Error("Model did not return JSON.");

    // Fallback: if the model skipped top_weak_spots, derive them from findings.
    let weakSpots = result.top_weak_spots ?? [];
    if (!weakSpots.length && result.findings?.length) {
      weakSpots = result.findings.slice(0, 6).map((f) => {
        const firstSentence = f.note.split(/(?<=[.!?])\s/)[0] || f.note;
        return `${f.section}: ${firstSentence}`.slice(0, 140);
      });
    }

    const id = uid("aud");
    const record: AuditRecord = {
      id,
      createdAt: new Date().toISOString(),
      fileName: name,
      resumeText: text,
      overallScore: Math.max(0, Math.min(100, Math.round(result.overall_score))),
      categories: result.categories ?? [],
      findings: result.findings ?? [],
      strengths: result.strengths ?? [],
      topWeakSpots: weakSpots,
      unlocked: false,
    };
    saveAudit(record);

    // Return the full audit payload so the client can render the report
    // immediately without a second server round-trip. (Serverless
    // instances don't share local disk, so re-fetching by id is unreliable.)
    const { renderAnnotatedResumeHtml } = await import("@/lib/report");
    return NextResponse.json({
      id,
      overall_score: record.overallScore,
      weak_spots_preview: record.topWeakSpots.slice(0, 3),
      unlocked: false,
      categories: record.categories,
      findings: record.findings,
      strengths: record.strengths,
      top_weak_spots: record.topWeakSpots,
      annotated_html: renderAnnotatedResumeHtml(
        record.resumeText,
        record.findings
      ),
      file_name: record.fileName,
      resume_text: record.resumeText,
    });
  } catch (e) {
    console.error("[audit] error:", e);
    return NextResponse.json(
      { error: "The audit failed. Please try again in a moment." },
      { status: 500 }
    );
  }
}
