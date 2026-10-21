"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveResumeFile } from "@/lib/resumeFile";

type YesNo = "yes" | "no" | "";

function Choice({
  label,
  value,
  onChange,
  name,
}: {
  label: string;
  value: YesNo;
  onChange: (v: YesNo) => void;
  name: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-[#0D2A4C]">{label}</legend>
      <div className="mt-2 flex gap-2">
        {(["yes", "no"] as const).map((v) => (
          <label
            key={v}
            className={`cursor-pointer rounded-xl border px-5 py-2 text-sm font-bold ${
              value === v
                ? "border-[#1D6FE0] bg-[#1D6FE0] text-white"
                : "border-[#E0E7F1] bg-white text-[#0D2A4C] hover:border-[#1D6FE0]"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
              className="sr-only"
            />
            {v === "yes" ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function LinkedInUploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [hasPhoto, setHasPhoto] = useState<YesNo>("");
  const [hasBanner, setHasBanner] = useState<YesNo>("");

  function pick(f: File) {
    setError(null);
    if (!/\.pdf$/i.test(f.name)) {
      setError("Please upload the PDF from LinkedIn's Save to PDF button.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("That file is over 5MB. Please upload the PDF from LinkedIn's Save to PDF button.");
      return;
    }
    setFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return setError("Upload your LinkedIn PDF first.");
    if (!targetRole.trim()) return setError("Tell me the job title you're aiming for.");
    if (!hasPhoto || !hasBanner) return setError("Answer the two quick questions about your photo and banner.");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("targetRole", targetRole.trim());
      form.append("hasPhoto", hasPhoto);
      form.append("hasBanner", hasBanner);
      const res = await fetch("/api/linkedin-audit", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Audit failed.");
      try {
        sessionStorage.setItem(`audit:${json.id}`, JSON.stringify(json));
      } catch {
        /* storage unavailable: results page will try the API */
      }
      await saveResumeFile(json.id, file);
      router.push(`/linkedin/results/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="rounded-2xl border border-[#E0E7F1] bg-white p-6">
        <p className="text-sm font-bold uppercase tracking-wide text-[#1557B8]">Step 1</p>
        <p className="mt-1 font-semibold text-[#0D2A4C]">Download your profile from LinkedIn</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#526379]">
          <li>On a computer, open your LinkedIn profile. (The phone app can&apos;t do this.)</li>
          <li>Under your headline, click <strong>More</strong> (on some accounts it says <strong>Resources</strong>).</li>
          <li>Click <strong>Save to PDF</strong>. The file lands in your Downloads folder.</li>
        </ol>
      </div>

      <div className="rounded-2xl border border-[#E0E7F1] bg-white p-6">
        <p className="text-sm font-bold uppercase tracking-wide text-[#1557B8]">Step 2</p>
        <p className="mt-1 font-semibold text-[#0D2A4C]">Upload it</p>
        <div
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) pick(f);
          }}
          className={`mt-3 cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
            dragging ? "border-[#1D6FE0] bg-[#EAF3FF]" : "border-[#E0E7F1] bg-[#F6F9FE] hover:border-[#1D6FE0]"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) pick(f);
            }}
          />
          {file ? (
            <p className="font-semibold text-[#0D2A4C]">
              {file.name} <span className="font-normal text-[#526379]">· click to change</span>
            </p>
          ) : (
            <>
              <p className="font-semibold text-[#0D2A4C]">Drop your LinkedIn PDF here, or click to upload</p>
              <p className="mt-1 text-sm text-[#526379]">The PDF from Save to PDF. Under 5MB. Free. No account needed.</p>
            </>
          )}
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-[#E0E7F1] bg-white p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[#1557B8]">Step 3</p>
          <p className="mt-1 font-semibold text-[#0D2A4C]">Three quick questions the PDF can&apos;t answer</p>
        </div>
        <div>
          <label htmlFor="targetRole" className="text-sm font-semibold text-[#0D2A4C]">
            What job title are you aiming for?
          </label>
          <input
            id="targetRole"
            type="text"
            maxLength={120}
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="For example: Operations Manager"
            className="mt-2 w-full rounded-xl border border-[#E0E7F1] px-4 py-3 text-[#0D2A4C] focus:border-[#1D6FE0] focus:outline-none"
          />
        </div>
        <Choice label="Do you have a profile photo?" name="hasPhoto" value={hasPhoto} onChange={setHasPhoto} />
        <Choice
          label="Do you have a custom banner image (the wide image behind your photo)?"
          name="hasBanner"
          value={hasBanner}
          onChange={setHasBanner}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-[#fdeceb] px-4 py-3 text-sm font-medium text-[#D93B30]">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-[#1D6FE0] px-6 py-4 text-lg font-bold text-white hover:bg-[#1557B8] disabled:opacity-60"
      >
        {busy ? "Reading your profile like a recruiter…" : "Audit my LinkedIn"}
      </button>
      {busy && (
        <p className="text-center text-sm text-[#526379]">This takes about 20 seconds.</p>
      )}
    </form>
  );
}
