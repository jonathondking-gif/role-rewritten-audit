"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ScoreDial from "./ScoreDial";
import ResumeMarkup from "./ResumeMarkup";
import { getMarkedPages } from "@/lib/markedPages";

interface Category {
  name: string;
  score: number;
  max: number;
}
interface Finding {
  section: string;
  severity: "critical" | "warning";
  quote: string;
  note: string;
  fix?: string;
}
interface AuditData {
  id: string;
  kind?: "resume" | "linkedin";
  target_role?: string;
  overall_score: number;
  weak_spots_preview: string[];
  unlocked: boolean;
  categories?: Category[];
  findings?: Finding[];
  strengths?: Strength[];
  top_weak_spots?: string[];
  annotated_html?: string;
}

interface Strength {
  quote: string;
  note: string;
}

const TIERS = [
  {
    id: "resume",
    name: "Resume",
    price: "$179",
    blurb: "Full rewrite, your choice of 18 designs, plain version for online applications, unlimited revisions for 14 days.",
  },
  {
    id: "resume_linkedin",
    name: "Resume and LinkedIn",
    price: "$279",
    blurb: "Everything above, plus LinkedIn headline, About section, experience entries, and recruiter outreach email templates. Most popular.",
  },
  {
    id: "executive",
    name: "Executive",
    price: "$499",
    blurb: "Everything above, plus a cover letter, a 30-minute strategy call, and a second version for another target role.",
  },
];

function linkedinVerdict(score: number): string {
  if (score >= 80) return "Your profile is in good shape. Recruiters can find you.";
  if (score >= 75) return "Strong. A few changes and recruiters find you faster.";
  if (score >= 50) return "Solid foundation, with gaps that keep you out of recruiter searches.";
  return "This profile is costing you recruiter messages. Here's exactly why.";
}

function verdict(score: number): string {
  if (score >= 80)
    return "Your resume is in good shape. You may not need a full rewrite.";
  if (score >= 75) return "Strong. A few refinements and this competes.";
  if (score >= 50)
    return "Solid foundation, with gaps that cost you interviews.";
  return "This resume is costing you interviews. Here's exactly why.";
}

