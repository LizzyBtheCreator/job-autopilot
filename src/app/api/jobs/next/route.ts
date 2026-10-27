import { currentUserEmail, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// The next job that still needs a tailored resume. A job stuck in "generating" for over
// 6 minutes (the tab was closed mid-run) is picked up again.
export async function GET() {
  if (!(await currentUserEmail())) return unauthorized();
  const stale = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  const { data, error } = await db()
    .from("jobs")
    .select("id, title")
    .is("resume", null)
    .or(`status.eq.new,and(status.eq.generating,updated_at.lt.${stale}),and(status.eq.error,error.ilike.*credit balance*)`)
    .order("last_seen_at", { ascending: false })
    .limit(1);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ next: data?.[0] ?? null });
}
