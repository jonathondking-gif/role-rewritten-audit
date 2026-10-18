"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ScoreDial from "./ScoreDial";

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
}
interface AuditData {
  id: string;
  overall_score: number;
  weak_spots_preview: string[];
  unlocked: boolean;
  categories?: Category[];
  findings?: Finding[];
  top_weak_spots?: string[];
  annotated_html?: string;
}

const TIERS = [
  {
    id: "resume",
    name: "Resume Rebuild",
    price: "$179",
    blurb: "Full professional rewrite, ATS-optimized, delivered in 24 hours.",
  },
  {
    id: "resume_linkedin",
    name: "Resume + LinkedIn",
    price: "$279",
    blurb: "Everything above, plus a rewritten LinkedIn profile. Most popular.",
  },
  {
    id: "executive",
    name: "Executive Package",
    price: "$499",
    blurb: "For directors & VPs: everything plus cover letter and strategy call.",
  },
];

function verdict(score: number): string {
  if (score >= 75) return "Strong — a few refinements and this competes.";
  if (score >= 50)
    return "Middle of the pile — this is where most resumes die quietly.";
  return "This resume is costing you interviews. Here's exactly why.";
}

export default function ResultsView() {
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
      // Hand the server the audit we already hold, in case it runs on a
      // fresh instance without it on disk.
      const cached =
        typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem(`audit:${id}`)
          : null;
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditId: id,
          email,
          audit: cached ? JSON.parse(cached) : undefined,
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
        <p className="rounded-lg bg-red-50 px-4 py-3 font-medium text-red-700">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-slate-500">
        Loading your audit…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {/* Score hero — free */}
      <div className="rounded-2xl bg-slate-900 p-8 text-center text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Your resume audit
        </p>
        <div className="mx-auto my-4 w-fit rounded-full bg-white p-2">
          <ScoreDial score={data.overall_score} />
        </div>
        <p className="mx-auto max-w-xl text-lg font-medium">{verdict(data.overall_score)}</p>
        <div className="mx-auto mt-6 max-w-xl rounded-xl bg-slate-800 p-5 text-left">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
            Preview of weak spots
          </p>
          <ul className="list-disc space-y-1 pl-5 text-slate-200">
            {data.weak_spots_preview.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            <li className="text-slate-400">…and more in the full report.</li>
          </ul>
        </div>
      </div>

      {!data.unlocked ? (
        /* Email gate */
        <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold">Unlock your full marked-up report</h2>
          <p className="mt-2 text-sm text-slate-600">
            See your resume with every weak spot highlighted, the category-by-category
            breakdown, and the fixes — in order of damage. Free.
          </p>
          <form onSubmit={unlock} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={unlocking}
              className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {unlocking ? "Unlocking…" : "Show my full report"}
            </button>
          </form>
          {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
          <p className="mt-3 text-xs text-slate-400">
            We&apos;ll also email you a copy of the full report. No spam, ever.
          </p>
        </div>
      ) : (
        /* Full report */
        <div className="mt-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Category breakdown</h2>
            <div className="space-y-3">
              {(data.categories ?? []).map((c) => (
                <div key={c.name}>
                  <div className="mb-1 flex justify-between text-sm text-slate-600">
                    <span>{c.name}</span>
                    <span>
                      <strong className="text-slate-900">{c.score}</strong>/{c.max}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-red-600"
                      style={{ width: `${Math.round((c.score / c.max) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-bold">Your resume, marked up</h2>
            <p className="mb-4 text-sm text-slate-500">
              <span className="mr-3 inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded bg-red-200" /> critical
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded bg-amber-200" /> warning
              </span>
              <span className="ml-2">— numbers match the notes below</span>
            </p>
            <div
              className="rounded-lg border border-slate-200 bg-slate-50 p-5 font-serif text-[15px] leading-7 text-slate-900"
              dangerouslySetInnerHTML={{ __html: data.annotated_html ?? "" }}
            />
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">What to fix, in order of damage</h2>
            <div className="space-y-3">
              {(data.findings ?? []).map((f, i) => (
                <div
                  key={i}
                  className={`rounded-r-lg border-l-4 bg-white p-4 shadow-sm ${
                    f.severity === "critical" ? "border-red-600" : "border-amber-500"
                  }`}
                >
                  <p
                    className={`mb-1 text-xs font-bold uppercase tracking-wide ${
                      f.severity === "critical" ? "text-red-600" : "text-amber-600"
                    }`}
                  >
                    {i + 1}. {f.severity} — {f.section}
                  </p>
                  <p className="mb-2 text-sm italic text-slate-500">“{f.quote}”</p>
                  <p className="text-[15px] leading-relaxed">{f.note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Buy CTA */}
          <div className="mt-8 rounded-2xl bg-slate-900 p-8 text-white">
            <h2 className="text-center text-2xl font-bold">
              Want this rebuilt properly?
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-slate-300">
              AI drafts it. A 20-year hiring veteran reviews every line before it reaches
              you. Delivered in 24 hours.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {TIERS.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col rounded-xl bg-slate-800 p-5"
                >
                  <p className="font-bold">{t.name}</p>
                  <p className="mt-1 text-2xl font-extrabold">{t.price}</p>
                  <p className="mt-2 flex-1 text-sm text-slate-300">{t.blurb}</p>
                  <button
                    onClick={() => buy(t.id)}
                    disabled={buying !== null}
                    className="mt-4 rounded-lg bg-red-600 px-4 py-2.5 font-semibold hover:bg-red-700 disabled:opacity-60"
                  >
                    {buying === t.id ? "Starting checkout…" : `Choose ${t.name}`}
                  </button>
                </div>
              ))}
            </div>
            {payMsg && (
              <p className="mx-auto mt-4 max-w-xl rounded-lg bg-slate-800 px-4 py-3 text-center text-sm text-amber-300">
                {payMsg}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
