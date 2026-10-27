import "server-only";
import { db } from "./db";
import { clearanceReason, notAJobReason, notRemoteReason, parseSalary, salaryReason } from "./filters";
import type { DroppedResult, QueryStats, SearchQuery, Settings } from "./types";

// Searching these application sites returns one posting per result instead of job-board lists.
const ATS_SITES = "(site:greenhouse.io OR site:lever.co OR site:ashbyhq.com OR site:myworkdayjobs.com OR site:apply.workable.com OR site:icims.com)";

// Sites left out of open-web queries. LinkedIn, Indeed and the other big aggregators block page
// fetching, so a tailored resume could not read the full posting.
export const EXCLUDED_SITES = [
  "linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com", "monster.com",
  "careerbuilder.com", "simplyhired.com", "salary.com",
];

interface SerperResult {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
}

async function serperCall(body: Record<string, unknown>): Promise<{ ok: true; rows: SerperResult[] } | { ok: false; status: number; text: string }> {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error("SERPER_API_KEY is not set in Vercel");
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, text: text.slice(0, 200) };
  const data = JSON.parse(text) as { organic?: SerperResult[] };
  return { ok: true, rows: data.organic ?? [] };
}

// Serper's free plan rejects some options ("Query pattern not allowed for free accounts").
// Try the most precise request first, then step down to what the plan accepts, and say which one worked.
async function serper(query: string, exclusions: string, settings: Settings): Promise<{ rows: SerperResult[]; note: string | null }> {
  const precise: Record<string, unknown> = { q: `${query} ${ATS_SITES}`, num: settings.results_per_query, gl: "us", hl: "en" };
  if (settings.recency !== "any") precise.tbs = `qdr:${settings.recency}`;
  const attempts: { body: Record<string, unknown>; note: string | null }[] = [
    { body: precise, note: null },
    { body: { q: `${query} ${ATS_SITES}`, num: 10 }, note: "Serper plan limit: ran without the date filter, 10 results" },
    { body: { q: `${query} ${exclusions}`, num: 10 }, note: "Serper plan limit: searched the open web instead of application sites" },
    { body: { q: query, num: 10 }, note: "Serper plan limit: searched the open web with no site exclusions" },
  ];
  let last = "";
  for (const a of attempts) {
    const r = await serperCall(a.body);
    if (r.ok) return { rows: r.rows, note: a.note };
    last = `Serper returned ${r.status}: ${r.text}`;
    if (!(r.status === 400 && /not allowed/i.test(r.text))) break;
  }
  throw new Error(last);
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|ref$|src$|source$|gclid$|fbclid$)/i.test(k)) u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return raw;
  }
}

function parseTitleAndCompany(rawTitle: string, url: string): { title: string; company: string | null } {
  const cleaned = rawTitle.replace(/\s*\.\.\.$/, "").trim();
  const pipe = cleaned.split(/\s+\|\s+/);
  let title = pipe[0].trim();
  let company: string | null = null;

  const dash = title.split(/\s+[-–]\s+/);
  if (dash.length >= 2) {
    title = dash[0].trim();
    company = dash[1].trim();
  } else if (pipe.length >= 2 && !/careers|jobs|hiring|apply/i.test(pipe[1])) {
    company = pipe[1].trim();
  }
  const at = title.match(/^(.*?)\s+at\s+(.+)$/i);
  if (at) {
    title = at[1].trim();
    company = company ?? at[2].trim();
  }
  if (title.toLowerCase().startsWith("job application for ")) title = title.slice(20);

  if (!company) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      const seg = u.pathname.split("/").filter(Boolean)[0];
      if (/greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|breezy\.hr|jazzhr|bamboohr/.test(host) && seg) company = seg;
      else if (/myworkdayjobs\.com|icims\.com|applytojob\.com|paylocity|ultipro|recruitee/.test(host)) company = host.split(".")[0];
      else company = host.split(".").slice(-2, -1)[0] ?? host;
      company = company.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    } catch {
      company = null;
    }
  }
  return { title, company };
}

export async function loadSettings(): Promise<Settings> {
  const { data, error } = await db().from("app_settings").select("*").eq("id", 1).single();
  if (error) throw new Error(`Could not read app_settings: ${error.message}. Did you run supabase/schema.sql?`);
  return data as Settings;
}

