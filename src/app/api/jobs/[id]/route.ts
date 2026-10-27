import { currentUserEmail, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { enforceRules } from "@/lib/resume";
import { RESPONSE_LABELS, type JobResponse, type JobStatus } from "@/lib/types";

const ALLOWED: JobStatus[] = ["new", "needs_review", "ready", "applied", "dismissed"];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await currentUserEmail())) return unauthorized();
  const { id } = await ctx.params;
  const body = (await req.json()) as { status?: JobStatus; resume?: string; response?: JobResponse | null };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) {
    if (!ALLOWED.includes(body.status)) return Response.json({ error: "Invalid status" }, { status: 400 });
    update.status = body.status;
    if (body.status === "applied") update.applied_at = new Date().toISOString();
  }
  if (body.response !== undefined) {
    if (body.response !== null && !(body.response in RESPONSE_LABELS)) {
      return Response.json({ error: "Invalid response" }, { status: 400 });
    }
    update.response = body.response;
    update.response_at = body.response ? new Date().toISOString() : null;
  }
  const supabase = db();
  if (typeof body.resume === "string") {
    // Pasted resumes and edits go through the same no-em-dash rule.
    const { text } = enforceRules(body.resume);
    update.resume = text || null;
    const { data: current } = await supabase.from("jobs").select("status").eq("id", id).single();
    if (text) {
      update.generated_at = new Date().toISOString();
      update.error = null;
      const st = (current?.status as string | undefined) ?? "new";
      if (!body.status && ["new", "generating", "error", "needs_review"].includes(st)) update.status = "ready";
    }
  }

  const { error } = await supabase.from("jobs").update(update).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
