import { redirect } from "next/navigation";
import { currentUserEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { EXCLUDED_SITES, loadSettings } from "@/lib/search";
import type { SearchQuery } from "@/lib/types";
import { QueriesEditor, SettingsForm } from "@/components/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!(await currentUserEmail())) redirect("/login");
  const settings = await loadSettings();
  const { data } = await db().from("search_queries").select("*").order("sort_order");

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-lg font-semibold">Settings</h1>
        <SettingsForm settings={settings} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Search queries</h2>
        <p className="text-sm text-stone-500">
          Each query runs on Google through Serper, limited to employer application sites so every result is a single
          posting. The sites go out in two searches per query: Greenhouse, Lever, Ashby, Workable and iCIMS, then
          SmartRecruiters, Jobvite, BambooHR, Breezy, Recruitee, Rippling and JazzHR. Workday is not searched. When Serper
          returns only 10 results at a time, up to 3 pages are read per search, set by Results per query (20 means 2
          pages), and each page uses one Serper search. If your Serper plan does not allow application sites, it
          searches the open web instead and leaves out these sites: {EXCLUDED_SITES.join(", ")}.
        </p>
        <QueriesEditor queries={(data ?? []) as SearchQuery[]} />
      </section>

      <section className="card text-sm text-stone-600 dark:text-stone-400">
        <h2 className="mb-1 font-semibold text-stone-900 dark:text-stone-100">Filters that always apply</h2>
        <ul className="ml-5 list-disc space-y-1">
          <li>Remote only. A result is dropped only when it clearly says on-site or hybrid and never says remote.</li>
          <li>Salary at or above your minimum. No salary listed counts as passing.</li>
          <li>No roles that require an active security clearance. &quot;Able to obtain&quot; is allowed.</li>
          <li>When you open a job, the full posting is checked again and anything that slipped through is flagged on the job.</li>
        </ul>
      </section>
    </div>
  );
}
