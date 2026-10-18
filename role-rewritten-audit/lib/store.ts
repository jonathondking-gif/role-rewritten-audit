import { NextRequest, NextResponse } from "next/server";
import { parseResume, looksLikeResume } from "@/lib/parse";
import { callClaude, extractJson, AUDIT_MODEL } from "@/lib/anthropic";
import { AUDIT_SYSTEM, buildAuditPrompt, type AuditResult } from "@/lib/prompts";
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
            "That doesn't look like a resume — we couldn't find the usual sections. Try a different file.",
        },
        { status: 400 }
      );
    }

    const raw = await callClaude({
      model: AUDIT_MODEL,
      system: AUDIT_SYSTEM,
      messages: [{ role: "user", content: buildAuditPrompt(text) }],
      maxTokens: 8192,
      temperature: 0.2,
    });
    const result = extractJson<AuditResult>(raw);

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
      topWeakSpots: weakSpots,
      unlocked: false,
    };
    saveAudit(record);

    // Free preview: score + first 3 weak spots. Full report is email-gated.
    return NextResponse.json({
      id,
      overall_score: record.overallScore,
      weak_spots_preview: record.topWeakSpots.slice(0, 3),
    });
  } catch (e) {
    console.error("[audit] error:", e);
    return NextResponse.json(
      { error: "The audit failed. Please try again in a moment." },
      { status: 500 }
    );
  }
}
