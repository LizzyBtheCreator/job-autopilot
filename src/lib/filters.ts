// Rule-based filters. Each returns a reason string when a job should be dropped, or null to keep it.
// They run twice: on the search snippet (to drop results) and on the full posting (to flag them).

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

// Applicant tracking systems where each URL is one posting.
export const ATS_HOSTS = [
  "greenhouse.io", "lever.co", "ashbyhq.com", "myworkdayjobs.com", "workable.com", "icims.com",
  "smartrecruiters.com", "bamboohr.com", "applytojob.com", "breezy.hr", "recruitee.com", "paylocity.com",
  "ultipro.com", "ukg.com", "adp.com", "taleo.net", "successfactors.com", "oraclecloud.com", "dayforcehcm.com",
  "paycomonline.net", "jobvite.com", "rippling.com", "teamtailor.com", "pinpointhq.com", "usajobs.gov",
];

const LIST_WORDS = /\b(jobs|careers|openings|positions|vacancies|opportunities|job board|job listings|short list|hiring now|now hiring)\b/i;
const POSTING_PARENT = /^(job|jobs|careers?|positions?|openings?|opportunit(y|ies)|vacanc(y|ies)|listings?|roles?|postings?|offer|o|j|requisitions?|details?|apply)$/;
const ID_PARAM = /^(gh_jid|jobid|job_id|jid|reqid|req_id|requisitionid|id|pid|postingid|jobreqid)$/i;

function isAtsHost(host: string): boolean {
  return ATS_HOSTS.some((h) => host === h || host.endsWith("." + h));
}

// A single posting has an ID in its address, lives on an applicant tracking system,
// or ends in a long title slug under a jobs folder. Board and category pages have none of these.
function looksLikeSinglePosting(u: URL): boolean {
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const segs = u.pathname.toLowerCase().split("/").filter(Boolean);
  if (isAtsHost(host)) return segs.length >= 2 || [...u.searchParams.keys()].some((k) => ID_PARAM.test(k));
  if ([...u.searchParams.keys()].some((k) => ID_PARAM.test(k))) return true;
  if (segs.some((seg) => /\d{4,}|[0-9a-f]{8,}/.test(seg))) return true;
  for (let i = 1; i < segs.length; i++) {
    if (POSTING_PARENT.test(segs[i - 1]) && segs[i].split("-").length >= 4) return true;
  }
  return false;
}

// Results that are not a single job posting.
export function notAJobReason(url: string, title: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "Invalid URL";
  }
  const path = u.pathname.toLowerCase();
  if (/^\/(jobs|careers|career|openings|positions)?\/?$/.test(path)) return "Careers home page, not a single posting";
  if (/\b(\d[\d,]*\+?\s+(\w+\s+){0,4}(jobs|openings|positions)|jobs? (in|near) |salary|salaries|how to become|what is a)\b/i.test(title))
    return "Search results or article, not a single posting";
  if (/\/(search|salary|salaries|career-advice|blog)\b/.test(path)) return "Search results or article, not a single posting";
  // Only the part of the title before "|" or " - " names the page; site names often say "Careers".
  const lead = title.split(/\s+[|\-–]\s+/)[0];
  if (LIST_WORDS.test(lead)) return "Job board or list of jobs, not a single posting";
  if (!looksLikeSinglePosting(u)) return "Job board or list of jobs, not a single posting";
  return null;
}
