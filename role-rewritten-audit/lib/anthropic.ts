export const AUDIT_MODEL =
  process.env.AUDIT_MODEL || "claude-haiku-5-5";
export const REBUILD_MODEL =
  process.env.REBUILD_MODEL || "claude-opus-5-5";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export async function callClaude(opts: {
  model: string;
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your environment variables."
    );
  }
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": API_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4096,
      // Note: `temperature` is deprecated on current Claude models — omitted.
      system: opts.system,
      messages: opts.messages,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const text = json.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n");
  if (!text) throw new Error("Empty response from Anthropic API.");
  return text;
}

/** Extract a JSON object from a model response that may include prose fences. */
export function extractJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Model did not return JSON.");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
