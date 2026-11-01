import "server-only";
import { db } from "./db";
import type { BidDropped, BidQuery, BidQueryStats, BidSettings } from "./bid-types";

// State and local bid search. It shares nothing with the job search except the Serper key.
//
// How a result becomes a bid:
// 1. Google (through Serper) is searched for bid wording + a service + your states, on government
//    sites and the public bid portals.
// 2. From the search result alone, federal sites, award and results pages, lists of many bids, and
//    results from past years are dropped.
// 3. Every remaining new result's page is opened and read. Closed, awarded, or cancelled bids, pages
//    that list many bids, and bids whose due date has passed are dropped. The due date is saved, and
//    license, insurance, bond, and site visit requirements are flagged.
// Every dropped result is kept with its reason so the search can be checked and tuned.

// Government sites and the public bid portals that show one bid per page.
const BID_SITES = "(site:gov OR site:us OR site:bidnetdirect.com OR site:bonfirehub.com OR site:opengov.com OR site:demandstar.com)";

// Federal sites. Your bids are state and local only.
const FEDERAL_HOSTS = /(^|\.)(sam\.gov|fbo\.gov|gsa\.gov|usda\.gov|va\.gov|nps\.gov|doi\.gov|dhs\.gov|fema\.gov|hud\.gov|nih\.gov|cdc\.gov|epa\.gov|usace\.army\.mil|fed\.us|usajobs\.gov|grants\.gov|beta\.sam\.gov|highergov\.com|govtribe\.com)$|\.mil$/i;
const FEDERAL_TEXT = /\b(sam\.gov|federal acquisition regulation|FAR 52\.|department of veterans affairs|U\.S\. Army|U\.S\. Navy|U\.S\. Air Force|army corps of engineers|national park service|forest service|USDA|federal bureau of prisons)\b/i;

const RESULTS_PAGE = /\b(bid tab(ulation)?s?|bid results|award(ed)? notice|notice of (intent to )?award|intent to award|awarded to|bid award)\b/i;
const LIST_TITLE = /^(current|open|active|available|upcoming)?\s*(bids?|bid opportunities|bids? (and|&) (rfps?|proposals|quotes)|solicitations|procurement( opportunities)?|purchasing( (department|division))?|rfps?|business opportunities|contracting opportunities)\b/i;
const CLOSED_PAGE = /\b(status:?\s*(closed|awarded|cancel+ed)|(bid|solicitation|rfq|ifb|itb) (is |has been )?(closed|awarded|cancel+ed)|this (bid|solicitation|opportunity) (is |has )?(closed|been awarded|been cancel+ed))\b/i;

const MONTHS = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const DATE = `(?:(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}|\\d{1,2}/\\d{1,2}/\\d{2,4}|\\d{4}-\\d{2}-\\d{2})`;
const DUE_KEY = "(?:due|deadline|closing|closes|close date|opening date|bid opening|received (?:by|no later than|until|prior to)|submitted (?:by|no later than)|submission)";
const DUE_RE = new RegExp(`${DUE_KEY}[\\s\\S]{0,80}?(${DATE})`, "gi");

const STATE_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT",
  Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI",
  Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH",
  "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH",
  Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
  Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
};

