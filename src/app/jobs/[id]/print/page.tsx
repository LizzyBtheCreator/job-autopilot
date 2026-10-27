import { notFound, redirect } from "next/navigation";
import { currentUserEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { PrintButton } from "@/components/actions";

export const dynamic = "force-dynamic";

// Renders the resume's plain-text format (#, ##, ###, -) as a clean printable page.
function render(resume: string) {
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(
        <ul key={`ul${out.length}`} className="mb-2 ml-5 list-disc space-y-0.5">
          {bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>,
      );
      bullets = [];
    }
  };
  const lines = resume.split("\n").map((l) => l.trimEnd());
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    if (line.startsWith("- ")) { bullets.push(line.slice(2)); return; }
    flush();
    if (line.startsWith("### ")) out.push(<h3 key={i} className="mt-3 font-semibold">{line.slice(4)}</h3>);
    else if (line.startsWith("## ")) out.push(<h2 key={i} className="mt-4 border-b border-stone-400 pb-0.5 text-sm font-bold tracking-wide">{line.slice(3)}</h2>);
    else if (line.startsWith("# ")) out.push(<h1 key={i} className="text-center text-2xl font-bold">{line.slice(2)}</h1>);
    else if (i <= 2 && line.includes("|")) out.push(<p key={i} className="text-center text-sm">{line}</p>);
    else out.push(<p key={i} className="mb-1">{line}</p>);
  });
  flush();
  return out;
}

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUserEmail())) redirect("/login");
  const { id } = await params;
  const { data } = await db().from("jobs").select("resume").eq("id", id).maybeSingle();
  if (!data?.resume) notFound();

  return (
    <div className="mx-auto max-w-[8.5in] bg-white p-10 text-[11pt] leading-snug text-black print:p-0">
      <div className="mb-6 print:hidden">
        <PrintButton />
        <p className="mt-2 text-sm text-stone-600">In the print dialog choose &quot;Save as PDF&quot;. Turn off headers and footers for a clean page.</p>
      </div>
      <article style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{render(data.resume as string)}</article>
      <style>{`@page { margin: 0.6in; } @media print { body { background: white; } }`}</style>
    </div>
  );
}
