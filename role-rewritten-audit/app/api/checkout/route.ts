import { NextRequest, NextResponse } from "next/server";
import { getTier } from "@/lib/pricing";
import { getAudit } from "@/lib/store";


/**
 * Resolves the order destination for a tier.
 *
 * resume / resume_linkedin / executive: paid orders go through Tally forms.
 * Reads TALLY_RESUME_URL, TALLY_RESUME_LINKEDIN_URL, TALLY_EXECUTIVE_URL.
 * Until those are set, the buttons fall back to the main site pricing page.
 *
 * tailoring: kept on the in-app Stripe path (no Tally form exists for it).
 * When STRIPE_SECRET_KEY is unset, returns { configured: false } so the UI
 * can show a "payments not configured" state instead of breaking.
 */
const TALLY_TIERS = ["resume", "resume_linkedin", "executive", "tailoring"];
const PRICING_FALLBACK = "https://www.rolerewritten.com/#pricing";

function tallyUrlFor(tierId: string): string | null {
  if (!TALLY_TIERS.includes(tierId)) return null;
  const env: Record<string, string | undefined> = {
    resume: process.env.TALLY_RESUME_URL,
    resume_linkedin: process.env.TALLY_RESUME_LINKEDIN_URL,
    executive: process.env.TALLY_EXECUTIVE_URL,
    tailoring: process.env.TALLY_TAILORING_URL,
  };
  return env[tierId] || PRICING_FALLBACK;
}

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

    // Tally-backed tiers: redirect to the order form (or the pricing page
    // until the form URLs are configured). No Stripe session needed.
    const tallyUrl = tallyUrlFor(tier.id);
    if (tallyUrl) {
      return NextResponse.json({ configured: true, url: tallyUrl });
    }

    // Tailoring has no Tally form: keep the in-app Stripe path.
    // Best-effort lookup: serverless instances don't share local disk, so
    // don't hard-fail when the audit lives on another instance.
    const audit = getAudit(auditId);

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
      "line_items[0][price_data][product_data][name]": `Role Rewritten: ${tier.name}`,
      "line_items[0][quantity]": "1",
      success_url: `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/results/${auditId}`,
      "metadata[audit_id]": auditId,
      "metadata[tier]": tier.id,
      "metadata[email]": audit?.email || "",
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
