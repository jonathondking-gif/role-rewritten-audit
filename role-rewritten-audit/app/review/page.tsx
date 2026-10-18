import { Suspense } from "react";
import { isReviewAuthed } from "@/lib/review-auth";
import ReviewDashboard from "@/components/ReviewDashboard";
import Logo from "@/components/Logo";

async function ReviewGate() {
  const authed = await isReviewAuthed();
  return <ReviewDashboard initialAuthed={authed} />;
}

export default function ReviewPage() {
  return (
    <div className="flex-1">
      <header className="border-b border-[#E0E7F1] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo />
          <p className="text-sm text-[#526379]">Owner review</p>
        </div>
      </header>
      <Suspense
        fallback={
          <p className="mx-auto max-w-6xl px-4 py-8 text-sm text-[#526379]">
            Loading review dashboard…
          </p>
        }
      >
        <ReviewGate />
      </Suspense>
    </div>
  );
}
