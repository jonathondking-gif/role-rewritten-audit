import { NextRequest, NextResponse } from "next/server";
import { isReviewAuthed } from "@/lib/review-auth";
import { getOrder, updateOrder } from "@/lib/store";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/report";


/**
 * Jon's sign-off actions. Body: { orderId, action: "approve" | "save",
 * editedText? }. Approve sends the final text to the customer (Resend when
 * configured, otherwise logged to the outbox stub) and marks the order sent.
 */
export async function POST(req: NextRequest) {
  if (!(await isReviewAuthed())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  try {
    const { orderId, action, editedText } = (await req.json()) as {
      orderId?: string;
      action?: "approve" | "save";
      editedText?: string;
    };
    const order = orderId ? getOrder(orderId) : null;
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (action === "save") {
      updateOrder(orderId!, { editedText: editedText ?? "" });
      return NextResponse.json({ ok: true, saved: true });
    }

    if (action === "approve") {
      const finalText = (editedText ?? order.editedText ?? order.draftText ?? "").trim();
      if (!finalText) {
        return NextResponse.json(
          { error: "There's no draft text to send yet." },
          { status: 400 }
        );
      }
      const sent = await sendEmail({
        to: order.email,
        subject: "Your professionally rebuilt resume is ready",
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F6F9FE;font-family:'Plus Jakarta Sans',Arial,Helvetica,sans-serif">
          <div style="max-width:640px;margin:0 auto;padding:24px">
            <div style="background:#0D2A4C;color:#fff;border-radius:12px;padding:24px;margin-bottom:20px">
              <div style="font-size:18px;font-weight:700">Your rebuilt resume is ready.</div>
              <div style="font-size:14px;color:#9DB2CC;margin-top:6px">Reviewed line-by-line by a recruiter with 15+ years of hiring experience before delivery.</div>
            </div>
            <div style="background:#fff;border-radius:12px;padding:24px">
              <pre style="white-space:pre-wrap;font-family:Georgia,serif;font-size:14px;line-height:1.6;color:#0D2A4C;margin:0">${escapeHtml(finalText)}</pre>
            </div>
            <div style="text-align:center;font-size:12px;color:#526379;margin-top:16px">Role Rewritten. Questions? Reply to this email.</div>
          </div></body></html>`,
      });
      updateOrder(orderId!, {
        editedText: finalText,
        status: "sent",
      });
      return NextResponse.json({ ok: true, sent: sent.sent, stubbed: sent.stubbed });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    console.error("[review/decision] error:", e);
    return NextResponse.json({ error: "Action failed." }, { status: 500 });
  }
}
