import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { CATEGORY_LABELS, type Job } from "@/lib/types";
import { GenerateButton, ResumeEditor, StatusButton } from "@/components/actions";
import { Flags, StatusBadge } from "@/components/badges";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUserEmail())) redirect("/login");
  const { id } = await params;
  const { data } = await db().from("jobs").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const job = data as Job;
  const req = job.requirements;

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-teal-700 underline">Back to jobs</Link>

      <section className="card space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">{job.title}</h1>
          <StatusBadge status={job.status} />
        </div>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {job.company ?? "Unknown company"} · {CATEGORY_LABELS[job.category] ?? job.category} · {job.salary_text ?? "Salary not listed"}
        </p>
        <Flags flags={job.flags} />
        {job.error && <p className="text-sm text-red-600">{job.error}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <a className="btn-primary" href={job.url} target="_blank" rel="noreferrer">Open posting to apply</a>
          {job.status === "needs_review" && <StatusButton id={job.id} status="ready" label="Approve" primary />}
          {(job.status === "ready" || job.status === "needs_review") && (
            <StatusButton id={job.id} status="applied" label="Mark applied" />
          )}
          <GenerateButton id={job.id} label={job.resume ? "Regenerate resume" : "Generate resume"} />
          {job.status !== "dismissed" && <StatusButton id={job.id} status="dismissed" label="Dismiss" />}
          {job.status === "dismissed" && <StatusButton id={job.id} status="new" label="Restore" />}
        </div>
      </section>

      {job.resume ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Tailored resume</h2>
          <ResumeEditor id={job.id} resume={job.resume} />
        </section>
      ) : (
        <p className="text-sm text-stone-500">No resume yet.</p>
      )}

      {req && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">What the employer asked for</summary>
          <dl className="mt-3 space-y-3 text-sm">
            {(
              [
                ["Keywords", req.keywords],
                ["Required qualifications", req.required_qualifications],
                ["Responsibilities", req.responsibilities],
                ["Tools and systems", req.tools_and_systems],
                ["Agencies and domains", req.agencies_and_domains],
                ["Methodologies", req.methodologies],
              ] as [string, string[]][]
            )
              .filter(([, v]) => v.length)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="font-medium">{k}</dt>
                  <dd className="text-stone-600 dark:text-stone-400">{v.join(" · ")}</dd>
                </div>
              ))}
          </dl>
        </details>
      )}

      {job.description && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">Full posting text</summary>
          <pre className="mt-3 whitespace-pre-wrap text-xs text-stone-600 dark:text-stone-400">{job.description}</pre>
        </details>
      )}
    </div>
  );
}
