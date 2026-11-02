import { currentUserEmail, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";

// Removes New bids you haven't priced or noted, so the next search checks them again from scratch.
export async function POST() {
  if (!(await currentUserEmail())) return unauthorized();
  const { error } = await db()
    .from("bids")
    .delete()
    .eq("status", "new")
    .is("contractor_cost", null)
    .is("bid_price", null)
    .is("notes", null);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
