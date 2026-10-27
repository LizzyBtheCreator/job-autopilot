import type { JobResponse, JobStatus } from "@/lib/types";
import { RESPONSE_LABELS, STATUS_LABELS } from "@/lib/types";

const STATUS_COLORS: Record<JobStatus, string> = {
  new: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  generating: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  needs_review: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  ready: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  applied: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  dismissed: "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
  error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={`badge ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>;
}

const RESPONSE_COLORS: Record<JobResponse, string> = {
  heard_back: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  interview: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  offer: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
};

export function ResponseBadge({ response }: { response: JobResponse | null }) {
  if (!response) return null;
  return <span className={`badge ${RESPONSE_COLORS[response]}`}>{RESPONSE_LABELS[response]}</span>;
}

export function Flags({ flags }: { flags: string[] }) {
  if (!flags.length) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {flags.map((f) => (
        <li key={f} className="text-xs text-amber-700 dark:text-amber-400">⚠ {f}</li>
      ))}
    </ul>
  );
}
