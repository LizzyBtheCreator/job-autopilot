"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JobStatus } from "@/lib/types";

async function call(url: string, init: RequestInit): Promise<string | null> {
  try {
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    if (res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return body.error ?? `Request failed (${res.status})`;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export function SearchButton() {
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
          const err = await call("/api/search", { method: "POST" });
          setError(err);
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? "Searching... (about 20 seconds)" : "Run search"}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}

export function GenerateButton({ id, label = "Generate resume" }: { id: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        className="btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          setError(await call(`/api/jobs/${id}/generate`, { method: "POST" }));
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? "Writing... (1 to 3 minutes)" : label}
      </button>
      {error && <span className="max-w-xs text-xs text-red-600">{error}</span>}
    </span>
  );
}

// Generates one at a time so each request stays inside Vercel's time limit.
export function GenerateAllButton({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [done, setDone] = useState<number | null>(null);
  const [failed, setFailed] = useState(0);
  if (!ids.length) return null;
  const running = done !== null && done < ids.length;
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <button
        className="btn-secondary"
        disabled={running}
        onClick={async () => {
          setDone(0);
          setFailed(0);
          for (let i = 0; i < ids.length; i++) {
            const err = await call(`/api/jobs/${ids[i]}/generate`, { method: "POST" });
            if (err) setFailed((f) => f + 1);
            setDone(i + 1);
            router.refresh();
          }
        }}
      >
        {running ? `Writing ${done! + 1} of ${ids.length}...` : `Generate all ${ids.length} on this page`}
      </button>
      {done !== null && !running && <span>Done. {failed ? `${failed} failed, see the Error tab.` : ""}</span>}
    </span>
  );
}

export function StatusButton({ id, status, label, primary }: { id: string; status: JobStatus; label: string; primary?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={primary ? "btn-primary" : "btn-secondary"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const err = await call(`/api/jobs/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
        if (err) alert(err);
        setBusy(false);
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}

export function ResumeEditor({ id, resume }: { id: string; resume: string }) {
  const router = useRouter();
  const [text, setText] = useState(resume);
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <textarea
        className="input h-[70vh] font-mono text-[13px] leading-relaxed"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn-primary"
          disabled={busy || saved}
          onClick={async () => {
            setBusy(true);
            const err = await call(`/api/jobs/${id}`, { method: "PATCH", body: JSON.stringify({ resume: text }) });
            setBusy(false);
            setMsg(err ?? "Saved");
            if (!err) setSaved(true);
            router.refresh();
          }}
        >
          Save edits
        </button>
        <button
          className="btn-secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setMsg("Copied");
          }}
        >
          Copy text
        </button>
        <a
          className="btn-secondary"
          download="Elizabeth-McMillan-Resume.txt"
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
        >
          Download .txt
        </a>
        <a className="btn-secondary" href={`/jobs/${id}/print`} target="_blank" rel="noreferrer">
          Print / Save as PDF
        </a>
        {!saved && <span className="text-sm text-amber-600">Unsaved changes</span>}
        {msg && saved && <span className="text-sm text-stone-500">{msg}</span>}
      </div>
    </div>
  );
}

export function PrintButton() {
  return (
    <button className="btn-primary print:hidden" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}

export function ClearNewButton({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  if (!count) return null;
  return (
    <button
      className="btn-secondary"
      disabled={busy}
      onClick={async () => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setBusy(true);
        const err = await call("/api/jobs/clear-new", { method: "POST" });
        if (err) alert(err);
        setBusy(false);
        setArmed(false);
        router.refresh();
      }}
    >
      {armed ? `Click again to remove all ${count} New jobs` : "Clear New list"}
    </button>
  );
}
