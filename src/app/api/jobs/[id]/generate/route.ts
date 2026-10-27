import { currentUserEmail, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateResume } from "@/lib/resume";
import { loadSettings } from "@/lib/search";
import type { Job } from "@/lib/types";

export const maxDuration = 300;

// Problems with the Anthropic account rather than this job. These pause automatic tailoring.
function accountProblem(message: string): string | null {
  if (/credit balance is too low|billing/i.test(message))
    return "Anthropic API credits ran out. Add credits at console.anthropic.com under Billing, then press Resume.";
  if (/authentication_error|invalid x-api-key|401/i.test(message))
    return "The ANTHROPIC_API_KEY in Vercel was rejected. Check the key, then press Resume.";
  if (/rate_limit_error|overloaded_error|\b429\b|\b529\b/i.test(message))
    return "Anthropic is busy or rate limiting right now. Wait a few minutes, then press Resume.";
  return null;
}

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
    const raw = e instanceof Error ? e.message : String(e);
    const account = accountProblem(raw);
    // A failed attempt never hides an existing resume or loses the job's place in the queue.
    const previous = job.status === "generating" || job.status === "error" ? (job.resume ? "needs_review" : "new") : job.status;
    const status = account || job.resume ? previous : "error";
    await supabase
      .from("jobs")
      .update({ status, error: account ?? raw, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (account) return Response.json({ error: account, paused: true }, { status: 503 });
    return Response.json({ error: raw }, { status: 500 });
  }
}
