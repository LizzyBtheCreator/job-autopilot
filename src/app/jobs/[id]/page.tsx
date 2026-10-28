import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { resumeFileName } from "@/lib/filename";
import { buildChatPrompt, companyFromPosting, fetchPosting, postingFlags } from "@/lib/resume";
import { loadSettings } from "@/lib/search";
import { CATEGORY_LABELS, type Job } from "@/lib/types";
import { CopyForClaude, ResponseButtons, ResumeEditor, StatusButton } from "@/components/actions";
import { Flags, ResponseBadge, StatusBadge } from "@/components/badges";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUserEmail())) redirect("/login");
  const { id } = await params;
  const supabase = db();
  const { data } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const job = data as Job;

  // The first time a job is opened, read the full posting and check it against the filters.
  if (!job.description) {
    const [posting, settings] = await Promise.all([fetchPosting(job.url), loadSettings()]);
    job.description = posting || null;
    job.flags = postingFlags(job, posting, settings);
    await supabase.from("jobs").update({ description: job.description, flags: job.flags }).eq("id", id);
  }
  // Search results often only show the job site's name; the posting has the real employer.
  const company = companyFromPosting(job.description);
  if (company && company !== job.company) {
    job.company = company;
    await supabase.from("jobs").update({ company }).eq("id", id);
  }
  const prompt = buildChatPrompt(job, job.description ?? `${job.title}\n${job.snippet ?? ""}`);

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-teal-700 underline">Back to jobs</Link>

      <section className="card space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">{job.title}</h1>
          <StatusBadge status={job.status} />
          <ResponseBadge response={job.response} />
        </div>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {job.company ?? "Unknown company"} · {CATEGORY_LABELS[job.category] ?? job.category} · {job.salary_text ?? "Salary not listed"}
        </p>
        <Flags flags={job.flags} />
        <div className="flex flex-wrap gap-2 pt-1">
          <a className="btn-secondary" href={job.url} target="_blank" rel="noreferrer">Open posting to apply</a>
          {job.status !== "applied" && job.status !== "dismissed" && (
            <StatusButton id={job.id} status="applied" label="Mark applied" primary />
          )}
          {job.status !== "dismissed" && <StatusButton id={job.id} status="dismissed" label="Dismiss" />}
          {job.status === "dismissed" && <StatusButton id={job.id} status="new" label="Restore" />}
        </div>
        {job.status === "applied" && (
          <div className="space-y-1 border-t border-stone-200 pt-3 dark:border-stone-800">
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Applied {job.applied_at ? new Date(job.applied_at).toLocaleDateString("en-US", { timeZone: "America/New_York", dateStyle: "medium" }) : ""}. What happened?
            </p>
            <ResponseButtons id={job.id} response={job.response} />
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Write the resume in Claude</h2>
        <ol className="ml-5 list-decimal space-y-1 text-sm text-stone-600 dark:text-stone-400">
          <li>Press Copy for Claude. A new Claude chat opens in another tab. Press Cmd+V, then Enter.</li>
          <li>Claude makes a PDF named &quot;{resumeFileName(job.title)}.pdf&quot;. Click it, then click Download.</li>
          <li>On the application, upload it from Downloads (it&apos;s the newest file), then press Mark applied above.</li>
        </ol>
        <CopyForClaude prompt={prompt} />
        <details>
          <summary className="cursor-pointer text-sm text-stone-600 dark:text-stone-400">See exactly what gets copied</summary>
          <textarea readOnly className="input mt-2 h-64 font-mono text-xs" value={prompt} />
        </details>
      </section>

      <details className="card space-y-2" open={!!job.resume}>
        <summary className="cursor-pointer font-semibold">Keep a copy of the resume text here (optional)</summary>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          Not needed to apply. If you want the text saved with this job, paste it below and save.
        </p>
        <ResumeEditor id={job.id} resume={job.resume ?? ""} fileName={resumeFileName(job.title)} />
      </details>

      {job.description && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">Full posting text</summary>
          <pre className="mt-3 whitespace-pre-wrap text-xs text-stone-600 dark:text-stone-400">{job.description}</pre>
        </details>
      )}
    </div>
  );
}
