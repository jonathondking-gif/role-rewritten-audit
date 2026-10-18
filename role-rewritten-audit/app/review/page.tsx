import { isReviewAuthed } from "@/lib/review-auth";
import ReviewDashboard from "@/components/ReviewDashboard";


export default async function ReviewPage() {
  const authed = await isReviewAuthed();
  return (
    <div className="flex-1">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <a href="/" className="text-lg font-extrabold tracking-tight">
            Role<span className="text-red-600">Rewritten</span>
          </a>
          <p className="text-sm text-slate-500">Owner review</p>
        </div>
      </header>
      <ReviewDashboard initialAuthed={authed} />
    </div>
  );
}
