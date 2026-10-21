import { NextRequest, NextResponse } from "next/server";
import { getAudit, saveAudit, saveLead } from "@/lib/db";
import { sendEmail, type EmailAttachment } from "@/lib/email";
import { buildAuditEmailHtml, buildFullFindingsHtml, escapeHtml } from "@/lib/report";


const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEAD_NOTIFY_EMAIL = process.env.LEAD_NOTIFY_EMAIL || "jon@rolerewritten.com";

/**
 * Email gate: visitor unlocks the top 3 explained problems by leaving an email.
 * Fires the instant visual audit email (or stubs it when Resend is unset).
 */
export async function POST(req: NextRequest) {
  try {
    const { auditId, email, pages } = (await req.json()) as {
      auditId?: string;
      email?: string;
      pages?: unknown;
    };
    // Marked-up page images drawn in the visitor's browser (JPEG data URLs).
    const attachments: EmailAttachment[] = (Array.isArray(pages) ? pages : [])
      .filter((p): p is string => typeof p === "string" && p.startsWith("data:image/jpeg;base64,"))
      .slice(0, 3)
      .map((p) => p.slice("data:image/jpeg;base64,".length))
      .filter((b64) => b64.length < 2_500_000 && /^[A-Za-z0-9+/=]+$/.test(b64))
      .map((b64, i) => ({ filename: `resume-page-${i + 1}.jpg`, content: b64, content_id: `page${i + 1}` }));
    const pageCids = attachments.map((a) => a.content_id as string);
    if (!auditId || !email || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    // Only audits this app produced and saved can be emailed. Never accept
    // an audit from the browser: that would let anyone send arbitrary text
    // from jon@rolerewritten.com to any address.
    const audit = await getAudit(auditId);
    if (!audit) {
      return NextResponse.json(
        { error: "This audit has expired or could not be found. Please upload your resume again." },
        { status: 404 }
      );
    }

    const clean = email.trim().toLowerCase();
    await saveLead({ email: clean, auditId, createdAt: new Date().toISOString(), score: audit.overallScore, fileName: audit.fileName });
    await saveAudit({ ...audit, email: clean, unlocked: true });

    const base =
      process.env.SITE_URL || "https://audit.rolerewritten.com";
    const resultsUrl = `${base}${audit.kind === "linkedin" ? "/linkedin" : ""}/results/${auditId}`;
    const isLinkedIn = audit.kind === "linkedin";
    const sent = await sendEmail({
      to: clean,
      subject: isLinkedIn
        ? `Your LinkedIn profile scored ${audit.overallScore}/100. Here's what recruiters see.`
        : `Your resume scored ${audit.overallScore}/100. Here's what's costing you interviews.`,
      html: buildAuditEmailHtml({ ...audit, email: clean }, resultsUrl, pageCids),
      attachments,
    });

    // Notify Jon about the new lead (never attach the resume).
    const weak3 = (audit.topWeakSpots ?? [])
      .slice(0, 3)
      .map((w) => `<li style="margin-bottom:4px">${escapeHtml(w)}</li>`)
      .join("");
    await sendEmail({
      to: LEAD_NOTIFY_EMAIL,
      subject: `New ${isLinkedIn ? "LinkedIn " : ""}audit lead: ${clean} scored ${audit.overallScore}/100`,
      html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F6F9FE;font-family:'Plus Jakarta Sans',Arial,Helvetica,sans-serif">
        <div style="max-width:600px;margin:0 auto;padding:24px">
          <div style="background:#fff;border:1px solid #E0E7F1;border-radius:12px;padding:24px">
            <div style="font-size:18px;font-weight:800;color:#0D2A4C;margin-bottom:16px">New ${isLinkedIn ? "LinkedIn profile" : "resume"} audit lead</div>
            <table style="font-size:14px;color:#0D2A4C;border-collapse:collapse;width:100%">
              <tr><td style="padding:6px 0;color:#526379;width:160px">Email</td><td><strong>${escapeHtml(clean)}</strong></td></tr>
              <tr><td style="padding:6px 0;color:#526379">Score</td><td><strong>${audit.overallScore}/100</strong></td></tr>
              <tr><td style="padding:6px 0;color:#526379">File</td><td>${escapeHtml(audit.fileName)}</td></tr>
              ${isLinkedIn ? `<tr><td style="padding:6px 0;color:#526379">Target role</td><td>${escapeHtml(audit.targetRole ?? "")}</td></tr>` : ""}
            </table>
            <div style="font-size:14px;font-weight:700;color:#0D2A4C;margin:16px 0 8px">Top 3 weak spots</div>
            <ul style="font-size:14px;color:#0D2A4C;padding-left:20px;margin:0">${weak3}</ul>
            <div style="font-size:14px;font-weight:700;color:#0D2A4C;margin:20px 0 8px">Full audit (they saw the first 3 only)</div>
            ${buildFullFindingsHtml(audit.findings ?? [])}
            <div style="margin-top:16px"><a href="${escapeHtml(resultsUrl)}" style="color:#1D6FE0;font-weight:700">View their results</a></div>
          </div>
        </div></body></html>`,
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
