import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "role-rewritten-data")
  : path.join(process.cwd(), "data");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name: string) {
  ensureDir();
  return path.join(DATA_DIR, name);
}

function read<T>(name: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath(name), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(name: string, value: unknown) {
  fs.writeFileSync(filePath(name), JSON.stringify(value, null, 2), "utf8");
}

export function uid(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

// ---- Types ----

export interface AuditCategory {
  name: string;
  score: number;
  max: number;
}

export interface AuditFinding {
  section: string;
  severity: "critical" | "warning";
  quote: string;
  note: string;
  fix?: string;
}

export interface AuditStrength {
  quote: string;
  note: string;
}

export interface AuditRecord {
  id: string;
  createdAt: string;
  fileName: string;
  resumeText: string;
  overallScore: number;
  categories: AuditCategory[];
  findings: AuditFinding[];
  strengths: AuditStrength[];
  topWeakSpots: string[];
  email?: string;
  unlocked: boolean;
  recruitingFirm?: string;
}

export interface Lead {
  email: string;
  auditId: string;
  createdAt: string;
}

// ---- Accessors ----

export function saveAudit(a: AuditRecord) {
  const all = read<Record<string, AuditRecord>>("audits.json", {});
  all[a.id] = a;
  write("audits.json", all);
}

export function getAudit(id: string): AuditRecord | null {
  const all = read<Record<string, AuditRecord>>("audits.json", {});
  return all[id] ?? null;
}

export function saveLead(l: Lead) {
  const all = read<Lead[]>("leads.json", []);
  if (!all.some((x) => x.email === l.email)) all.push(l);
  write("leads.json", all);
}

export function appendOutbox(entry: { to: string; subject: string; html: string }) {
  const all = read<unknown[]>("outbox.json", []);
  all.push({ ...entry, at: new Date().toISOString() });
  write("outbox.json", all);
}
