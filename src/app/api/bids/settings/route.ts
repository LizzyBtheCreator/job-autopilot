import { currentUserEmail, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  if (!(await currentUserEmail())) return unauthorized();
  const b = (await req.json()) as Record<string, unknown>;
  const states = (Array.isArray(b.states) ? b.states : String(b.states ?? "").split(","))
    .map((s) => String(s).trim())
    .filter(Boolean);
  const bidTerms = String(b.bid_terms ?? "").trim();
  if (!bidTerms) return Response.json({ error: "Bid wording is required" }, { status: 400 });
  const update = {
    states,
    bid_terms: bidTerms,
    recency: ["d", "w", "m", "y", "any"].includes(String(b.recency)) ? String(b.recency) : "m",
    results_per_query: Math.min(100, Math.max(10, Math.round(Number(b.results_per_query) || 20))),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db().from("bid_settings").update(update).eq("id", 1);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
