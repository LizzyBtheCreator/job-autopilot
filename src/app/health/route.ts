import { createClient } from "@supabase/supabase-js";
import { REQUIRED_ENV } from "@/lib/env";

export const dynamic = "force-dynamic";

// Public diagnostic page. It shows only yes/no answers and error messages, never secret values.
export async function GET() {
  const lines: string[] = ["Job Autopilot health check", ""];
  let ok = true;

  lines.push("Vercel environment variables for this deployment:");
  for (const k of REQUIRED_ENV) {
    const set = Boolean(process.env[k]?.trim());
    if (!set) ok = false;
    lines.push(`  ${set ? "OK     " : "MISSING"}  ${k}`);
  }
  lines.push("");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    lines.push("Supabase tables (from supabase/schema.sql):");
    try {
      const db = createClient(url, key, { auth: { persistSession: false } });
      for (const table of ["app_settings", "search_queries", "search_runs", "jobs"]) {
        const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
        if (error) ok = false;
        lines.push(`  ${error ? "FAILED " : "OK     "}  ${table}${error ? `: ${error.message}` : ` (${count ?? 0} rows)`}`);
      }
    } catch (e) {
      ok = false;
      lines.push(`  FAILED   could not connect: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    lines.push("Supabase tables: skipped, the Supabase variables above are missing.");
  }

  lines.push("", ok ? "Everything looks right." : "Fix the lines marked MISSING or FAILED, then redeploy.");
  return new Response(lines.join("\n"), {
    status: ok ? 200 : 500,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
