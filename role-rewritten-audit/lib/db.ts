import crypto from "node:crypto";
import { getAudit as fileGetAudit, saveAudit as fileSaveAudit, saveLead as fileSaveLead, type AuditRecord, type Lead } from "./store";

/**
 * Durable storage. Uses the Upstash Redis database Vercel adds to the
 * project (KV_REST_API_URL / KV_REST_API_TOKEN). When those are not set, it
 * falls back to the old temporary file storage, so nothing breaks before
 * the database is connected.
 *
 * Everything expires after 90 days, matching the privacy policy.
 */

const TTL_SECONDS = 90 * 24 * 60 * 60;

/** Bump this when the audit prompt changes so old cached scores are not reused. */
export const AUDIT_VERSION = "2026-10-18b";

function creds(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function dbConnected(): boolean {
  return creds() !== null;
}

async function redis(command: (string | number)[]): Promise<unknown> {
  const c = creds();
  if (!c) throw new Error("Database not connected");
  const res = await fetch(c.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!res.ok || json.error) throw new Error(`Database error: ${json.error ?? res.status}`);
  return json.result;
}

async function getJson<T>(key: string): Promise<T | null> {
  const raw = await redis(["GET", key]);
  return typeof raw === "string" ? (JSON.parse(raw) as T) : null;
}

async function setJson(key: string, value: unknown) {
  await redis(["SET", key, JSON.stringify(value), "EX", TTL_SECONDS]);
}

export async function saveAudit(a: AuditRecord): Promise<void> {
  if (!dbConnected()) return fileSaveAudit(a);
  try {
    await setJson(`audit:${a.id}`, a);
  } catch (e) {
    console.error("[db] saveAudit failed", e);
  }
}

export async function getAudit(id: string): Promise<AuditRecord | null> {
  if (!dbConnected()) return fileGetAudit(id);
  try {
    return await getJson<AuditRecord>(`audit:${id}`);
  } catch (e) {
    console.error("[db] getAudit failed", e);
    return null;
  }
}

/** Fingerprint of the uploaded file plus the audit version. */
export function fileHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).update(AUDIT_VERSION).digest("hex");
}

/** The audit already produced for this exact file, if any. */
export async function getAuditByHash(hash: string): Promise<AuditRecord | null> {
  if (!dbConnected()) return null;
  try {
    const id = await redis(["GET", `hash:${hash}`]);
    return typeof id === "string" ? await getAudit(id) : null;
  } catch (e) {
    console.error("[db] getAuditByHash failed", e);
    return null;
  }
}

export async function rememberHash(hash: string, id: string): Promise<void> {
  if (!dbConnected()) return;
  try {
    await redis(["SET", `hash:${hash}`, id, "EX", TTL_SECONDS]);
  } catch (e) {
    console.error("[db] rememberHash failed", e);
  }
}

export async function saveLead(l: Lead & { score?: number; fileName?: string }): Promise<void> {
  if (!dbConnected()) return fileSaveLead(l);
  try {
    await redis(["LPUSH", "leads", JSON.stringify(l)]);
  } catch (e) {
    console.error("[db] saveLead failed", e);
  }
}
