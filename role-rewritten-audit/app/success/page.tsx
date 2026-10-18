export default function Success() {
  return (
    <div className="mx-auto max-w-xl flex-1 px-4 py-20 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#EAF3FF] text-3xl text-[#1D6FE0]">
        ✓
      </div>
      <h1 className="text-3xl font-extrabold text-[#0D2A4C]">Order received.</h1>
      <p className="mt-4 text-lg text-[#526379]">
        Your rebuild is in the works. A recruiter with 15+ years of hiring
        experience reviews every resume line-by-line before delivery. You will
        have it within 24 hours on business days.
      </p>
      <a
        href="/"
        className="mt-8 inline-block rounded-xl bg-[#1D6FE0] px-6 py-3 font-bold text-white hover:bg-[#1557B8]"
      >
        Back to the audit tool
      </a>
    </div>
  );
}
