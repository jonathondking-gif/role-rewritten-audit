import UploadForm from "@/components/UploadForm";

export default function Home() {
  return (
    <div className="flex-1">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <p className="text-lg font-extrabold tracking-tight">
            Role<span className="text-red-600">Rewritten</span>
          </p>
          <p className="text-sm text-slate-500">Free AI Resume Audit</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Is your resume costing you interviews?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            Upload it and get an instant, honest audit — scored the way a hiring
            manager actually grades it, with every weak spot marked up in red.
          </p>
        </div>

        <div className="mt-8">
          <UploadForm />
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            {
              t: "Scored like a hiring manager",
              d: "Six categories, 100 points. No vanity grades.",
            },
            {
              t: "Marked up in red",
              d: "Your resume comes back with every weak spot highlighted and numbered.",
            },
            {
              t: "Reviewed by a human",
              d: "Order a rebuild and a 20-year recruiting veteran checks every line before delivery.",
            },
          ].map((c) => (
            <div
              key={c.t}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <p className="font-bold">{c.t}</p>
              <p className="mt-1 text-sm text-slate-600">{c.d}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          Built by a talent acquisition leader from Deloitte, PwC, IBM, and
          Accenture. AI drafts — humans decide.
        </p>
      </main>
    </div>
  );
}
