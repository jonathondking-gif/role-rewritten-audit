import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "rr_review";

function expectedToken(): string | null {
  const pw = process.env.REVIEW_PASSWORD;
  if (!pw) return null;
  return crypto.createHash("sha256").update(`rr-review:${pw}`).digest("hex");
}

export async function isReviewAuthed(): Promise<boolean> {
  const expected = expectedToken();
  if (!expected) return false;
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value === expected;
}

export function reviewCookieValue(): string | null {
  return expectedToken();
}

export function checkReviewPassword(candidate: string): boolean {
  const pw = process.env.REVIEW_PASSWORD;
  if (!pw) return false;
  const a = crypto.createHash("sha256").update(candidate).digest("hex");
  const b = crypto.createHash("sha256").update(pw).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export const REVIEW_COOKIE_NAME = COOKIE_NAME;
