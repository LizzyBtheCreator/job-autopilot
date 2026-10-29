"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RESPONSE_LABELS, type JobResponse, type JobStatus } from "@/lib/types";

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

// Record what happened after applying. Clicking the current answer clears it.
export function ResponseButtons({ id, response }: { id: string; response: JobResponse | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(Object.keys(RESPONSE_LABELS) as JobResponse[]).map((r) => (
        <button
          key={r}
          className={`rounded-md px-2.5 py-1 text-xs ${
            r === response ? "bg-teal-700 text-white" : "border border-stone-300 hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
          }`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const next = r === response ? null : r;
            const err = await call(`/api/jobs/${id}`, { method: "PATCH", body: JSON.stringify({ response: next }) });
            if (err) alert(err);
            setBusy(false);
            router.refresh();
          }}
        >
          {RESPONSE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}

// Saves a job description copied from the posting page, for sites that can't be read automatically.
export function PostingPaste({ id }: { id: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <textarea
        className="input h-40 text-xs"
        placeholder="Paste the full job description here"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <button
          className="btn-primary"
          disabled={busy || !text.trim()}
          onClick={async () => {
            setBusy(true);
            const err = await call(`/api/jobs/${id}`, { method: "PATCH", body: JSON.stringify({ description: text }) });
            setError(err);
            setBusy(false);
            if (!err) {
              setText("");
              router.refresh();
            }
          }}
        >
          Save job description
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}

export function ResumeEditor({ id, resume, fileName }: { id: string; resume: string; fileName: string }) {
  const router = useRouter();
  const [text, setText] = useState(resume);
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <textarea
        className={`input font-mono text-[13px] leading-relaxed ${resume ? "h-[70vh]" : "h-48"}`}
        placeholder="Paste the finished resume from Claude here, then press Save resume. This keeps it with the job so you can print it and track it."
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
          {resume ? "Save edits" : "Save resume"}
        </button>
        {resume && (
        <>
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
          download={`${fileName}.txt`}
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
        >
          Download .txt
        </a>
        <a className="btn-secondary" href={`/jobs/${id}/print`} target="_blank" rel="noreferrer">
          Print / Save as PDF
        </a>
        </>
        )}
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

// Copies the full prompt (posting, profile, rules) and opens a new Claude chat to paste it into.
// The prompt is already on the page, so the copy happens right on the click.
export function CopyForClaude({ prompt }: { prompt: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        className="btn-primary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(prompt);
            setMsg("Copied. In the new Claude tab, press Cmd+V, then Enter.");
            window.open("https://claude.ai/new", "_blank", "noopener");
          } catch {
            setMsg("Could not copy automatically. Use the box below: click it, press Cmd+A, then Cmd+C.");
          }
        }}
      >
        Copy for Claude
      </button>
      {msg && <span className="max-w-md text-xs text-stone-600 dark:text-stone-400">{msg}</span>}
    </span>
  );
}
