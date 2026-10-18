import { NextResponse } from "next/server";
import { getAudit } from "@/lib/store";
import { renderAnnotatedResumeHtml } from "@/lib/report";


/**
 * GET /api/audit/[id] — returns the free preview (score + 3 weak spots) until
 * the visitor unlocks with an email; then the full annotated report payload.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const audit = getAudit(id);
  if (!audit) {
    return NextResponse.json({ error: "Audit not found." }, { status: 404 });
  }
  const base = {
    id: audit.id,
    overall_score: audit.overallScore,
    weak_spots_preview: audit.topWeakSpots.slice(0, 3),
    unlocked: audit.unlocked,
  };
  if (!audit.unlocked) return NextResponse.json(base);
  return NextResponse.json({
    ...base,
    categories: audit.categories,
    findings: audit.findings,
    top_weak_spots: audit.topWeakSpots,
    annotated_html: renderAnnotatedResumeHtml(audit.resumeText, audit.findings),
    file_name: audit.fileName,
  });
}
