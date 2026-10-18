import { NextResponse } from "next/server";
import { isReviewAuthed } from "@/lib/review-auth";
import { listOrders, getAudit } from "@/lib/store";


export async function GET() {
  if (!(await isReviewAuthed())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const orders = listOrders().map((o) => {
    const audit = getAudit(o.auditId);
    return {
      ...o,
      originalText: audit?.resumeText ?? "",
      fileName: audit?.fileName ?? "",
      auditScore: audit?.overallScore ?? null,
    };
  });
  return NextResponse.json({ orders });
}
