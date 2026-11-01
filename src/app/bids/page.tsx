import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { BID_STATUS_LABELS, type Bid, type BidRun, type BidStatus } from "@/lib/bid-types";
import { BidSearchButton, BidStatusButton } from "@/components/bids";
import { Flags } from "@/components/badges";

export const dynamic = "force-dynamic";

const TABS: (BidStatus | "all")[] = ["new", "bidding", "submitted", "won", "lost", "dismissed", "all"];

const BID_STATUS_COLORS: Record<BidStatus, string> = {
  new: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  bidding: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  submitted: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  lost: "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
  dismissed: "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
};

function fmt(ts: string) {
  return new Date(ts).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
}

function dueLabel(due: string | null) {
  if (!due) return { text: "Due date: check the bid", cls: "text-amber-700 dark:text-amber-400" };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const days = Math.round((Date.parse(due) - Date.parse(today)) / 86400000);
  const date = new Date(`${due}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
  if (days < 0) return { text: `Was due ${date}`, cls: "text-stone-500" };
  if (days === 0) return { text: `Due today, ${date}`, cls: "text-red-600 font-medium" };
  return { text: `Due ${date} (${days} day${days === 1 ? "" : "s"})`, cls: days <= 5 ? "text-red-600 font-medium" : "text-stone-700 dark:text-stone-300" };
}

export default async function BidsPage({ searchParams }: { searchParams: Promise<{ status?: string; run?: string }> }) {
  if (!(await currentUserEmail())) redirect("/login");
  const { status: rawStatus, run: runFilter } = await searchParams;
  const status = (TABS as string[]).includes(rawStatus ?? "") ? (rawStatus as BidStatus | "all") : "new";
  const supabase = db();

  const [{ data: runs, error: runErr }, { data: statusRows }] = await Promise.all([
    supabase.from("bid_runs").select("*").order("started_at", { ascending: false }).limit(1),
    supabase.from("bids").select("status"),
  ]);
  if (runErr) {
    return (
      <div className="card border-red-300 text-red-700">
        Could not read the bid tables: {runErr.message}. Run <code>supabase/bids.sql</code> in the Supabase SQL Editor first.
      </div>
    );
  }
  const lastRun = (runs?.[0] ?? null) as BidRun | null;
  const counts: Record<string, number> = { all: statusRows?.length ?? 0 };
  for (const r of (statusRows ?? []) as { status: string }[]) counts[r.status] = (counts[r.status] ?? 0) + 1;

  let q = supabase.from("bids").select("*").order("due_date", { ascending: true, nullsFirst: false }).limit(300);
  if (status !== "all") q = q.eq("status", status);
  if (runFilter && lastRun && runFilter === lastRun.id) q = q.eq("last_run_id", runFilter);
  const { data: bidRows } = await q;
  const bids = (bidRows ?? []) as Bid[];

  const droppedByReason = new Map<string, BidRun["dropped"]>();
  for (const d of lastRun?.dropped ?? []) {
    const key = d.reason.replace(/\s*\(.*\)$/, "");
    droppedByReason.set(key, [...(droppedByReason.get(key) ?? []), d]);
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">State and local bids</h1>
            <p className="text-xs text-stone-500">Separate from the job search. <Link className="underline" href="/bids/settings">Bid settings and searches</Link></p>
          </div>
          <BidSearchButton />
        </div>
        {lastRun ? (
          <div className="space-y-2 text-sm">
            <p>
              Last run {fmt(lastRun.started_at)}: <b>{lastRun.total_returned}</b> results from Google, <b>{lastRun.total_new}</b> new bids,{" "}
              <b>{lastRun.total_seen_before}</b> already in your list, <b>{lastRun.total_dropped}</b> filtered out.{" "}
              {lastRun.total_new + lastRun.total_seen_before > 0 && (
                <Link className="text-teal-700 underline" href={`/bids?status=all&run=${lastRun.id}`}>Show this run&apos;s bids</Link>
              )}
            </p>
            {!lastRun.finished_at && <p className="text-amber-700">This run did not finish. Try again.</p>}
            {lastRun.error && <p className="text-red-600">{lastRun.error}</p>}
            <details>
              <summary className="cursor-pointer text-stone-600 dark:text-stone-400">Results by search</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-stone-500">
                    <tr><th className="py-1 pr-3">Search</th><th className="pr-3">Returned</th><th className="pr-3">New</th><th className="pr-3">Already listed</th><th className="pr-3">Filtered</th><th>Notes</th></tr>
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
          <p className="text-sm text-stone-500">No bid searches yet. Press Find bids.</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <Link
              key={t}
              href={`/bids?status=${t}`}
              className={`rounded-md px-3 py-1 text-sm ${t === status ? "bg-teal-700 text-white" : "bg-white text-stone-700 hover:bg-stone-100 dark:bg-stone-900 dark:text-stone-300"}`}
            >
              {t === "all" ? "All" : BID_STATUS_LABELS[t]} ({counts[t] ?? 0})
            </Link>
          ))}
        </div>

        {bids.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing here.</p>
        ) : (
          <ul className="space-y-2">
            {bids.map((b) => {
              const due = dueLabel(b.due_date);
              return (
                <li key={b.id} className="card flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/bids/${b.id}`} className="font-medium hover:underline">{b.title}</Link>
                      <span className={`badge ${BID_STATUS_COLORS[b.status]}`}>{BID_STATUS_LABELS[b.status]}</span>
                    </div>
                    <p className="text-sm text-stone-600 dark:text-stone-400">
                      {b.agency ?? "Agency not found"} · {b.state ?? "State not confirmed"} · {b.query_label}
                    </p>
                    <p className={`text-sm ${due.cls}`}>{due.text}</p>
                    {b.snippet && <p className="mt-1 line-clamp-2 text-xs text-stone-500">{b.snippet}</p>}
                    <Flags flags={b.flags} />
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <a className="btn-secondary" href={b.url} target="_blank" rel="noreferrer">Open bid</a>
                    <Link className="btn-primary" href={`/bids/${b.id}`}>Price it</Link>
                    {b.status !== "dismissed" && <BidStatusButton id={b.id} status="dismissed" label="Dismiss" />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
