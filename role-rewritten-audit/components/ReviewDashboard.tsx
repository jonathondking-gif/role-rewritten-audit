"use client";

import { useEffect, useState } from "react";

interface Order {
  id: string;
  email: string;
  tier: string;
  amountCents: number;
  status: string;
  draftText?: string;
  editedText?: string;
  createdAt: string;
  originalText: string;
  fileName: string;
  auditScore: number | null;
}

export default function ReviewDashboard({ initialAuthed }: { initialAuthed: boolean }) {
  const [authed, setAuthed] = useState(initialAuthed);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadOrders() {
    const res = await fetch("/api/review/orders");
    if (res.ok) {
      const json = await res.json();
      setOrders(json.orders);
      const e: Record<string, string> = {};
      for (const o of json.orders as Order[]) {
        e[o.id] = o.editedText || o.draftText || "";
      }
      setEdits(e);
    }
  }

  useEffect(() => {
    if (authed) loadOrders();
  }, [authed]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const res = await fetch("/api/review/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) setAuthed(true);
    else setLoginError("Wrong password.");
  }

  async function decide(orderId: string, action: "approve" | "save") {
    setBusy(orderId + action);
    setMsg(null);
    try {
      const res = await fetch("/api/review/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action, editedText: edits[orderId] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed.");
      setMsg(
        action === "approve"
          ? json.stubbed
            ? "Approved. Email stubbed (no Resend key), saved to outbox."
            : "Approved and sent to customer."
          : "Edits saved."
      );
      await loadOrders();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm px-4 py-20">
        <h1 className="text-center text-2xl font-bold">Review dashboard</h1>
        <form onSubmit={login} className="mt-6 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Review password"
            className="w-full rounded-lg border border-[#E0E7F1] px-4 py-3 focus:border-[#1D6FE0] focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-[#0D2A4C] px-4 py-3 font-semibold text-white hover:bg-[#14365E]"
          >
            Sign in
          </button>
          {loginError && (
            <p className="text-center text-sm font-medium text-[#D93B30]">{loginError}</p>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Review queue</h1>
      <p className="mt-1 text-sm text-[#526379]">
        AI drafts land here. Nothing reaches a customer until you approve it.
      </p>
      {msg && (
        <p className="mt-4 rounded-lg bg-[#EAF3FF] px-4 py-3 text-sm font-medium text-[#1D6FE0]">
          {msg}
        </p>
      )}
      {orders.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-[#E0E7F1] p-10 text-center text-[#526379]">
          No orders yet. They&apos;ll appear here after a customer checks out.
        </p>
      )}
      <div className="mt-6 space-y-8">
        {orders.map((o) => (
          <div key={o.id} className="rounded-2xl border border-[#E0E7F1] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold">
                  {o.tier} · ${(o.amountCents / 100).toFixed(0)}
                </p>
                <p className="text-sm text-[#526379]">
                  {o.email} · {o.fileName} · audit score {o.auditScore ?? "n/a"}/100 ·{" "}
                  {new Date(o.createdAt).toLocaleString()}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                  o.status === "sent"
                    ? "bg-[#EAF3FF] text-[#1D6FE0]"
                    : "bg-[#FFE27A] text-[#8A6D00]"
                }`}
              >
                {o.status.replace("_", " ")}
              </span>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#526379]">
                  Original resume
                </p>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-[#F6F9FE] p-4 font-serif text-sm leading-6">
                  {o.originalText}
                </pre>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#526379]">
                  AI draft. Edit freely, then approve
                </p>
                <textarea
                  value={edits[o.id] ?? ""}
                  onChange={(e) =>
                    setEdits((prev) => ({ ...prev, [o.id]: e.target.value }))
                  }
                  rows={18}
                  className="w-full rounded-lg border border-[#E0E7F1] p-4 font-serif text-sm leading-6 focus:border-[#1D6FE0] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => decide(o.id, "save")}
                disabled={busy !== null}
                className="rounded-lg border border-[#E0E7F1] px-5 py-2.5 font-semibold hover:bg-[#F6F9FE] disabled:opacity-60"
              >
                {busy === o.id + "save" ? "Saving…" : "Save edits"}
              </button>
              <button
                onClick={() => decide(o.id, "approve")}
                disabled={busy !== null || o.status === "sent"}
                className="rounded-xl bg-[#1D6FE0] px-5 py-2.5 font-semibold text-white hover:bg-[#1557B8] disabled:opacity-60"
              >
                {busy === o.id + "approve" ? "Sending…" : "Approve & send to customer"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
