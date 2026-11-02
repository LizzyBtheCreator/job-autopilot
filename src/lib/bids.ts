import "server-only";
import { db } from "./db";
import type { BidDropped, BidQuery, BidQueryStats, BidSettings } from "./bid-types";

// State and local bid search. It shares nothing with the job search.
//
// Bids come straight from the states' own bid portals, which list open bids with their closing
// dates and status. Google is not used: its results were mostly expired bids.
//   North Carolina: eVP (evp.nc.gov), state agencies, community colleges, local governments, schools
//   Georgia: Georgia Procurement Registry (pur.doas.ga.gov), state, county, city, and K-12
// Only bids the portal marks Open, with a closing date of today or later, are saved.
// Each service search is a set of words matched against bid titles: words joined by OR, phrases in quotes.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export const SOURCES: Record<string, { state: string; name: string }> = {
  nc_evp: { state: "North Carolina", name: "NC eVP" },
  ga_gpr: { state: "Georgia", name: "Georgia Procurement Registry" },
};

interface PortalBid {
  url: string;
  title: string;
  agency: string | null;
  state: string;
  dueDate: string; // YYYY-MM-DD
  dueText: string;
  status: string;
  detail: string | null;
}

// Today's date in Eastern time, as YYYY-MM-DD.
function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// '"grounds maintenance" OR mowing' -> ["grounds maintenance", "mowing"]
export function searchTerms(query: string): string[] {
  return query
    .split(/\s+OR\s+/i)
    .map((t) => t.replace(/["()]/g, "").trim().toLowerCase())
    .filter(Boolean);
}

function matches(title: string, terms: string[]): boolean {
  return terms.some((term) =>
    new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+")}`, "i").test(title),
  );
}

// Cookies from a response, as a Cookie header value.
function cookiesFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

// ---------- North Carolina eVP ----------

interface NcSession {
  cookie: string;
  token: string;
  config: string;
}

async function ncSession(): Promise<NcSession> {
  const page = await fetch("https://evp.nc.gov/solicitations/", { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!page.ok) throw new Error(`NC eVP returned ${page.status}`);
  const html = await page.text();
  const layouts = html.match(/data-view-layouts="([^"]+)"/)?.[1];
  if (!layouts) throw new Error("NC eVP page changed: bid list settings not found");
  const decoded = JSON.parse(Buffer.from(layouts.replace(/&quot;/g, '"'), "base64").toString("utf8")) as { Base64SecureConfiguration: string }[];
  let cookie = cookiesFrom(page);
  const tokRes = await fetch("https://evp.nc.gov/_layout/tokenhtml", { headers: { "User-Agent": UA, Cookie: cookie }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  const tokCookie = cookiesFrom(tokRes);
  if (tokCookie) cookie = [cookie, tokCookie].filter(Boolean).join("; ");
  const token = (await tokRes.text()).match(/value="([^"]+)"/)?.[1];
  if (!token) throw new Error("NC eVP page changed: request token not found");
  return { cookie, token, config: decoded[0].Base64SecureConfiguration };
}

function ncDate(display: string): string | null {
  const m = display.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}

// "WAKE TECHNICAL COMMUNITY COLLEGE" -> "Wake Technical Community College"
function titleCase(s: string): string {
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s;
}

async function ncSearch(session: NcSession, term: string): Promise<PortalBid[]> {
  const res = await fetch("https://evp.nc.gov/_services/entity-grid-data.json/863ea987-6d3e-ed11-9daf-001dd805ec0b", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/json; charset=utf-8",
      "X-Requested-With": "XMLHttpRequest",
      __RequestVerificationToken: session.token,
      Cookie: session.cookie,
    },
    body: JSON.stringify({
      base64SecureConfiguration: session.config,
      sortExpression: "evp_opendate DESC",
      search: term,
      page: 1,
      pageSize: 50,
      pagingCookie: "",
      filter: null,
      metaFilter: null,
      nlSearch: false,
      timezoneOffset: 300,
      customParameters: [],
      entityName: "evp_solicitation",
      entityId: null,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`NC eVP search returned ${res.status}`);
  const data = (await res.json()) as { Records?: { Id: string; Attributes: { Name: string; DisplayValue?: string }[] }[] };
  const out: PortalBid[] = [];
  for (const r of data.Records ?? []) {
    const a = Object.fromEntries(r.Attributes.map((x) => [x.Name, x.DisplayValue ?? ""]));
    const due = ncDate(a.evp_opendate ?? "");
    if (!due) continue;
    out.push({
      url: `https://evp.nc.gov/solicitations/details/?id=${r.Id}`,
      title: a.evp_name || a.evp_solicitationnbr || "Untitled bid",
      agency: a.owningbusinessunit ? titleCase(a.owningbusinessunit) : null,
      state: "North Carolina",
      dueDate: due,
      dueText: `Bids open ${a.evp_opendate} (NC eVP)`,
      status: a.statuscode ?? "",
      detail: a.evp_description && a.evp_description !== a.evp_name ? a.evp_description : null,
    });
  }
  return out;
}

// ---------- Georgia Procurement Registry ----------

interface GaRow {
  esourceNumber: string;
  sourceId: string;
  title: string;
  agencyName: string | null;
  closingDate: string;
  closingDateStr: string;
  status: string;
  governmentType: string | null;
  bidProcessType: string | null;
}

// Georgia's registry has a few hundred open bids at a time, so all of them are read once per run
// and matched against each search's words.
async function gaOpenBids(): Promise<PortalBid[]> {
  const home = await fetch("https://pur.doas.ga.gov/gpr/index", { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  const cookie = cookiesFrom(home);
  const out: PortalBid[] = [];
  const pageSize = 250;
  for (let start = 0, total = Infinity; start < total && start < 2000; start += pageSize) {
    const body = new URLSearchParams({
      draw: "1", start: String(start), length: String(pageSize), responseType: "ALL", eventStatus: "OPEN",
      eventIdTitle: "", govType: "ALL", govEntity: "", catType: "ALL", eventProcessType: "ALL", dateRangeType: "",
      rangeStartDate: "", rangeEndDate: "", isReset: "true", persisted: "false", refreshSearchData: "true",
      "order[0][column]": "5", "order[0][dir]": "asc",
    });
    const res = await fetch("https://pur.doas.ga.gov/gpr/eventSearch", {
      method: "POST",
      headers: { "User-Agent": UA, "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Georgia registry returned ${res.status}`);
    const data = (await res.json()) as { recordsTotal?: number; data?: GaRow[] | null };
    total = data.recordsTotal ?? 0;
    for (const r of data.data ?? []) {
      out.push({
        url: `https://pur.doas.ga.gov/gpr/eventDetails?eSourceNumber=${encodeURIComponent(r.esourceNumber)}&sourceSystemType=${encodeURIComponent(r.sourceId)}`,
        title: r.title,
        agency: r.agencyName,
        state: "Georgia",
        dueDate: r.closingDate,
        dueText: `Closes ${r.closingDateStr} (Georgia Procurement Registry)`,
        status: r.status,
        detail: [r.governmentType, r.bidProcessType].filter(Boolean).join(" · ") || null,
      });
    }
    if (!data.data?.length) break;
  }
  return out;
}

// ---------- Running a search ----------

export async function loadBidSettings(): Promise<BidSettings> {
  const { data, error } = await db().from("bid_settings").select("*").eq("id", 1).single();
  if (error) throw new Error(`Could not read bid_settings: ${error.message}. Did you run supabase/bids.sql?`);
  return data as BidSettings;
}

export async function runBidSearch(): Promise<string> {
  const supabase = db();
  const settings = await loadBidSettings();
  const { data: queryRows, error: qErr } = await supabase.from("bid_queries").select("*").eq("enabled", true).order("sort_order");
  if (qErr) throw new Error(`Could not read bid_queries: ${qErr.message}`);
  const queries = (queryRows ?? []) as BidQuery[];
  if (!queries.length) throw new Error("No bid searches are turned on. Turn some on in Bid settings.");

  const wanted = new Set(settings.states.map((s) => s.toLowerCase()));
  const sources = Object.entries(SOURCES).filter(([, s]) => !wanted.size || wanted.has(s.state.toLowerCase()));
  if (!sources.length) throw new Error("None of your states has a connected bid portal yet. Connected: North Carolina, Georgia.");

  const { data: run, error: runErr } = await supabase.from("bid_runs").insert({}).select("id").single();
  if (runErr) throw new Error(`Could not start bid search: ${runErr.message}`);
  const runId = run.id as string;

  const stats = new Map<string, BidQueryStats>(
    queries.map((q) => [q.label, { label: q.label, query: q.query, returned: 0, new: 0, seen_before: 0, dropped: 0, error: null, note: null }]),
  );
  const dropped: BidDropped[] = [];
  const errors: string[] = [];
  const found = new Map<string, { bid: PortalBid; label: string }>();
  const now = today();

  const take = (bid: PortalBid, label: string) => {
    const st = stats.get(label)!;
    st.returned++;
    const drop = (reason: string) => {
      st.dropped++;
      dropped.push({ query_label: label, title: bid.title, url: bid.url, reason });
    };
    if (found.has(bid.url)) return drop("Also matched an earlier search in this run");
    if (!/^open$/i.test(bid.status)) return drop(`Portal status is ${bid.status || "not Open"}`);
    if (bid.dueDate < now) return drop(`Closing date passed (${bid.dueDate})`);
    found.set(bid.url, { bid, label });
  };

  await Promise.all(
    sources.map(async ([key, src]) => {
      try {
        if (key === "nc_evp") {
          const session = await ncSession();
          // NC searches on its own side, one request per search word.
          for (const q of queries) {
            const terms = searchTerms(q.query);
            const seen = new Set<string>();
            for (const term of terms) {
              for (const bid of await ncSearch(session, term)) {
                if (seen.has(bid.url) || !matches(bid.title, terms)) continue;
                seen.add(bid.url);
                take(bid, q.label);
              }
            }
          }
        } else if (key === "ga_gpr") {
          const all = await gaOpenBids();
          for (const q of queries) {
            const terms = searchTerms(q.query);
            for (const bid of all) if (matches(bid.title, terms)) take(bid, q.label);
          }
        }
      } catch (e) {
        errors.push(`${src.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }),
  );

  // Earlier versions searched Google, and most of those results were expired. Remove the ones you
  // haven't priced or noted. Bids you have worked on are never removed.
  await supabase
    .from("bids")
    .delete()
    .eq("status", "new")
    .is("contractor_cost", null)
    .is("bid_price", null)
    .is("notes", null)
    .not("url", "like", "https://evp.nc.gov/solicitations/details/%")
    .not("url", "like", "https://pur.doas.ga.gov/gpr/eventDetails%");

  // Bids already in your list get their closing date refreshed, not added again.
  const urls = [...found.keys()];
  const existing = new Set<string>();
  if (urls.length) {
    const { data, error } = await supabase.from("bids").select("url").in("url", urls);
    if (error) throw new Error(`Could not check existing bids: ${error.message}`);
    for (const e of data ?? []) existing.add((e as { url: string }).url);
  }
  const rows: Record<string, unknown>[] = [];
  for (const [url, { bid, label }] of found) {
    const st = stats.get(label)!;
    if (existing.has(url)) {
      st.seen_before++;
      await supabase
        .from("bids")
        .update({ last_seen_at: new Date().toISOString(), last_run_id: runId, due_date: bid.dueDate, due_text: bid.dueText })
        .eq("url", url);
      continue;
    }
    st.new++;
    rows.push({
      url,
      title: bid.title,
      agency: bid.agency,
      state: bid.state,
      snippet: bid.detail,
      query_label: label,
      due_date: bid.dueDate,
      due_text: bid.dueText,
      flags: [],
      last_run_id: runId,
    });
  }
  if (rows.length) {
    const { error } = await supabase.from("bids").upsert(rows, { onConflict: "url", ignoreDuplicates: true });
    if (error) throw new Error(`Could not save bids: ${error.message}`);
  }

  const notConnected = settings.states.filter((s) => !Object.values(SOURCES).some((src) => src.state.toLowerCase() === s.toLowerCase()));
  const notes = [...errors, ...(notConnected.length ? [`Not connected yet, so not searched: ${notConnected.join(", ")}`] : [])];
  const perQuery = [...stats.values()];
  await supabase
    .from("bid_runs")
    .update({
      finished_at: new Date().toISOString(),
      total_returned: perQuery.reduce((n, p) => n + p.returned, 0),
      total_new: rows.length,
      total_seen_before: found.size - rows.length,
      total_dropped: dropped.length,
      per_query: perQuery,
      dropped,
      error: notes.length ? notes.join(" · ") : null,
    })
    .eq("id", runId);
  return runId;
}

// A Google search for past award prices on this kind of work, used to price a bid without calling anyone.
export function pastPricesUrl(service: string, state: string | null): string {
  const q = `("bid tabulation" OR "bid tab" OR "bid results") ${service}${state ? ` "${state}"` : ""}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}
