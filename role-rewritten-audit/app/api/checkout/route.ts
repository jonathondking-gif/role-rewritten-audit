import { NextRequest, NextResponse } from "next/server";
import { getTier } from "@/lib/pricing";

/**
 * Resolves the order destination for a package. All paid orders go through
 * Tally (paid into the Role Rewritten Stripe account). The app never takes
 * payment itself.
 *
 * Reads TALLY_RESUME_URL, TALLY_RESUME_LINKEDIN_URL, TALLY_EXECUTIVE_URL,
 * TALLY_TAILORING_URL. Until those are set, every button falls back to the
 * main site pricing section.
 */
const PRICING_FALLBACK = "https://www.rolerewritten.com/#pricing";

function tallyUrlFor(tierId: string): string {
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
    return NextResponse.json({ configured: true, url: tallyUrlFor(tier.id) });
  } catch (e) {
    console.error("[checkout] error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again or email jon@rolerewritten.com." },
      { status: 500 }
    );
  }
}
