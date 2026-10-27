"use client";

import { useEffect, useRef, useState } from "react";
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

// Tailors a resume for every job that needs one, one at a time so each request stays inside
// Vercel's time limit. Starts by itself whenever this page is open and jobs are waiting.
export function AutoTailor({ pending }: { pending: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(0);
  const [current, setCurrent] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const stop = useRef(false);
  const active = useRef(false);

  async function run() {
    if (active.current) return;
    active.current = true;
    stop.current = false;
    setRunning(true);
    while (!stop.current) {
      const res = await fetch("/api/jobs/next", { cache: "no-store" }).catch(() => null);
      if (!res?.ok) { setLastError("Could not check for waiting jobs"); break; }
      const { next } = (await res.json()) as { next: { id: string; title: string } | null };
      if (!next) break;
      setCurrent(next.title);
      const err = await call(`/api/jobs/${next.id}/generate`, { method: "POST" });
      if (err) setLastError(`${next.title}: ${err}`);
      setDone((d) => d + 1);
      router.refresh();
    }
    setCurrent(null);
    setRunning(false);
    active.current = false;
    router.refresh();
  }

  useEffect(() => {
    if (pending > 0 && !paused && !active.current) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, paused]);

  if (!running && pending === 0 && done === 0) return null;
  return (
    <div className="card flex flex-wrap items-center gap-3 text-sm">
      {running ? (
        <>
          <span>
            Tailoring resumes automatically: {done} done{pending ? `, about ${Math.max(pending - (current ? 1 : 0), 0)} waiting` : ""}.
            {current && <> Working on <b>{current}</b> (1 to 3 minutes each).</>} Keep this page open.
          </span>
          <button className="btn-secondary" onClick={() => { stop.current = true; setPaused(true); }}>Pause</button>
        </>
      ) : paused && pending > 0 ? (
        <>
          <span>Paused with {pending} jobs waiting.</span>
          <button className="btn-primary" onClick={() => setPaused(false)}>Resume</button>
        </>
      ) : (
        <span>All found jobs have a tailored resume. {done ? `${done} written this session.` : ""}</span>
      )}
      {lastError && <span className="w-full text-xs text-red-600">Last problem: {lastError}</span>}
    </div>
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
