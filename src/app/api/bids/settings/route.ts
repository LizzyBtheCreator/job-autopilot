import { currentUserEmail, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  if (!(await currentUserEmail())) return unauthorized();
  const b = (await req.json()) as Record<string, unknown>;
  const states = (Array.isArray(b.states) ? b.states : String(b.states ?? "").split(","))
    .map((s) => String(s).trim())
    .filter(Boolean);
  const update = { states, updated_at: new Date().toISOString() };
  const { error } = await db().from("bid_settings").update(update).eq("id", 1);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
