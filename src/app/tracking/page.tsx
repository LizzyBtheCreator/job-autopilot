import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { CATEGORY_LABELS, type Job } from "@/lib/types";
import { ResponseButtons } from "@/components/actions";
import { ResponseBadge } from "@/components/badges";

export const dynamic = "force-dynamic";

const TZ = "America/New_York";
const DAYS_SHOWN = 14;

// The calendar day in Eastern time, as YYYY-MM-DD.
function dayKey(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

function dayLabel(key: string) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
}

interface Row {
  name: string;
  applied: number;
  positive: number;
  interviews: number;
  rejected: number;
  waiting: number;
}

// Heard back, interview, and offer all count as a positive reply.
function tally(name: string, jobs: Job[]): Row {
  const row: Row = { name, applied: jobs.length, positive: 0, interviews: 0, rejected: 0, waiting: 0 };
  for (const j of jobs) {
    if (!j.response) row.waiting++;
    else if (j.response === "rejected") row.rejected++;
    else row.positive++;
    if (j.response === "interview" || j.response === "offer") row.interviews++;
  }
  return row;
}

function groupBy(jobs: Job[], key: (j: Job) => string): Row[] {
  const groups = new Map<string, Job[]>();
  for (const j of jobs) groups.set(key(j), [...(groups.get(key(j)) ?? []), j]);
  return [...groups.entries()]
    .map(([name, list]) => tally(name, list))
    .sort((a, b) => b.positive / b.applied - a.positive / a.applied || b.applied - a.applied);
}

function pct(n: number, d: number) {
  return d ? `${Math.round((n / d) * 100)}%` : "-";
}

function RateTable({ title, rows, total }: { title: string; rows: Row[]; total: Row }) {
  return (
    <section className="card space-y-2">
      <h2 className="font-semibold">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-stone-500">
            <tr>
              <th className="py-1 pr-3"></th>
              <th className="pr-3">Applied</th>
              <th className="pr-3">Positive replies</th>
              <th className="pr-3">Reply rate</th>
              <th className="pr-3">Interviews</th>
              <th className="pr-3">Rejected</th>
              <th>No reply yet</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-stone-200 dark:border-stone-800">
                <td className="py-1.5 pr-3">{r.name}</td>
                <td className="pr-3">{r.applied}</td>
                <td className="pr-3">{r.positive}</td>
                <td className="pr-3 font-medium">{pct(r.positive, r.applied)}</td>
                <td className="pr-3">{r.interviews}</td>
                <td className="pr-3">{r.rejected}</td>
                <td>{r.waiting}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-stone-300 font-medium dark:border-stone-700">
              <td className="py-1.5 pr-3">Total</td>
              <td className="pr-3">{total.applied}</td>
              <td className="pr-3">{total.positive}</td>
              <td className="pr-3">{pct(total.positive, total.applied)}</td>
              <td className="pr-3">{total.interviews}</td>
              <td className="pr-3">{total.rejected}</td>
              <td>{total.waiting}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function TrackingPage() {
  if (!(await currentUserEmail())) redirect("/login");
  const { data, error } = await db()
    .from("jobs")
    .select("*")
    .eq("status", "applied")
    .order("applied_at", { ascending: false, nullsFirst: false });
  if (error) {
    return <div className="card border-red-300 text-red-700">Could not read the database: {error.message}</div>;
  }
  const jobs = (data ?? []) as Job[];
  const total = tally("Total", jobs);

  // Applications per day for the last two weeks, today first.
  const perDay = new Map<string, number>();
  for (const j of jobs) if (j.applied_at) {
    const k = dayKey(new Date(j.applied_at));
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => dayKey(new Date(Date.now() - i * 86400000)));
  const today = perDay.get(days[0]) ?? 0;
  const last7 = days.slice(0, 7).reduce((n, d) => n + (perDay.get(d) ?? 0), 0);
  const maxDay = Math.max(1, ...days.map((d) => perDay.get(d) ?? 0));

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Applied today", today],
          ["Last 7 days", last7],
          ["Total applied", total.applied],
          ["Reply rate", pct(total.positive, total.applied)],
        ].map(([label, value]) => (
          <div key={label} className="card">
            <p className="text-xs text-stone-500">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Applications per day</h2>
        <ul className="space-y-1 text-sm">
          {days.map((d) => {
            const n = perDay.get(d) ?? 0;
            return (
              <li key={d} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-stone-600 dark:text-stone-400">{dayLabel(d)}</span>
                <span className="h-3 rounded-sm bg-teal-600" style={{ width: `${(n / maxDay) * 60}%` }} />
                <span>{n}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <RateTable title="Replies by role type" rows={groupBy(jobs, (j) => CATEGORY_LABELS[j.category] ?? j.category)} total={total} />
      <RateTable title="Replies by search" rows={groupBy(jobs, (j) => j.query_label ?? "Added by hand")} total={total} />

      <section className="card space-y-2">
        <h2 className="font-semibold">Every application</h2>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          When an employer replies, mark it here. Heard back, Interview, and Offer count as positive replies.
        </p>
        {jobs.length === 0 ? (
          <p className="text-sm text-stone-500">No applications yet. Press Mark applied on a job after you submit it.</p>
        ) : (
          <ul className="divide-y divide-stone-200 dark:divide-stone-800">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/jobs/${j.id}`} className="font-medium hover:underline">{j.title}</Link>
                    <ResponseBadge response={j.response} />
                  </div>
                  <p className="text-xs text-stone-500">
                    {j.company ?? "Unknown company"} · {CATEGORY_LABELS[j.category] ?? j.category} · applied{" "}
                    {j.applied_at ? dayLabel(dayKey(new Date(j.applied_at))) : "date unknown"}
                  </p>
                </div>
                <ResponseButtons id={j.id} response={j.response} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
