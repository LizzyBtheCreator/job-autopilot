import { currentUserEmail, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { BID_STATUS_LABELS, type BidStatus } from "@/lib/bid-types";

function money(v: unknown): number | null {
  if (v === null || v === "" || v === undefined) return null;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

// Body may include: status, contractor_cost, bid_price, notes, due_date.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await currentUserEmail())) return unauthorized();
  const { id } = await ctx.params;
  const b = (await req.json()) as Record<string, unknown>;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.status !== undefined) {
    if (!(String(b.status) in BID_STATUS_LABELS)) return Response.json({ error: "Invalid status" }, { status: 400 });
    update.status = b.status as BidStatus;
    if (b.status === "submitted") update.submitted_at = new Date().toISOString();
  }
  if ("contractor_cost" in b) update.contractor_cost = money(b.contractor_cost);
  if ("bid_price" in b) update.bid_price = money(b.bid_price);
  if ("notes" in b) update.notes = String(b.notes ?? "").trim() || null;
  if ("due_date" in b) {
    const d = String(b.due_date ?? "");
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return Response.json({ error: "Due date must be a date" }, { status: 400 });
    update.due_date = d || null;
    if (d) update.due_text = "Entered by you";
  }
  const { error } = await db().from("bids").update(update).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
