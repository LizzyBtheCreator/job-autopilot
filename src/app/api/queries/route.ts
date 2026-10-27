import { currentUserEmail, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/types";

// Body: { id?, label, category, query, enabled, sort_order }. With id it updates, without it creates.
export async function POST(req: Request) {
  if (!(await currentUserEmail())) return unauthorized();
  const b = (await req.json()) as Record<string, unknown>;
  const category = String(b.category ?? "");
  const query = String(b.query ?? "").trim();
  const label = String(b.label ?? "").trim();
  if (!query || !label) return Response.json({ error: "Label and query are required" }, { status: 400 });
  if (!(category in CATEGORY_LABELS)) return Response.json({ error: "Unknown category" }, { status: 400 });

  const row = { label, category, query, enabled: b.enabled !== false, sort_order: Number(b.sort_order) || 0 };
  const supabase = db();
  const { error } = b.id
    ? await supabase.from("search_queries").update(row).eq("id", String(b.id))
    : await supabase.from("search_queries").insert(row);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await currentUserEmail())) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
  const { error } = await db().from("search_queries").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