export async function runSearch(): Promise<string> {
  const supabase = db();
  const settings = await loadSettings();

  const { data: queryRows, error: qErr } = await supabase
    .from("search_queries")
    .select("*")
    .eq("enabled", true)
    .order("sort_order");
  if (qErr) throw new Error(`Could not read search_queries: ${qErr.message}`);
  const queries = (queryRows ?? []) as SearchQuery[];
  if (!queries.length) throw new Error("No search queries are turned on. Turn some on in Settings.");

  const { data: run, error: runErr } = await supabase.from("search_runs").insert({}).select("id").single();
  if (runErr) throw new Error(`Could not start search run: ${runErr.message}`);
  const runId = run.id as string;

  const exclusions = EXCLUDED_SITES.map((s) => `-site:${s}`).join(" ");
  const perQuery: QueryStats[] = [];
  const dropped: DroppedResult[] = [];
  const seenThisRun = new Set<string>();
  let totalReturned = 0;
  let totalNew = 0;
  let totalSeenBefore = 0;

  // All queries go out at once; each one's failure is recorded and does not stop the others.
  const results = await Promise.all(
    queries.map(async (q) => {
      try {
        const r = await serper(q.query, exclusions, settings);
        return { q, rows: r.rows, note: r.note, error: null as string | null };
      } catch (e) {
        return { q, rows: [] as SerperResult[], note: null, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  for (const { q, rows, note, error } of results) {
    const stats: QueryStats = { label: q.label, query: q.query, returned: rows.length, new: 0, seen_before: 0, dropped: 0, error, note };
    totalReturned += rows.length;

    const keep: { url: string; title: string; company: string | null; snippet: string; salary: ReturnType<typeof parseSalary> }[] = [];
    for (const r of rows) {
      const url = r.link ? normalizeUrl(r.link) : "";
      const rawTitle = r.title ?? "";
      const snippet = r.snippet ?? "";
      const text = `${rawTitle} ${snippet}`;
      const drop = (reason: string) => {
        stats.dropped++;
        dropped.push({ query_label: q.label, title: rawTitle, url, reason });
      };

      if (!url || !rawTitle) { drop("Missing link or title"); continue; }
      if (seenThisRun.has(url)) { drop("Duplicate of a result from an earlier query in this run"); continue; }
      seenThisRun.add(url);

      const salary = parseSalary(text);
      const reason =
        notAJobReason(url, rawTitle) ??
        clearanceReason(text) ??
        notRemoteReason(text) ??
        salaryReason(salary.max, settings.min_salary);
      if (reason) { drop(reason); continue; }

      const { title, company } = parseTitleAndCompany(rawTitle, url);
      keep.push({ url, title, company, snippet, salary });
    }

    if (keep.length) {
      const { data: existing, error: exErr } = await supabase
        .from("jobs")
        .select("url")
        .in("url", keep.map((k) => k.url));
      if (exErr) throw new Error(`Could not check existing jobs: ${exErr.message}`);
      const existingUrls = new Set((existing ?? []).map((e: { url: string }) => e.url));

      const fresh = keep.filter((k) => !existingUrls.has(k.url));
      const old = keep.filter((k) => existingUrls.has(k.url));

      if (fresh.length) {
        const { error: insErr } = await supabase.from("jobs").upsert(
          fresh.map((k) => ({
            url: k.url,
            title: k.title,
            company: k.company,
            snippet: k.snippet,
            category: q.category,
            query_label: q.label,
            salary_text: k.salary.text,
            salary_min: k.salary.min,
            salary_max: k.salary.max,
            last_run_id: runId,
          })),
          { onConflict: "url", ignoreDuplicates: true },
        );
        if (insErr) throw new Error(`Could not save jobs: ${insErr.message}`);
      }
      if (old.length) {
        // Already in your list: shown again, never silently thrown away.
        await supabase
          .from("jobs")
          .update({ last_seen_at: new Date().toISOString(), last_run_id: runId })
          .in("url", old.map((k) => k.url));
      }
      stats.new = fresh.length;
      stats.seen_before = old.length;
      totalNew += fresh.length;
      totalSeenBefore += old.length;
    }
    perQuery.push(stats);
  }

  const failed = perQuery.filter((p) => p.error);
  await supabase
    .from("search_runs")
    .update({
      finished_at: new Date().toISOString(),
      total_returned: totalReturned,
      total_new: totalNew,
      total_seen_before: totalSeenBefore,
      total_dropped: dropped.length,
      per_query: perQuery,
      dropped,
      error: failed.length ? `${failed.length} of ${perQuery.length} queries failed. First error: ${failed[0].error}` : null,
    })
    .eq("id", runId);

  return runId;
}
