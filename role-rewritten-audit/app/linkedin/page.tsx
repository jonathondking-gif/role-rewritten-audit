import Link from "next/link";
import type { Metadata } from "next";
import LinkedInUploadForm from "@/components/LinkedInUploadForm";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
  title: "Free LinkedIn Profile Audit: Role Rewritten",
  description:
    "Upload your LinkedIn profile PDF and get an instant, honest audit from a recruiter's point of view: headline, About, experience, and the keywords recruiters search for.",
};

export default function LinkedInHome() {
  return (
    <div className="flex-1">
      <header className="border-b border-[#E0E7F1] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Logo />
          <p className="text-sm text-[#526379]">Free LinkedIn Audit</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#0D2A4C] sm:text-5xl">
            Can recruiters find you on LinkedIn?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-[#526379]">
            Upload your profile and get an instant, honest audit, scored the way a recruiter
            searches, with every weak spot marked.
          </p>
        </div>

        <div className="mt-8">
          <LinkedInUploadForm />
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { t: "Checked against your target role", d: "Your headline and keywords, compared with what recruiters type into search." },
            { t: "Marked like a red pen", d: "Your profile comes back with every weak spot highlighted and numbered." },
            { t: "Reviewed by a human", d: "Order a rewrite and a recruiter with 15+ years of hiring experience checks every line." },
          ].map((c) => (
            <div key={c.t} className="rounded-xl border border-[#E0E7F1] bg-white p-5">
              <p className="font-bold text-[#0D2A4C]">{c.t}</p>
              <p className="mt-1 text-sm text-[#526379]">{c.d}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-[#526379]">
          Want your resume checked too?{" "}
          <Link href="/" className="font-bold text-[#1D6FE0] hover:underline">
            Audit my resume free
          </Link>
        </p>
        <p className="mt-4 text-center text-xs text-[#526379]">
          Built by a recruiter who has hired for Deloitte, PwC, IBM, and Accenture. AI drafts. Humans decide.
        </p>
      </main>
    </div>
  );
}
