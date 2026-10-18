"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveResumeFile } from "@/lib/resumeFile";

export default function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  // A Word file gets a text-only view, so pause once and suggest a PDF.
  const [pendingDocx, setPendingDocx] = useState<File | null>(null);

  function pick(file: File) {
    setError(null);
    setPendingDocx(null);
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setError("Please upload a PDF or Word (.docx) resume.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("That file is over 5MB. Please upload a smaller resume.");
      return;
    }
    if (/\.docx$/i.test(file.name)) {
      setPendingDocx(file);
      return;
    }
    submit(file);
  }

  async function submit(file: File) {
    setError(null);
    setPendingDocx(null);
    setFileName(file.name);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
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
      await saveResumeFile(json.id, file);
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
          if (f) pick(f);
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
            e.target.value = "";
            if (f) pick(f);
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
              Upload a PDF to see your resume marked up page by page. Word files work too, with a text-only view. Under 5MB. Free. No account needed.
            </p>
          </div>
        )}
      </div>

      {pendingDocx && !busy && (
        <div className="mt-3 rounded-xl border border-[#1D6FE0] bg-[#EAF3FF] p-4 text-sm text-[#0D2A4C]">
          <p>
            <span className="font-bold">Tip:</span> save your resume as a PDF first (File, Save As, PDF) to see every
            problem marked on your actual resume. Or continue with the Word file for a text-only review.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-xl bg-[#1D6FE0] px-4 py-2 font-bold text-white hover:bg-[#1557B8]"
            >
              Upload a PDF instead
            </button>
            <button
              type="button"
              onClick={() => submit(pendingDocx)}
              className="rounded-xl border border-[#1D6FE0] bg-white px-4 py-2 font-bold text-[#1D6FE0] hover:bg-[#F6F9FE]"
            >
              Continue with the Word file
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-[#fdeceb] px-4 py-3 text-sm font-medium text-[#D93B30]">
          {error}
        </p>
      )}
    </div>
  );
}
