import { callClaude, REBUILD_MODEL } from "./anthropic";
import { REBUILD_SYSTEM, buildRebuildPrompt } from "./prompts";
import { getAudit, saveOrder, uid } from "./store";

/**
 * Run the paid rebuild pass: a more capable model rewrites the resume using
 * the before/after method. The draft is saved as pending Jon's review —
 * it NEVER goes to the customer automatically.
 */
export async function runRebuild(opts: {
  auditId: string;
  email: string;
  tier: string;
  amountCents: number;
  stripeSessionId?: string;
}): Promise<string> {
  const audit = getAudit(opts.auditId);
  if (!audit) throw new Error("Audit not found for rebuild.");

  const draft = await callClaude({
    model: REBUILD_MODEL,
    system: REBUILD_SYSTEM,
    messages: [
      { role: "user", content: buildRebuildPrompt(audit.resumeText) },
    ],
    maxTokens: 6000,
    temperature: 0.4,
  });

  const orderId = uid("ord");
  saveOrder({
    id: orderId,
    auditId: opts.auditId,
    email: opts.email,
    tier: opts.tier,
    amountCents: opts.amountCents,
    status: "draft_ready",
    draftText: draft,
    createdAt: new Date().toISOString(),
    stripeSessionId: opts.stripeSessionId,
  });
  console.log(`[rebuild] draft ready for review: order=${orderId} audit=${opts.auditId}`);
  return orderId;
}
