export async function parseResume(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    // unpdf: serverless-safe PDF text extraction (pdf-parse v2 needs
    // browser-only DOMMatrix and crashes on Vercel).
    const { extractText } = await import("unpdf");
    const { text } = await extractText(new Uint8Array(buffer));
    const joined = Array.isArray(text) ? text.join("\n") : text;
    return (joined || "").trim();
  }
  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return (result.value || "").trim();
  }
  throw new Error("Unsupported file type. Please upload a PDF or DOCX resume.");
}

export function looksLikeResume(text: string): boolean {
  if (!text || text.length < 200) return false;
  const signals = [
    "experience",
    "education",
    "skills",
    "work",
    "email",
    "@",
    "19",
    "20",
  ];
  const lower = text.toLowerCase();
  return signals.filter((s) => lower.includes(s)).length >= 3;
}
