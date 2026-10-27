"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, type Category, type SearchQuery, type Settings } from "@/lib/types";

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (res.ok) return null;
  const b = (await res.json().catch(() => ({}))) as { error?: string };
  return b.error ?? `Request failed (${res.status})`;
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="card space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const err = await send("/api/settings", "POST", s);
        setMsg(err ?? "Saved");
        router.refresh();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          Minimum salary ($)
          <input className="input mt-1" type="number" step={1000} value={s.min_salary} onChange={(e) => setS({ ...s, min_salary: Number(e.target.value) })} />
          <span className="text-xs text-stone-500">Jobs with no salary listed always pass.</span>
        </label>
        <label className="block text-sm">
          Posted within
          <select className="input mt-1" value={s.recency} onChange={(e) => setS({ ...s, recency: e.target.value as Settings["recency"] })}>
            <option value="d">Past day</option>
            <option value="w">Past week</option>
            <option value="m">Past month</option>
            <option value="y">Past year</option>
            <option value="any">Any time</option>
          </select>
        </label>
        <label className="block text-sm">
          Results per query
          <input className="input mt-1" type="number" min={10} max={100} step={10} value={s.results_per_query} onChange={(e) => setS({ ...s, results_per_query: Number(e.target.value) })} />
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

function QueryRow({ q, onDone }: { q: Partial<SearchQuery>; onDone: () => void }) {
  const [row, setRow] = useState<Partial<SearchQuery>>(q);
  const [msg, setMsg] = useState<string | null>(null);
  const isNew = !q.id;
  return (
    <div className="card space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_14rem_auto]">
        <input className="input" placeholder="Label" value={row.label ?? ""} onChange={(e) => setRow({ ...row, label: e.target.value })} />
        <select className="input" value={row.category ?? "proposals"} onChange={(e) => setRow({ ...row, category: e.target.value as Category })}>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={row.enabled ?? true} onChange={(e) => setRow({ ...row, enabled: e.target.checked })} /> On
        </label>
      </div>
      <textarea className="input font-mono text-xs" rows={2} placeholder='"proposal manager" OR "capture manager" remote job' value={row.query ?? ""} onChange={(e) => setRow({ ...row, query: e.target.value })} />
      <div className="flex items-center gap-2">
        <button
          className="btn-primary"
          onClick={async () => {
            const err = await send("/api/queries", "POST", { ...row, category: row.category ?? "proposals" });
            setMsg(err ?? "Saved");
            if (!err) onDone();
          }}
        >
          {isNew ? "Add query" : "Save"}
        </button>
        {!isNew && (
          <button
            className="btn-secondary"
            onClick={async () => {
              if (!confirm(`Delete "${row.label}"?`)) return;
              const err = await send(`/api/queries?id=${q.id}`, "DELETE");
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

export function QueriesEditor({ queries }: { queries: SearchQuery[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(0);
  const nextOrder = (queries.at(-1)?.sort_order ?? 0) + 1;
  return (
    <div className="space-y-2">
      {queries.map((q) => <QueryRow key={q.id} q={q} onDone={() => router.refresh()} />)}
      <QueryRow key={`new-${adding}`} q={{ sort_order: nextOrder, enabled: true }} onDone={() => { setAdding((n) => n + 1); router.refresh(); }} />
    </div>
  );
}
