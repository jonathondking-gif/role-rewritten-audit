import { NextRequest, NextResponse } from "next/server";
import { getTier } from "@/lib/pricing";
import { getAudit } from "@/lib/store";


/**
 * Creates a Stripe Checkout Session via the Stripe API (no SDK — fetch only).
 * When STRIPE_SECRET_KEY is unset, returns { configured: false } so the UI
 * can show a "payments not configured" state instead of breaking.
 */
export async function POST(req: NextRequest) {
  try {
    const { auditId, tierId } = (await req.json()) as {
      auditId?: string;
      tierId?: string;
    };
    const tier = tierId ? getTier(tierId) : undefined;
    if (!auditId || !tier) {
      return NextResponse.json(
        { error: "Pick a package to continue." },
        { status: 400 }
      );
    }
    const audit = getAudit(auditId);
    if (!audit) {
      return NextResponse.json({ error: "Audit not found." }, { status: 404 });
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({
        configured: false,
        message:
          "Online payments aren't connected yet. Email jon@rolerewritten.com to order your rebuild directly.",
      });
    }

    const base = process.env.SITE_URL || "https://audit.rolerewritten.com";
    const params = new URLSearchParams({
      "payment_method_types[]": "card",
      mode: "payment",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(tier.priceCents),
      "line_items[0][price_data][product_data][name]": `Role Rewritten — ${tier.name}`,
      "line_items[0][quantity]": "1",
      success_url: `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/results/${auditId}`,
      "metadata[audit_id]": auditId,
      "metadata[tier]": tier.id,
      "metadata[email]": audit.email || "",
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(secret + ":").toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Stripe error ${res.status}: ${body.slice(0, 200)}`);
    }
    const session = (await res.json()) as { url?: string; id?: string };
    return NextResponse.json({ configured: true, url: session.url });
  } catch (e) {
    console.error("[checkout] error:", e);
    return NextResponse.json(
      { error: "Checkout failed. Please try again or email jon@rolerewritten.com." },
      { status: 500 }
    );
  }
}