interface SerperResult {
  title?: string;
  link?: string;
  snippet?: string;
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

// Serper's free plan rejects some options. Try the most precise request first and step down.
async function serper(base: string, settings: BidSettings): Promise<{ rows: SerperResult[]; note: string | null }> {
  const precise: Record<string, unknown> = { q: `${base} ${BID_SITES}`, num: settings.results_per_query, gl: "us", hl: "en" };
  if (settings.recency !== "any") precise.tbs = `qdr:${settings.recency}`;
  const attempts: { body: Record<string, unknown>; note: string | null }[] = [
    { body: precise, note: null },
    { body: { q: `${base} ${BID_SITES}`, num: 10 }, note: "Serper plan limit: ran without the date filter, 10 results" },
    { body: { q: `${base} -site:sam.gov`, num: 10 }, note: "Serper plan limit: searched the open web instead of government and bid sites" },
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

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(br|\/p|\/li|\/h\d|\/div|\/tr|\/td|\/th)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

// Today's date in Eastern time, as YYYY-MM-DD.
function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// Turns "November 14, 2026", "Nov. 14th 2026", "11/14/2026", "11/14/26", or "2026-11-14" into YYYY-MM-DD.
function parseDate(raw: string): string | null {
  const s = raw.replace(/(\d)(st|nd|rd|th)\b/i, "$1").replace(/\./g, "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  const d = new Date(`${s} 12:00 UTC`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// The bid's due date: the latest deadline on the page that isn't a questions deadline,
// within a year from now. Returns the date and the words around it.
function findDueDate(text: string): { date: string; text: string } | null {
  const now = today();
  const limit = `${Number(now.slice(0, 4)) + 1}${now.slice(4)}`;
  let best: { date: string; text: string } | null = null;
  for (const m of text.matchAll(DUE_RE)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
    if (/question|inquir|clarification|pre-?bid|site visit|walk-?through/i.test(before + m[0].slice(0, 30))) continue;
    const date = parseDate(m[1]);
    if (!date || date > limit) continue;
    if (!best || date > best.date) best = { date, text: m[0].replace(/\s+/g, " ").trim().slice(0, 140) };
  }
  return best;
}

function findState(text: string, url: string, states: string[]): string | null {
  for (const name of states) {
    const abbr = STATE_ABBR[name];
    if (new RegExp(`\\b${name}\\b`, "i").test(text)) return name;
    if (abbr && new RegExp(`(,\\s*|\\b)${abbr}\\b(\\s+\\d{5})?`).test(text.replace(/\bOR\b/g, ""))) return name;
    try {
      const host = new URL(url).hostname;
      if (abbr && new RegExp(`(^|\\.)${abbr.toLowerCase()}\\.(gov|us)$|\\.${abbr.toLowerCase()}\\.us$`).test(host)) return name;
    } catch {
      // ignore
    }
  }
  return null;
}

// A readable agency name from the page title or the web address.
function agencyFrom(title: string, url: string, siteName: string | null): string | null {
  if (siteName) return siteName.trim();
  const parts = title.split(/\s+[|\-–]\s+/);
  if (parts.length > 1) return parts[parts.length - 1].trim();
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (/bidnetdirect|bonfirehub|opengov|demandstar/.test(host)) return null;
    return host.split(".").slice(0, -1).join(" ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return null;
  }
}

function cleanTitle(title: string): string {
  return title.replace(/\s*\.\.\.$/, "").split(/\s+\|\s+/)[0].trim();
}

function yearsIn(text: string): number[] {
  return [...text.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
}

// From the search result alone: reasons to drop it before opening the page.
function snippetReason(url: string, title: string, snippet: string): string | null {
  let host = "";
  let path = "";
  try {
    const u = new URL(url);
    host = u.hostname;
    path = u.pathname;
  } catch {
    return "Not a valid link";
  }
  const text = `${title} ${snippet}`;
  if (FEDERAL_HOSTS.test(host)) return `Federal site (${host})`;
  if (FEDERAL_TEXT.test(text)) return "Federal bid";
  if (RESULTS_PAGE.test(title)) return "Award or results page, not an open bid";
  const isPdf = /\.pdf$/i.test(path);
  if (!isPdf && LIST_TITLE.test(cleanTitle(title)) && !/\d{3,}/.test(path)) return "List of many bids, not a single bid";
  const years = yearsIn(text);
  const thisYear = Number(today().slice(0, 4));
  if (years.length && Math.max(...years) < thisYear) return `From an earlier year (${Math.max(...years)})`;
  return null;
}

interface PageCheck {
  drop: string | null;
  due: { date: string; text: string } | null;
  state: string | null;
  agency: string | null;
  flags: string[];
}

// Opens the bid's page and reads it. PDFs and pages that can't be opened are kept with a flag.
async function checkPage(url: string, title: string, snippet: string, states: string[]): Promise<PageCheck> {
  const result: PageCheck = { drop: null, due: null, state: null, agency: null, flags: [] };
  const fallbackText = `${title}\n${snippet}`;
  let html: string | null = null;
  let isPdf = /\.pdf($|\?)/i.test(url);
  if (!isPdf) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (res.ok) {
        if (/pdf/i.test(res.headers.get("content-type") ?? "")) isPdf = true;
        else html = await res.text();
      }
    } catch {
      html = null;
    }
  }

  if (!html) {
    result.flags.push(isPdf ? "PDF: open it to check the due date and requirements" : "Could not open the page to check it: open the link");
    result.due = findDueDate(fallbackText);
    if (result.due && result.due.date < today()) result.drop = `Due date passed (${result.due.date})`;
    result.state = findState(fallbackText, url, states);
    result.agency = agencyFrom(title, url, null);
    if (!result.state) result.flags.push("State not confirmed");
    return result;
  }

  const text = htmlToText(html);
  const siteName = html.match(/<meta[^>]+property="og:site_name"[^>]+content="([^"]+)"/i)?.[1] ?? null;
  result.agency = agencyFrom(title, url, siteName ? decodeEntities(siteName) : null);
  if (FEDERAL_TEXT.test(text.slice(0, 3000))) {
    result.drop = "Federal bid (found on the page)";
    return result;
  }
  if (CLOSED_PAGE.test(text)) {
    result.drop = "Bid is closed, awarded, or cancelled";
    return result;
  }
  const numbers = new Set(
    [...text.matchAll(/\b(?:bid|solicitation|rfq|ifb|itb|rfp)\s*(?:#|no\.?|number)\s*:?\s*([\w-]{3,})/gi)].map((m) => m[1].toLowerCase()),
  );
  if (numbers.size > 4) {
    result.drop = `List of many bids (${numbers.size} bid numbers on the page), not a single bid`;
    return result;
  }
  result.due = findDueDate(text);
  if (result.due && result.due.date < today()) {
    result.drop = `Due date passed (${result.due.date})`;
    return result;
  }
  if (!result.due) result.flags.push("Due date not found on the page: check the bid");
  result.state = findState(`${title}\n${text.slice(0, 20000)}`, url, states);
  if (!result.state) result.flags.push("State not confirmed");

  if (/(must|shall)\s+(hold|possess|have|maintain)\s+(a\s+)?(valid\s+|current\s+|active\s+)?[\w\s-]{0,40}licen[sc]e/i.test(text)) {
    result.flags.push("May require the bidder to hold a license: check the bid");
  }
  if (/general liability|certificate of insurance|workers.? comp/i.test(text)) result.flags.push("Insurance required");
  if (/bid bond|performance bond|payment bond|bid security/i.test(text)) result.flags.push("Bond may be required");
  if (/mandatory\s+(pre-?bid|site visit|walk-?through|pre-?proposal)/i.test(text)) result.flags.push("Mandatory pre-bid meeting or site visit");
  return result;
}

export async function loadBidSettings(): Promise<BidSettings> {
  const { data, error } = await db().from("bid_settings").select("*").eq("id", 1).single();
  if (error) throw new Error(`Could not read bid_settings: ${error.message}. Did you run supabase/bids.sql?`);
  return data as BidSettings;
}

// Runs the given promises a few at a time.
async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

const MAX_PAGE_CHECKS = 60;

export async function runBidSearch(): Promise<string> {
  const supabase = db();
  const settings = await loadBidSettings();
  const { data: queryRows, error: qErr } = await supabase.from("bid_queries").select("*").eq("enabled", true).order("sort_order");
  if (qErr) throw new Error(`Could not read bid_queries: ${qErr.message}`);
  const queries = (queryRows ?? []) as BidQuery[];
  if (!queries.length) throw new Error("No bid searches are turned on. Turn some on in Bid settings.");

  const { data: run, error: runErr } = await supabase.from("bid_runs").insert({}).select("id").single();
  if (runErr) throw new Error(`Could not start bid search: ${runErr.message}`);
  const runId = run.id as string;

  const stateTerms = settings.states.length ? `(${settings.states.map((s) => `"${s}"`).join(" OR ")})` : "";
  const results = await Promise.all(
    queries.map(async (q) => {
      try {
        const r = await serper(`(${settings.bid_terms}) (${q.query}) ${stateTerms}`.trim(), settings);
        return { q, rows: r.rows, note: r.note, error: null as string | null };
      } catch (e) {
        return { q, rows: [] as SerperResult[], note: null, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  const stats = new Map<string, BidQueryStats>();
  const dropped: BidDropped[] = [];
  const seen = new Set<string>();
  const candidates: { url: string; title: string; snippet: string; label: string }[] = [];
  let totalReturned = 0;

  for (const { q, rows, note, error } of results) {
    const st: BidQueryStats = { label: q.label, query: q.query, returned: rows.length, new: 0, seen_before: 0, dropped: 0, error, note };
    stats.set(q.label, st);
    totalReturned += rows.length;
    for (const r of rows) {
      const url = r.link ? normalizeUrl(r.link) : "";
      const title = r.title ?? "";
      const snippet = r.snippet ?? "";
      const drop = (reason: string) => {
        st.dropped++;
        dropped.push({ query_label: q.label, title, url, reason });
      };
      if (!url || !title) { drop("Missing link or title"); continue; }
      if (seen.has(url)) { drop("Duplicate of a result from an earlier search in this run"); continue; }
      seen.add(url);
      const reason = snippetReason(url, title, snippet);
      if (reason) { drop(reason); continue; }
      candidates.push({ url, title, snippet, label: q.label });
    }
  }

  // Bids already in your list are shown again, not re-checked.
  const existing = new Set<string>();
  if (candidates.length) {
    const { data, error } = await supabase.from("bids").select("url").in("url", candidates.map((c) => c.url));
    if (error) throw new Error(`Could not check existing bids: ${error.message}`);
    for (const e of data ?? []) existing.add((e as { url: string }).url);
  }
  const old = candidates.filter((c) => existing.has(c.url));
  for (const c of old) stats.get(c.label)!.seen_before++;
  if (old.length) {
    await supabase.from("bids").update({ last_seen_at: new Date().toISOString(), last_run_id: runId }).in("url", old.map((c) => c.url));
  }

  const fresh = candidates.filter((c) => !existing.has(c.url));
  const toCheck = fresh.slice(0, MAX_PAGE_CHECKS);
  for (const c of fresh.slice(MAX_PAGE_CHECKS)) {
    stats.get(c.label)!.dropped++;
    dropped.push({ query_label: c.label, title: c.title, url: c.url, reason: "Not checked this run (page check limit reached); run the search again" });
  }
  const checks = await inBatches(toCheck, 8, async (c) => ({ c, check: await checkPage(c.url, c.title, c.snippet, settings.states) }));

  const rows: Record<string, unknown>[] = [];
  for (const { c, check } of checks) {
    const st = stats.get(c.label)!;
    if (check.drop) {
      st.dropped++;
      dropped.push({ query_label: c.label, title: c.title, url: c.url, reason: check.drop });
      continue;
    }
    st.new++;
    rows.push({
      url: c.url,
      title: cleanTitle(c.title),
      agency: check.agency,
      state: check.state,
      snippet: c.snippet,
      query_label: c.label,
      due_date: check.due?.date ?? null,
      due_text: check.due?.text ?? null,
      flags: check.flags,
      last_run_id: runId,
    });
  }
  if (rows.length) {
    const { error } = await supabase.from("bids").upsert(rows, { onConflict: "url", ignoreDuplicates: true });
    if (error) throw new Error(`Could not save bids: ${error.message}`);
  }

  const perQuery = [...stats.values()];
  const failed = perQuery.filter((p) => p.error);
  await supabase
    .from("bid_runs")
    .update({
      finished_at: new Date().toISOString(),
      total_returned: totalReturned,
      total_new: rows.length,
      total_seen_before: old.length,
      total_dropped: dropped.length,
      per_query: perQuery,
      dropped,
      error: failed.length ? `${failed.length} of ${perQuery.length} searches failed. First error: ${failed[0].error}` : null,
    })
    .eq("id", runId);
  return runId;
}

// A Google search for past award prices on this kind of work, used to price a bid without calling anyone.
export function pastPricesUrl(service: string, state: string | null): string {
  const q = `("bid tabulation" OR "bid tab" OR "bid results") ${service}${state ? ` "${state}"` : ""}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}
