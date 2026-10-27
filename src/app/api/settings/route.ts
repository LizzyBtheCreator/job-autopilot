import { currentUserEmail, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  if (!(await currentUserEmail())) return unauthorized();
  const b = (await req.json()) as Record<string, unknown>;
  const update = {
    review_required: Boolean(b.review_required),
    min_salary: Math.max(0, Math.round(Number(b.min_salary) || 0)),
    recency: ["d", "w", "m", "y", "any"].includes(String(b.recency)) ? String(b.recency) : "m",
    results_per_query: Math.min(100, Math.max(10, Math.round(Number(b.results_per_query) || 20))),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db().from("app_settings").update(update).eq("id", 1);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
