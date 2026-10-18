export async function parseResume(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    // pdf-parse v2: class-based API. Dynamic import keeps Next.js bundling happy.
    const { PDFParse } = (await import("pdf-parse")) as unknown as {
      PDFParse: new (opts: { data: Uint8Array }) => {
        getText(): Promise<{ text: string }>;
        destroy(): Promise<void>;
      };
    };
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return (result.text || "").trim();
    } finally {
      await parser.destroy().catch(() => {});
    }
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
