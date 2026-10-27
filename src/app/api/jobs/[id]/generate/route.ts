import { currentUserEmail, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateResume } from "@/lib/resume";
import { loadSettings } from "@/lib/search";
import type { Job } from "@/lib/types";

export const maxDuration = 300;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await currentUserEmail())) return unauthorized();
  const { id } = await ctx.params;
  const supabase = db();

  const { data, error } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (error || !data) return Response.json({ error: "Job not found" }, { status: 404 });
  const job = data as Job;

  await supabase.from("jobs").update({ status: "generating", error: null, updated_at: new Date().toISOString() }).eq("id", id);

  try {
    const settings = await loadSettings();
    const out = await generateResume(job, settings);
    const status = settings.review_required ? "needs_review" : "ready";
    const { error: upErr } = await supabase
      .from("jobs")
      .update({
        status,
        resume: out.resume,
        requirements: out.requirements,
        description: out.description,
        flags: out.flags,
        salary_text: out.salary_text,
        company: out.requirements.company_name || job.company,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (upErr) throw new Error(`Could not save resume: ${upErr.message}`);
    return Response.json({ status });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("jobs").update({ status: "error", error: message, updated_at: new Date().toISOString() }).eq("id", id);
    return Response.json({ error: message }, { status: 500 });
  }
}
