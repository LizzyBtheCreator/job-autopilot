import { currentUserEmail, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";

// Removes every job still in New. Jobs with a resume, applied or dismissed are kept.
// The next search finds any real postings again.
export async function POST() {
  if (!(await currentUserEmail())) return unauthorized();
  const { error, count } = await db().from("jobs").delete({ count: "exact" }).eq("status", "new").is("resume", null);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ removed: count ?? 0 });
}
