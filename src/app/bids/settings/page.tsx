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
          Each search runs on Google through Serper as: (bid wording) + (these words) + (your states), limited to
          government sites and public bid portals (BidNet Direct, Bonfire, OpenGov, DemandStar). Use OR between words that
          mean the same service, and put phrases in quotes.
        </p>
        <BidQueriesEditor queries={(data ?? []) as BidQuery[]} />
      </section>

      <section className="card text-sm text-stone-600 dark:text-stone-400">
        <h2 className="mb-1 font-semibold text-stone-900 dark:text-stone-100">Filters that always apply</h2>
        <ul className="ml-5 list-disc space-y-1">
          <li>No federal bids: federal sites (sam.gov, .mil, federal agencies) and bids that cite federal acquisition rules are dropped.</li>
          <li>Award notices, bid results, and pages that list many bids are dropped, so each result is one bid.</li>
          <li>Every new bid&apos;s page is opened and read. Closed, awarded, or cancelled bids and bids past their due date are dropped.</li>
          <li>The due date is read from the page when it can be. When it can&apos;t, the bid says so instead of guessing.</li>
          <li>License, insurance, bond, and mandatory site visit requirements found on the page are flagged on the bid.</li>
          <li>PDF bids can&apos;t be read yet: they are kept and flagged so you can open them.</li>
          <li>Every dropped result is listed on the Bids page with its reason.</li>
        </ul>
      </section>
    </div>
  );
}
