import { NextRequest, NextResponse } from "next/server";
import { isReviewAuthed } from "@/lib/review-auth";
import { runRebuild } from "@/lib/rebuild";
import { getTier } from "@/lib/pricing";

export const maxDuration = 300;

/** Manual rebuild trigger for testing — requires review auth. */
export async function POST(req: NextRequest) {
  if (!(await isReviewAuthed())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  try {
    const { auditId, email, tierId } = (await req.json()) as {
      auditId?: string;
      email?: string;
      tierId?: string;
    };
    const tier = getTier(tierId || "resume");
    if (!auditId || !email || !tier) {
      return NextResponse.json(
        { error: "auditId, email and tierId are required." },
        { status: 400 }
      );
    }
    const orderId = await runRebuild({
      auditId,
      email,
      tier: tier.id,
      amountCents: tier.priceCents,
    });
    return NextResponse.json({ ok: true, orderId });
  } catch (e) {
    console.error("[rebuild] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Rebuild failed." },
      { status: 500 }
    );
  }
}
