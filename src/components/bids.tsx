"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BidQuery, BidSettings, BidStatus } from "@/lib/bid-types";

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (res.ok) return null;
    const b = (await res.json().catch(() => ({}))) as { error?: string };
    return b.error ?? `Request failed (${res.status})`;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export function BidSearchButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      <button
        className="btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          setError(await send("/api/bids/search", "POST"));
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? "Searching and checking bid pages... (up to 2 minutes)" : "Find bids"}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}

export function BidStatusButton({ id, status, label, primary }: { id: string; status: BidStatus; label: string; primary?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={primary ? "btn-primary" : "btn-secondary"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const err = await send(`/api/bids/${id}`, "PATCH", { status });
        if (err) alert(err);
        setBusy(false);
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}

function num(s: string): number | null {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return s.trim() && Number.isFinite(n) ? n : null;
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// Your cost for the contractor, your bid price, and the margin between them.
export function BidPricing({
  id,
  contractorCost,
  bidPrice,
  dueDate,
  notes,
}: {
  id: string;
  contractorCost: number | null;
  bidPrice: number | null;
  dueDate: string | null;
  notes: string | null;
}) {
  const router = useRouter();
  const [cost, setCost] = useState(contractorCost?.toString() ?? "");
  const [price, setPrice] = useState(bidPrice?.toString() ?? "");
  const [due, setDue] = useState(dueDate ?? "");
  const [note, setNote] = useState(notes ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const c = num(cost);
  const p = num(price);
  const margin = c !== null && p !== null ? p - c : null;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          What you&apos;ll pay the contractor ($)
          <input className="input mt-1" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="e.g. 400" />
        </label>
        <label className="block text-sm">
          Your bid price ($)
          <input className="input mt-1" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 520" />
        </label>
        <label className="block text-sm">
          Due date
          <input className="input mt-1" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {c !== null &&
          [20, 25, 30].map((pct) => (
            <button key={pct} className="btn-secondary" type="button" onClick={() => setPrice((c / (1 - pct / 100)).toFixed(2))}>
              Price at {pct}% margin
            </button>
          ))}
      </div>
      {margin !== null && p ? (
        <p className={`text-sm ${margin < 0 ? "text-red-600" : "text-stone-700 dark:text-stone-300"}`}>
          You keep <b>{usd(margin)}</b> per period ({Math.round((margin / p) * 100)}% of your bid price).
        </p>
      ) : null}
      <label className="block text-sm">
        Notes
        <textarea className="input mt-1 h-24" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Billing period (weekly, monthly, per cut), contractor lined up, questions for the agency" />
      </label>
      <div className="flex items-center gap-3">
        <button
          className="btn-primary"
          onClick={async () => {
            const err = await send(`/api/bids/${id}`, "PATCH", { contractor_cost: cost, bid_price: price, due_date: due, notes: note });
            setMsg(err ?? "Saved");
            router.refresh();
          }}
        >
          Save
        </button>
        {msg && <span className="text-sm text-stone-500">{msg}</span>}
      </div>
    </div>
  );
}

export function BidSettingsForm({ settings }: { settings: BidSettings }) {
  const router = useRouter();
  const [states, setStates] = useState(settings.states.join(", "));
  const [terms, setTerms] = useState(settings.bid_terms);
  const [recency, setRecency] = useState(settings.recency);
  const [perQuery, setPerQuery] = useState(settings.results_per_query);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="card space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const err = await send("/api/bids/settings", "POST", { states, bid_terms: terms, recency, results_per_query: perQuery });
        setMsg(err ?? "Saved");
        router.refresh();
      }}
    >
      <label className="block text-sm">
        States (full names, separated by commas)
        <input className="input mt-1" value={states} onChange={(e) => setStates(e.target.value)} placeholder="North Carolina, South Carolina, Georgia" />
        <span className="text-xs text-stone-500">Leave empty to search every state. Three or fewer keeps results focused.</span>
      </label>
      <label className="block text-sm">
        Bid wording (added to every search)
        <textarea className="input mt-1 font-mono text-xs" rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Posted within
          <select className="input mt-1" value={recency} onChange={(e) => setRecency(e.target.value as BidSettings["recency"])}>
            <option value="d">Past day</option>
            <option value="w">Past week</option>
            <option value="m">Past month</option>
            <option value="y">Past year</option>
            <option value="any">Any time</option>
          </select>
        </label>
        <label className="block text-sm">
          Results per search
          <input className="input mt-1" type="number" min={10} max={100} step={10} value={perQuery} onChange={(e) => setPerQuery(Number(e.target.value))} />
          <span className="text-xs text-stone-500">More results use more Serper credits.</span>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary">Save settings</button>
        {msg && <span className="text-sm text-stone-500">{msg}</span>}
      </div>
    </form>
  );
}

function BidQueryRow({ q, onDone }: { q: Partial<BidQuery>; onDone: () => void }) {
  const [row, setRow] = useState<Partial<BidQuery>>(q);
  const [msg, setMsg] = useState<string | null>(null);
  const isNew = !q.id;
  return (
    <div className="card space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input className="input" placeholder="Name, e.g. Mowing and grounds" value={row.label ?? ""} onChange={(e) => setRow({ ...row, label: e.target.value })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={row.enabled ?? true} onChange={(e) => setRow({ ...row, enabled: e.target.checked })} /> On
        </label>
      </div>
      <input className="input font-mono text-xs" placeholder='mowing OR "grounds maintenance"' value={row.query ?? ""} onChange={(e) => setRow({ ...row, query: e.target.value })} />
      <div className="flex items-center gap-2">
        <button
          className="btn-primary"
          onClick={async () => {
            const err = await send("/api/bids/queries", "POST", row);
            setMsg(err ?? "Saved");
            if (!err) onDone();
          }}
        >
          {isNew ? "Add search" : "Save"}
        </button>
        {!isNew && (
          <button
            className="btn-secondary"
            onClick={async () => {
              if (!confirm(`Delete "${row.label}"?`)) return;
              const err = await send(`/api/bids/queries?id=${q.id}`, "DELETE");
              setMsg(err);
              if (!err) onDone();
            }}
          >
            Delete
          </button>
        )}
        {msg && <span className="text-sm text-stone-500">{msg}</span>}
      </div>
    </div>
  );
}

export function BidQueriesEditor({ queries }: { queries: BidQuery[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(0);
  const nextOrder = (queries.at(-1)?.sort_order ?? 0) + 1;
  return (
    <div className="space-y-2">
      {queries.map((q) => <BidQueryRow key={q.id} q={q} onDone={() => router.refresh()} />)}
      <BidQueryRow key={`new-${adding}`} q={{ sort_order: nextOrder, enabled: true }} onDone={() => { setAdding((n) => n + 1); router.refresh(); }} />
    </div>
  );
}
