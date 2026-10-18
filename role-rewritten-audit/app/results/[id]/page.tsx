import { Suspense } from "react";
import ResultsView from "@/components/ResultsView";

export default function ResultsPage() {
  return (
    <div className="flex-1">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <a href="/" className="text-lg font-extrabold tracking-tight">
            Role<span className="text-red-600">Rewritten</span>
          </a>
          <p className="text-sm text-slate-500">Free AI Resume Audit</p>
        </div>
      </header>
      <Suspense
        fallback={
          <div className="mx-auto max-w-2xl px-4 py-16 text-center text-slate-500">
            Loading your audit…
          </div>
        }
      >
        <ResultsView />
      </Suspense>
    </div>
  );
}
