import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { pastPricesUrl } from "@/lib/bids";
import { BID_STATUS_LABELS, type Bid, type BidStatus } from "@/lib/bid-types";
import { BidPricing, BidStatusButton } from "@/components/bids";
import { Flags } from "@/components/badges";

export const dynamic = "force-dynamic";

const NEXT_STEPS: { status: BidStatus; label: string }[] = [
  { status: "bidding", label: "Bidding on it" },
  { status: "submitted", label: "Mark submitted" },
  { status: "won", label: "Won" },
  { status: "lost", label: "Lost" },
  { status: "dismissed", label: "Dismiss" },
  { status: "new", label: "Back to New" },
];

export default async function BidPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUserEmail())) redirect("/login");
  const { id } = await params;
  const { data } = await db().from("bids").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const bid = data as Bid;
  const service = bid.query_label ?? bid.title;

  return (
    <div className="space-y-5">
      <Link href="/bids" className="text-sm text-teal-700 underline">Back to bids</Link>

      <section className="card space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">{bid.title}</h1>
          <span className="badge bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">{BID_STATUS_LABELS[bid.status]}</span>
        </div>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {bid.agency ?? "Agency not found"} · {bid.state ?? "State not confirmed"} · {bid.query_label}
        </p>
        <p className="text-sm">
          {bid.due_date ? <>Due <b>{bid.due_date}</b></> : <span className="text-amber-700">Due date not found: check the bid and enter it below.</span>}
          {bid.due_text && <span className="text-stone-500"> · found as &quot;{bid.due_text}&quot;</span>}
        </p>
        <Flags flags={bid.flags} />
        <div className="flex flex-wrap gap-2 pt-1">
          <a className="btn-primary" href={bid.url} target="_blank" rel="noreferrer">Open bid</a>
          {NEXT_STEPS.filter((s) => s.status !== bid.status).map((s) => (
            <BidStatusButton key={s.status} id={bid.id} status={s.status} label={s.label} />
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Price it</h2>
        <ol className="ml-5 list-decimal space-y-1 text-sm text-stone-600 dark:text-stone-400">
          <li>
            Open{" "}
            <a className="text-teal-700 underline" href={pastPricesUrl(service, bid.state)} target="_blank" rel="noreferrer">
              past bid results for {service.toLowerCase()}
            </a>{" "}
            to see what agencies paid for this work.
          </li>
          <li>Enter what you&apos;ll pay a contractor to do it, then pick a margin or type your bid price.</li>
          <li>Submit your bid on the agency&apos;s site, then press Mark submitted.</li>
        </ol>
        <BidPricing id={bid.id} contractorCost={bid.contractor_cost} bidPrice={bid.bid_price} dueDate={bid.due_date} notes={bid.notes} />
      </section>

      {bid.snippet && (
        <section className="card text-sm text-stone-600 dark:text-stone-400">
          <h2 className="mb-1 font-semibold text-stone-900 dark:text-stone-100">From the search result</h2>
          {bid.snippet}
        </section>
      )}
    </div>
  );
}
