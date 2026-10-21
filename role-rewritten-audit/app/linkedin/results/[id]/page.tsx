import { Suspense } from "react";
import ResultsView from "@/components/ResultsView";
import Logo from "@/components/Logo";

export default function LinkedInResultsPage() {
  return (
    <div className="flex-1">
      <header className="border-b border-[#E0E7F1] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Logo />
          <p className="text-sm text-[#526379]">Free LinkedIn Audit</p>
        </div>
      </header>
      <Suspense
        fallback={
          <div className="mx-auto max-w-2xl px-4 py-16 text-center text-[#526379]">
            Loading your audit…
          </div>
        }
      >
        <ResultsView kind="linkedin" />
      </Suspense>
    </div>
  );
}
