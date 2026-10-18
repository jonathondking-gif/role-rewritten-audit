"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DECLINE_MSG =
  "Thanks for your interest. Because of a conflict of interest, I'm not able to review this resume.";

export default function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [worksWithFirm, setWorksWithFirm] = useState<"no" | "yes" | null>(null);
  const [firmName, setFirmName] = useState("");

  async function submit(file: File) {
    setError(null);
    if (worksWithFirm === null) {
      setError("Please answer the question below before uploading.");
      return;
    }
    if (worksWithFirm === "yes" && /escalon/i.test(firmName)) {
      // Conflict guard: no upload, no API call, nothing stored.
      setError(DECLINE_MSG);
      return;
    }
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setError("Please upload a PDF or DOCX resume.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("That file is over 5MB. Please upload a smaller resume.");
      return;
    }
    setFileName(file.name);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append(
        "recruitingFirm",
        worksWithFirm === "yes" ? firmName.trim() : ""
      );
      const res = await fetch("/api/audit", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Audit failed.");
      // Hand the full audit to the results page via session storage, so it
      // doesn't need a second server round-trip (unreliable on serverless).
      try {
        sessionStorage.setItem(`audit:${json.id}`, JSON.stringify(json));
      } catch {
        /* storage unavailable — results page will try the API */
      }
      router.push(`/results/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) submit(f);
        }}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
          dragging
            ? "border-[#1D6FE0] bg-[#EAF3FF]"
            : "border-[#E0E7F1] bg-white hover:border-[#1D6FE0]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) submit(f);
          }}
        />
        {busy ? (
          <div>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#E0E7F1] border-t-[#1D6FE0]" />
            <p className="font-semibold text-[#0D2A4C]">
              Grading your resume like a hiring manager…
            </p>
            <p className="mt-1 text-sm text-[#526379]">
              {fileName} · this takes about 20 seconds
            </p>
          </div>
        ) : (
          <div>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF3FF] text-2xl">
              📄
            </div>
            <p className="text-lg font-semibold text-[#0D2A4C]">
              Drop your resume here, or click to upload
            </p>
            <p className="mt-1 text-sm text-[#526379]">
              PDF or DOCX · under 5MB · free · no account needed
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-[#E0E7F1] bg-white p-5">
        <p className="font-semibold text-[#0D2A4C]">
          Are you working with a recruiting firm on a search right now? If yes,
          which one?
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-[#0D2A4C]">
            <input
              type="radio"
              name="firm"
              checked={worksWithFirm === "no"}
              onChange={() => setWorksWithFirm("no")}
              className="h-4 w-4 accent-[#1D6FE0]"
            />
            No
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[#0D2A4C]">
            <input
              type="radio"
              name="firm"
              checked={worksWithFirm === "yes"}
              onChange={() => setWorksWithFirm("yes")}
              className="h-4 w-4 accent-[#1D6FE0]"
            />
            Yes
          </label>
          {worksWithFirm === "yes" && (
            <input
              type="text"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="Firm name"
              className="flex-1 rounded-xl border border-[#E0E7F1] px-4 py-2.5 text-[#0D2A4C] focus:border-[#1D6FE0] focus:outline-none"
            />
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-[#fdeceb] px-4 py-3 text-sm font-medium text-[#D93B30]">
          {error}
        </p>
      )}
    </div>
  );
}
