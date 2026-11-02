import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadBidSettings } from "@/lib/bids";
import type { BidQuery } from "@/lib/bid-types";
import { BidQueriesEditor, BidSettingsForm } from "@/components/bids";

export const dynamic = "force-dynamic";

export default async function BidSettingsPage() {
  if (!(await currentUserEmail())) redirect("/login");
  let settings;
  try {
    settings = await loadBidSettings();
  } catch (e) {
    return <div className="card border-red-300 text-red-700">{e instanceof Error ? e.message : String(e)}</div>;
  }
  const { data } = await db().from("bid_queries").select("*").order("sort_order");

  return (
    <div className="space-y-6">
      <Link href="/bids" className="text-sm text-teal-700 underline">Back to bids</Link>
      <section className="space-y-2">
        <h1 className="text-lg font-semibold">Bid settings</h1>
        <BidSettingsForm settings={settings} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Services to search for</h2>
        <p className="text-sm text-stone-500">
          Each search&apos;s words are matched against the titles of open bids on the state portals. Use OR between words
          that mean the same service, and put phrases in quotes. A word matches the start of a word in the title, so
          &quot;mow&quot; finds mowing and mower.
        </p>
        <BidQueriesEditor queries={(data ?? []) as BidQuery[]} />
      </section>

      <section className="card text-sm text-stone-600 dark:text-stone-400">
        <h2 className="mb-1 font-semibold text-stone-900 dark:text-stone-100">Where bids come from</h2>
        <ul className="ml-5 list-disc space-y-1">
          <li>North Carolina: NC eVP (evp.nc.gov), which covers state agencies, community colleges and universities, and many cities, counties, and school systems.</li>
          <li>Georgia: the Georgia Procurement Registry (pur.doas.ga.gov), which covers state agencies, counties, cities, and K-12 school systems.</li>
          <li>Only bids the portal marks Open, with a closing date of today or later, are saved. Each run refreshes the closing date of bids already in your list.</li>
          <li>No Google searches and no Serper credits are used.</li>
          <li>South Carolina and other states are not connected yet.</li>
        </ul>
      </section>
    </div>
  );
}
