import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { CATEGORY_LABELS, STATUS_LABELS, type Job, type JobStatus, type SearchRun } from "@/lib/types";
import { AutoTailor, ClearNewButton, GenerateButton, SearchButton, StatusButton } from "@/components/actions";
import { Flags, StatusBadge } from "@/components/badges";

export const dynamic = "force-dynamic";

const TABS: (JobStatus | "all")[] = ["new", "needs_review", "ready", "applied", "error", "dismissed", "all"];

function fmt(ts: string) {
  return new Date(ts).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ status?: string; run?: string }> }) {
  if (!(await currentUserEmail())) redirect("/login");
  const { status: rawStatus, run: runFilter } = await searchParams;
  const status = (TABS as string[]).includes(rawStatus ?? "") ? (rawStatus as JobStatus | "all") : "new";
  const supabase = db();

  const [{ data: runs, error: runErr }, { data: statusRows }] = await Promise.all([
    supabase.from("search_runs").select("*").order("started_at", { ascending: false }).limit(1),
    supabase.from("jobs").select("status"),
  ]);
  if (runErr) {
    return (
      <div className="card border-red-300 text-red-700">
        Could not read the database: {runErr.message}. Run <code>supabase/schema.sql</code> in the Supabase SQL Editor first.
      </div>
    );
  }
  const lastRun = (runs?.[0] ?? null) as SearchRun | null;

  const { count: pendingCount } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .is("resume", null)
    .or("status.in.(new,generating),and(status.eq.error,error.ilike.*credit balance*)");

  const counts: Record<string, number> = { all: statusRows?.length ?? 0 };
  for (const r of (statusRows ?? []) as { status: string }[]) counts[r.status] = (counts[r.status] ?? 0) + 1;
  counts.new = (counts.new ?? 0) + (counts.generating ?? 0);

  let q = supabase.from("jobs").select("*").order("last_seen_at", { ascending: false }).limit(300);
  if (status === "new") q = q.in("status", ["new", "generating"]);
  else if (status !== "all") q = q.eq("status", status);
  if (runFilter && lastRun && runFilter === lastRun.id) q = q.eq("last_run_id", runFilter);
  const { data: jobRows } = await q;
  const jobs = (jobRows ?? []) as Job[];

  const droppedByReason = new Map<string, SearchRun["dropped"]>();
  for (const d of lastRun?.dropped ?? []) {
    const key = d.reason.replace(/\s*\(.*\)$/, "");
    droppedByReason.set(key, [...(droppedByReason.get(key) ?? []), d]);
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">Search</h1>
          <SearchButton />
        </div>
        {lastRun ? (
          <div className="space-y-2 text-sm">
            <p>
              Last run {fmt(lastRun.started_at)}: <b>{lastRun.total_returned}</b> results from Google,{" "}
              <b>{lastRun.total_new}</b> new, <b>{lastRun.total_seen_before}</b> already in your list,{" "}
              <b>{lastRun.total_dropped}</b> filtered out.{" "}
              {lastRun.total_new + lastRun.total_seen_before > 0 && (
                <Link className="text-teal-700 underline" href={`/?status=all&run=${lastRun.id}`}>Show this run&apos;s jobs</Link>
              )}
            </p>
            {!lastRun.finished_at && <p className="text-amber-700">This run did not finish. Try running the search again.</p>}
            {lastRun.error && <p className="text-red-600">{lastRun.error}</p>}
            <details>
              <summary className="cursor-pointer text-stone-600 dark:text-stone-400">Results by query</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-stone-500">
                    <tr><th className="py-1 pr-3">Query</th><th className="pr-3">Returned</th><th className="pr-3">New</th><th className="pr-3">Already listed</th><th className="pr-3">Filtered</th><th>Notes</th></tr>
                  </thead>
                  <tbody>
                    {lastRun.per_query.map((p) => (
                      <tr key={p.label} className="border-t border-stone-200 dark:border-stone-800">
                        <td className="py-1 pr-3" title={p.query}>{p.label}</td>
                        <td className="pr-3">{p.returned}</td>
                        <td className="pr-3">{p.new}</td>
                        <td className="pr-3">{p.seen_before}</td>
                        <td className="pr-3">{p.dropped}</td>
                        <td className={p.error ? "text-red-600" : "text-stone-500"}>{p.error ?? p.note ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            {droppedByReason.size > 0 && (
              <details>
                <summary className="cursor-pointer text-stone-600 dark:text-stone-400">What was filtered out, and why</summary>
                <div className="mt-2 space-y-2">
                  {[...droppedByReason.entries()].map(([reason, items]) => (
                    <details key={reason} className="ml-3">
                      <summary className="cursor-pointer">{reason} ({items.length})</summary>
                      <ul className="ml-4 mt-1 space-y-1 text-xs">
                        {items.map((d, i) => (
                          <li key={i}>
                            <a className="underline" href={d.url} target="_blank" rel="noreferrer">{d.title || d.url}</a>{" "}
                            <span className="text-stone-500">{d.reason} · {d.query_label}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              </details>
            )}
          </div>
        ) : (
          <p className="text-sm text-stone-500">No searches yet. Press Run search.</p>
        )}
      </section>

      <AutoTailor pending={pendingCount ?? 0} />

      <section className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <Link
              key={t}
              href={`/?status=${t}`}
              className={`rounded-md px-3 py-1 text-sm ${t === status ? "bg-teal-700 text-white" : "bg-white text-stone-700 hover:bg-stone-100 dark:bg-stone-900 dark:text-stone-300"}`}
            >
              {t === "all" ? "All" : STATUS_LABELS[t]} ({counts[t] ?? 0})
            </Link>
          ))}
        </div>

        {status === "new" && (
          <div className="flex flex-wrap gap-2">
            <ClearNewButton count={jobs.filter((j) => j.status === "new" && !j.resume).length} />
          </div>
        )}

        {jobs.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing here.</p>
        ) : (
          <ul className="space-y-2">
            {jobs.map((job) => (
              <li key={job.id} className="card flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">{job.title}</Link>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="text-sm text-stone-600 dark:text-stone-400">
                    {job.company ?? "Unknown company"} · {CATEGORY_LABELS[job.category] ?? job.category} ·{" "}
                    {job.salary_text ?? "Salary not listed"}
                  </p>
                  {job.snippet && <p className="mt-1 line-clamp-2 text-xs text-stone-500">{job.snippet}</p>}
                  <Flags flags={job.flags} />
                  {job.error && <p className="mt-1 text-xs text-red-600">{job.error}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <a className="btn-secondary" href={job.url} target="_blank" rel="noreferrer">Posting</a>
                  {(job.status === "new" || job.status === "error" || job.status === "generating") && (
                    <GenerateButton id={job.id} label={job.status === "new" ? "Generate resume" : "Retry"} />
                  )}
                  {job.resume && <Link className="btn-secondary" href={`/jobs/${job.id}`}>Resume</Link>}
                  {job.status !== "dismissed" && job.status !== "applied" && (
                    <StatusButton id={job.id} status="dismissed" label="Dismiss" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