export default function ResultsView({ kind: kindProp }: { kind?: "resume" | "linkedin" } = {}) {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<AuditData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [payMsg, setPayMsg] = useState<string | null>(null);

  async function load() {
    try {
      // Prefer the audit the upload page stashed in session storage —
      // serverless instances don't share local disk, so the API lookup
      // by id is unreliable.
      const cached =
        typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem(`audit:${id}`)
          : null;
      if (cached) {
        setData(JSON.parse(cached));
        return;
      }
      const res = await fetch(`/api/audit/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load audit.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load audit.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlocking(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditId: id,
          email,
          pages: getMarkedPages(id),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unlock failed.");
      // Unlock locally — no need to re-fetch from the server.
      setData((d) => (d ? { ...d, unlocked: true } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlock failed.");
    } finally {
      setUnlocking(false);
    }
  }

  async function buy(tierId: string) {
    setBuying(tierId);
    setPayMsg(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId: id, tierId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Checkout failed.");
      if (json.configured && json.url) {
        window.location.href = json.url;
      } else {
        setPayMsg(
          json.message ||
            "Online payments aren't connected yet. Email jon@rolerewritten.com to order directly."
        );
      }
    } catch (e) {
      setPayMsg(e instanceof Error ? e.message : "Checkout failed.");
    } finally {
      setBuying(null);
    }
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="rounded-lg bg-[#fdeceb] px-4 py-3 font-medium text-[#D93B30]">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-[#526379]">
        Loading your audit…
      </div>
    );
  }

  const li = (data.kind ?? kindProp) === "linkedin";
  const thing = li ? "profile" : "resume";
  // LinkedIn visitors see only the packages that include LinkedIn.
  const tiers = li
    ? TIERS.filter((t) => t.id !== "resume").map((t) =>
        t.id === "resume_linkedin"
          ? {
              ...t,
              blurb:
                "Your LinkedIn headline, About section, and experience entries rewritten, plus a full resume rewrite to match and recruiter outreach email templates. Most popular.",
            }
          : t
      )
    : TIERS;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {/* Score hero — free */}
      <div className="rounded-2xl bg-[#0D2A4C] p-8 text-center text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#9DB2CC]">
          {li ? "Your LinkedIn audit" : "Your resume audit"}
        </p>
        {li && data.target_role && (
          <p className="mt-1 text-sm text-[#9DB2CC]">Checked against: {data.target_role}</p>
        )}
        <div className="mx-auto my-4 w-fit rounded-full bg-white p-2">
          <ScoreDial score={data.overall_score} />
        </div>
        <p className="mx-auto max-w-xl text-lg font-medium">{li ? linkedinVerdict(data.overall_score) : verdict(data.overall_score)}</p>
        <div className="mx-auto mt-6 max-w-xl rounded-xl bg-[#EAF3FF] p-5 text-left">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#0D2A4C]">
            Preview of weak spots
          </p>
          <ul className="list-disc space-y-1 pl-5 text-[#0D2A4C]">
            {data.weak_spots_preview.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            <li className="text-[#526379]">…and more marked on your {thing}.</li>
          </ul>
        </div>
      </div>

      {!data.unlocked && (
        <div className="mt-8">
          <ResumeMarkup
            auditId={id}
            findings={data.findings ?? []}
            annotatedHtml={data.annotated_html ?? ""}
            locked
            kind={li ? "linkedin" : "resume"}
          />
        </div>
      )}

      {!data.unlocked ? (
        /* Email gate */
        <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-[#E0E7F1] bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-[#0D2A4C]">See what your top 3 problems cost you</h2>
          <p className="mt-2 text-sm text-[#526379]">
            Your 3 most damaging problems explained, plus a free sample fix for #1.
            I&apos;ll email you a copy with your marked-up {thing}.
          </p>
          <form onSubmit={unlock} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 rounded-xl border border-[#E0E7F1] px-4 py-3 text-[#0D2A4C] focus:border-[#1D6FE0] focus:outline-none"
            />
            <button
              type="submit"
              disabled={unlocking}
              className="rounded-xl bg-[#1D6FE0] px-6 py-3 font-bold text-white hover:bg-[#1557B8] disabled:opacity-60"
            >
              {unlocking ? "Unlocking…" : "Show my top 3"}
            </button>
          </form>
          {error && <p className="mt-3 text-sm font-medium text-[#D93B30]">{error}</p>}
          <p className="mt-3 text-xs text-[#526379]">
            No spam, ever.
          </p>
        </div>
      ) : (
        /* Full report */
        <div className="mt-8">
          <div className="rounded-2xl border border-[#E0E7F1] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-[#0D2A4C]">Category breakdown</h2>
            <div className="space-y-3">
              {(data.categories ?? []).map((c) => (
                <div key={c.name}>
                  <div className="mb-1 flex justify-between text-sm text-[#526379]">
                    <span>{c.name}</span>
                    <span>
                      <strong className="text-[#0D2A4C]">{c.score}</strong>/{c.max}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#EAF3FF]">
                    <div
                      className="h-2 rounded-full bg-[#1D6FE0]"
                      style={{ width: `${Math.round((c.score / c.max) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <ResumeMarkup
              auditId={id}
              findings={data.findings ?? []}
              annotatedHtml={data.annotated_html ?? ""}
              locked={false}
              kind={li ? "linkedin" : "resume"}
            />
          </div>

          {(data.strengths ?? []).length > 0 && (
            <div className="mt-6 rounded-2xl border border-[#E0E7F1] bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-[#0D2A4C]">What&apos;s working</h2>
              <div className="space-y-3">
                {(data.strengths ?? []).map((s, i) => (
                  <div
                    key={i}
                    className="rounded-r-lg border-l-4 border-[#1D6FE0] bg-white p-4 shadow-sm"
                  >
                    <p className="mb-2 text-sm italic text-[#526379]">&ldquo;{s.quote}&rdquo;</p>
                    <p className="text-[15px] leading-relaxed text-[#0D2A4C]">{s.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-[#E0E7F1] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-[#0D2A4C]">The {Math.min(3, (data.findings ?? []).length)} problems costing you the most</h2>
            <div className="space-y-3">
              {(data.findings ?? []).slice(0, 3).map((f, i) => (
                <div
                  key={i}
                  id={`finding-${i + 1}`}
                  className={`scroll-mt-24 rounded-r-lg border-l-4 bg-white p-4 shadow-sm ${
                    f.severity === "critical" ? "border-[#D93B30]" : "border-[#E8A317]"
                  }`}
                >
                  <p
                    className={`mb-1 text-xs font-bold uppercase tracking-wide ${
                      f.severity === "critical" ? "text-[#D93B30]" : "text-[#B97F0A]"
                    }`}
                  >
                    {i + 1}. {f.severity}: {f.section}
                  </p>
                  {f.quote && <p className="mb-2 text-sm italic text-[#526379]">“{f.quote}”</p>}
                  <p className="text-[15px] leading-relaxed text-[#0D2A4C]">{f.note}</p>
                  {!f.quote && f.fix && i !== 0 ? (
                    <p className="mt-3 text-[15px] leading-relaxed text-[#0D2A4C]">
                      <span className="mr-1 font-bold text-[#1557B8]">What to do:</span>
                      {f.fix}
                    </p>
                  ) : i === 0 && f.fix ? (
                    <p className="mt-3 rounded-lg bg-[#EAF3FF] px-4 py-3 text-[15px] leading-relaxed text-[#0D2A4C]">
                      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#1557B8]">
                        How I would fix it (free sample)
                      </span>
                      {f.fix}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm font-semibold text-[#1557B8]">
                      My rewrite of this line is included in your rebuild.
                    </p>
                  )}
                </div>
              ))}
            </div>
            {(data.findings ?? []).length > 3 && (
              <div className="mt-4 rounded-xl border-2 border-dashed border-[#1D6FE0] bg-[#EAF3FF] p-5 text-center">
                <p className="text-lg font-bold text-[#0D2A4C]">
                  {(data.findings ?? []).length - 3} more {(data.findings ?? []).length - 3 === 1 ? "problem is" : "problems are"} marked on your {thing}
                </p>
                <p className="mt-1 text-[15px] text-[#526379]">
                  Your full audit, with every problem explained and every line rewritten, comes with {li ? "both packages below" : "any package below"}.
                </p>
              </div>
            )}
          </div>

          {/* Buy CTA */}
          {li && data.overall_score >= 80 ? (
            <div className="mt-8 rounded-2xl bg-[#0D2A4C] p-8 text-center text-white">
              <h2 className="text-2xl font-bold">Your profile is in good shape.</h2>
              <p className="mx-auto mt-2 max-w-xl text-[#9DB2CC]">
                You may not need a rewrite. Make sure your resume tells the same story: run it
                through the free audit next.
              </p>
              <Link
                href="/"
                className="mt-6 inline-block rounded-xl bg-[#1D6FE0] px-6 py-3 font-bold text-white hover:bg-[#1557B8]"
              >
                Audit my resume free
              </Link>
            </div>
          ) : data.overall_score >= 80 && !li ? (
            <div className="mt-8 rounded-2xl bg-[#0D2A4C] p-8 text-white">
              <h2 className="text-center text-2xl font-bold">
                Want it tailored to a specific role?
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-center text-[#9DB2CC]">
                Your resume is strong. For a job you really want, I will tune it
                to the posting: keywords, emphasis, and order.
              </p>
              <div className="mx-auto mt-6 max-w-sm rounded-xl bg-[#14365E] p-5 text-center">
                <p className="font-bold">Job Tailoring</p>
                <p className="mt-1 text-2xl font-extrabold">$49</p>
                <p className="mt-2 text-sm text-[#9DB2CC]">
                  Your resume tuned to one specific job posting.
                </p>
                <button
                  onClick={() => buy("tailoring")}
                  disabled={buying !== null}
                  className="mt-4 w-full rounded-xl bg-[#1D6FE0] px-4 py-2.5 font-bold text-white hover:bg-[#1557B8] disabled:opacity-60"
                >
                  {buying === "tailoring" ? "Starting checkout…" : "Choose Job Tailoring"}
                </button>
              </div>
              {payMsg && (
                <p className="mx-auto mt-4 max-w-xl rounded-lg bg-[#14365E] px-4 py-3 text-center text-sm text-[#FFE27A]">
                  {payMsg}
                </p>
              )}
            </div>
          ) : (
          <div className="mt-8 rounded-2xl bg-[#0D2A4C] p-8 text-white">
            <h2 className="text-center text-2xl font-bold">
              {li ? "Want your profile rewritten?" : "Want this rebuilt properly?"}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-[#9DB2CC]">
              {li && "I rewrite your headline, About section, and experience entries, and your resume to match. "}AI drafts it. A recruiter with 15+ years of hiring experience reviews every line before it reaches
              you. Delivered within 24 hours on business days.
            </p>
            <div className={`mt-6 grid gap-4 ${li ? "mx-auto max-w-2xl md:grid-cols-2" : "md:grid-cols-3"}`}>
              {tiers.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col rounded-xl bg-[#14365E] p-5"
                >
                  <p className="font-bold">{t.name}</p>
                  <p className="mt-1 text-2xl font-extrabold">{t.price}</p>
                  <p className="mt-2 flex-1 text-sm text-[#9DB2CC]">{t.blurb}</p>
                  <button
                    onClick={() => buy(t.id)}
                    disabled={buying !== null}
                    className="mt-4 rounded-xl bg-[#1D6FE0] px-4 py-2.5 font-bold text-white hover:bg-[#1557B8] disabled:opacity-60"
                  >
                    {buying === t.id ? "Starting checkout…" : `Choose ${t.name}`}
                  </button>
                </div>
              ))}
            </div>
            {payMsg && (
              <p className="mx-auto mt-4 max-w-xl rounded-lg bg-[#14365E] px-4 py-3 text-center text-sm text-[#FFE27A]">
                {payMsg}
              </p>
            )}
            <p className="mx-auto mt-4 max-w-xl text-center text-sm text-[#9DB2CC]">
              Unlimited revisions for 14 days. If you are not getting responses within 60 days, I will rewrite it free.
            </p>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
