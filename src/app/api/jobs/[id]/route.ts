import { currentUserEmail, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { enforceRules } from "@/lib/resume";
import type { JobStatus } from "@/lib/types";

const ALLOWED: JobStatus[] = ["new", "needs_review", "ready", "applied", "dismissed"];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await currentUserEmail())) return unauthorized();
  const { id } = await ctx.params;
  const body = (await req.json()) as { status?: JobStatus; resume?: string };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) {
    if (!ALLOWED.includes(body.status)) return Response.json({ error: "Invalid status" }, { status: 400 });
    update.status = body.status;
    if (body.status === "applied") update.applied_at = new Date().toISOString();
  }
  if (typeof body.resume === "string") {
    // Your edits go through the same no-em-dash rule.
    update.resume = enforceRules(body.resume).text;
  }

  const { error } = await db().from("jobs").update(update).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
