import UploadForm from "@/components/UploadForm";
import Logo from "@/components/Logo";

export default function Home() {
  return (
    <div className="flex-1">
      <header className="border-b border-[#E0E7F1] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Logo />
          <p className="text-sm text-[#526379]">Free AI Resume Audit</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#0D2A4C] sm:text-5xl">
            Is your resume costing you interviews?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-[#526379]">
            Upload it and get an instant, honest audit, scored the way a hiring
            manager actually grades it, with every weak spot highlighted.
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
              t: "Highlighted like a red pen",
              d: "Your resume comes back with every weak spot highlighted and numbered.",
            },
            {
              t: "Reviewed by a human",
              d: "Order a rebuild and a recruiter with 15+ years of hiring experience checks every line before delivery.",
            },
          ].map((c) => (
            <div
              key={c.t}
              className="rounded-xl border border-[#E0E7F1] bg-white p-5"
            >
              <p className="font-bold text-[#0D2A4C]">{c.t}</p>
              <p className="mt-1 text-sm text-[#526379]">{c.d}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-[#526379]">
          Built by a recruiter who has hired for Deloitte, PwC, IBM, and
          Accenture. AI drafts. Humans decide.
        </p>
      </main>
    </div>
  );
}
