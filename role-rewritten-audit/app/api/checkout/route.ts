import { NextRequest, NextResponse } from "next/server";
import { getAudit, saveAudit, saveLead, type AuditRecord } from "@/lib/store";
import { sendEmail } from "@/lib/email";
import { buildAuditEmailHtml } from "@/lib/report";


const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email gate: visitor unlocks the full annotated report by leaving an email.
 * Fires the instant visual audit email (or stubs it when Resend is unset).
 */
export async function POST(req: NextRequest) {
  try {
    const { auditId, email, audit: bodyAudit } = (await req.json()) as {
      auditId?: string;
      email?: string;
      audit?: AuditRecord;
    };
    if (!auditId || !email || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    // The client may hand us the audit it already holds, since serverless
    // instances don't share local disk. Normalize the API (snake_case)
    // shape to the AuditRecord shape.
    function toRecord(b: any, id: string): AuditRecord | null {
      if (!b || b.id !== id) return null;
      return {
        id,
        createdAt: new Date().toISOString(),
        fileName: b.file_name || "resume",
        resumeText: b.resume_text || "",
        overallScore: b.overall_score ?? 0,
        categories: b.categories ?? [],
        findings: b.findings ?? [],
        topWeakSpots: b.top_weak_spots ?? [],
        unlocked: false,
      };
    }
    const audit = getAudit(auditId) ?? toRecord(bodyAudit, auditId);
    if (!audit) {
      return NextResponse.json({ error: "Audit not found." }, { status: 404 });
    }

    const clean = email.trim().toLowerCase();
    saveLead({ email: clean, auditId, createdAt: new Date().toISOString() });
    saveAudit({ ...audit, email: clean, unlocked: true });

    const base =
      process.env.SITE_URL || "https://audit.rolerewritten.com";
    const resultsUrl = `${base}/results/${auditId}`;
    const sent = await sendEmail({
      to: clean,
      subject: `Your resume scored ${audit.overallScore}/100 — here's the full breakdown`,
      html: buildAuditEmailHtml({ ...audit, email: clean }, resultsUrl),
    });

    return NextResponse.json({ ok: true, emailSent: sent.sent });
  } catch (e) {
    console.error("[leads] error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
