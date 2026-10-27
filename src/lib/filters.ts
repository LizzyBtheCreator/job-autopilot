// Rule-based filters. Each returns a reason string when a job should be dropped, or null to keep it.
// They run twice: on the search snippet (to drop results) and on the full posting (to flag them).

const US_STATE_ABBR = [
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "id", "il", "in", "ia", "ks", "ky", "la",
  "me", "md", "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj", "nm", "ny", "nc", "nd", "oh", "ok",
  "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy", "dc",
];

const STATE_GOV_HOSTS = [
  "alabama.gov", "alaska.gov", "arizona.gov", "arkansas.gov", "colorado.gov", "delaware.gov", "georgia.gov",
  "hawaii.gov", "idaho.gov", "illinois.gov", "indiana.gov", "iowa.gov", "kansas.gov", "kentucky.gov",
  "louisiana.gov", "maine.gov", "maryland.gov", "mass.gov", "michigan.gov", "mn.gov", "mississippi.gov",
  "missouri.gov", "montana.gov", "nebraska.gov", "nevada.gov", "newjersey.gov", "nj.gov", "ny.gov",
  "nc.gov", "ncdhhs.gov", "ohio.gov", "oklahoma.gov", "oregon.gov", "pa.gov", "texas.gov", "utah.gov",
  "vermont.gov", "virginia.gov", "wa.gov", "wisconsin.gov", "wyo.gov", "ct.gov", "ri.gov", "sc.gov", "tn.gov",
  "in.gov", "ky.gov", "la.gov", "nh.gov", "nm.gov", "nd.gov", "sd.gov", "wv.gov", "fl.gov", "myflorida.com",
  "ca.gov", "calcareers.ca.gov", "dc.gov",
];

// Job boards used mainly by state, county, city and school employers.
const STATE_LOCAL_BOARDS = [
  "governmentjobs.com", "calopps.org", "publicsafetyjobs", "schoolspring.com", "edjoin.org",
  "agency.governmentjobs.com", "neogov.com", "jobapscloud.com", "csea.com",
];

const STATE_LOCAL_TEXT =
  /\b(county of|city of|town of|village of|township|county government|municipality|school district|public schools|board of education|state of (alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)|commonwealth of (kentucky|massachusetts|pennsylvania|virginia)|county commission(ers)?)/i;

export function stateOrLocalGovReason(url: string, text: string): string | null {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    // keep going with text checks
  }
  if (host) {
    if (host.endsWith(".us")) return `State/local government site (${host})`;
    if (STATE_LOCAL_BOARDS.some((b) => host === b || host.endsWith("." + b) || host.includes(b)))
      return `State/local government job board (${host})`;
    if (STATE_GOV_HOSTS.some((h) => host === h || host.endsWith("." + h)))
      return `State government site (${host})`;
    const parts = host.split(".");
    if (parts.length >= 2 && parts[parts.length - 1] === "gov" && US_STATE_ABBR.includes(parts[parts.length - 2]))
      return `State government site (${host})`;
  }
  const m = text.match(STATE_LOCAL_TEXT);
  if (m) return `State/local government employer ("${m[0]}")`;
  return null;
}

const CLEARANCE =
  /\b(active|current|existing)\s+(dod\s+)?(secret|top secret|ts|ts\/sci|security|public trust)?\s*(security\s+)?clearance\b|\bts\s*\/\s*sci\b|\bclearance (is )?required\b|\brequires? (an? )?(active )?(secret|top secret|ts) clearance\b|\bmust (hold|possess|have) (an? )?(active |current )?(secret|top secret|ts|security) clearance\b|\b(secret|ts) clearance required\b|\b(full[- ]scope|ci) poly(graph)?\b/i;

export function clearanceReason(text: string): string | null {
  const m = text.match(CLEARANCE);
  return m ? `Requires active security clearance ("${m[0].trim()}")` : null;
}

const NOT_REMOTE = /\b(on-?site only|100% on-?site|fully on-?site|in-office|in office \d|hybrid|onsite required|must (live|reside) within|relocation required)\b/i;
const REMOTE = /\b(remote|work from home|wfh|telework|anywhere in the u\.?s\.?|distributed team)\b/i;

// Drops only when the text clearly says the job is not remote. Silence counts as remote,
// because the query already asked Google for remote jobs and snippets are short.
export function notRemoteReason(text: string): string | null {
  const m = text.match(NOT_REMOTE);
  if (!m || REMOTE.test(text)) return null;
  return `Not remote ("${m[0]}")`;
}

// Pulls a salary out of text like "$95,000 - $120,000", "$110K-$140K", "$65/hr".
export function parseSalary(text: string): { min: number | null; max: number | null; text: string | null } {
  const re = /\$\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|K)?(?:\s*(?:-|to|–)\s*\$?\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|K)?)?(\s*(?:\/|per)\s*(hour|hr|year|yr|annually))?/g;
  const values: number[] = [];
  let first: string | null = null;
  for (const m of text.matchAll(re)) {
    const unit = (m[6] ?? "").toLowerCase();
    const hourly = unit === "hour" || unit === "hr";
    const toNum = (raw: string | undefined, k: string | undefined) => {
      if (!raw) return null;
      let n = parseFloat(raw.replace(/,/g, ""));
      if (k) n *= 1000;
      if (hourly) n *= 2080;
      return n;
    };
    const a = toNum(m[1], m[2] ?? m[4]);
    const b = toNum(m[3], m[4]);
    // Ignore small numbers that are not pay (e.g. "$5 million budget" is caught below).
    for (const v of [a, b]) if (v !== null && v >= 20000 && v <= 1000000) values.push(Math.round(v));
    if (!first && (a ?? 0) >= 20000) first = m[0].trim();
  }
  if (!values.length) return { min: null, max: null, text: null };
  return { min: Math.min(...values), max: Math.max(...values), text: first };
}

// No salary listed counts as qualifying.
export function salaryReason(salaryMax: number | null, minSalary: number): string | null {
  if (salaryMax === null) return null;
  return salaryMax < minSalary ? `Salary below $${minSalary.toLocaleString()} (top of range $${salaryMax.toLocaleString()})` : null;
}

// Results that are not a single job posting.
export function notAJobReason(url: string, title: string): string | null {
  let path = "";
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return "Invalid URL";
  }
  if (/^\/(jobs|careers|career|openings|positions)?\/?$/.test(path)) return "Careers home page, not a single posting";
  if (/\b(\d[\d,]*\+?\s+(jobs|openings|positions)|jobs? (in|near) |salary|salaries|how to become|what is a)\b/i.test(title))
    return "Search results or article, not a single posting";
  if (/\/(search|salary|salaries|career-advice|blog)\b/.test(path)) return "Search results or article, not a single posting";
  return null;
}
