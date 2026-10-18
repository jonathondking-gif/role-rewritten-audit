import { Suspense } from "react";
import { isReviewAuthed } from "@/lib/review-auth";
import ReviewDashboard from "@/components/ReviewDashboard";

async function ReviewGate() {
  const authed = await isReviewAuthed();
  return <ReviewDashboard initialAuthed={authed} />;
}

export default function ReviewPage() {
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
      <Suspense
        fallback={
          <p className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
            Loading review dashboard…
          </p>
        }
      >
        <ReviewGate />
      </Suspense>
    </div>
  );
}
