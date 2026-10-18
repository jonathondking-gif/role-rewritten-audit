import { NextRequest, NextResponse } from "next/server";
import { runRebuild } from "@/lib/rebuild";
import { getTier } from "@/lib/pricing";

export const maxDuration = 300;

/**
 * Stripe webhook: on checkout.session.completed, run the AI rebuild and park
 * the draft for Jon's review. Signature verification runs when
 * STRIPE_WEBHOOK_SECRET is set; without it the endpoint accepts a test-shaped
 * payload (local dev only — never expose this behavior publicly).
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const event = JSON.parse(raw) as {
      type?: string;
      data?: { object?: Record<string, unknown> };
    };

    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true, ignored: event.type });
    }

    const obj = (event.data?.object ?? {}) as Record<string, unknown>;
    const metadata = (obj.metadata ?? {}) as Record<string, string>;
    const auditId = metadata.audit_id;
    const tierId = metadata.tier;
    const email =
      (obj.customer_details as { email?: string } | undefined)?.email ||
      metadata.email ||
      "";
    const tier = getTier(tierId || "");
    if (!auditId || !tier) {
      return NextResponse.json(
        { error: "Missing audit_id or tier in session metadata." },
        { status: 400 }
      );
    }

    const orderId = await runRebuild({
      auditId,
      email,
      tier: tier.id,
      amountCents: tier.priceCents,
      stripeSessionId: obj.id as string | undefined,
    });

    return NextResponse.json({ received: true, orderId });
  } catch (e) {
    console.error("[webhook] error:", e);
    return NextResponse.json(
      { error: "Webhook handling failed." },
      { status: 500 }
    );
  }
}
