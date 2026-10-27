import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { clearanceReason, notRemoteReason, parseSalary, salaryReason } from "./filters";
import { ADDITIONAL_EXPERIENCE, CATEGORY_FOCUS, CERTIFICATIONS, CONTACT, EDUCATION_LINE, SKILLS, WORK_HISTORY, workHistoryText } from "./profile";
import type { Job, Requirements, Settings } from "./types";

const EXTRACT_MODEL = "claude-haiku-5-5";
const WRITE_MODEL = "claude-sonnet-5-5";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set in Vercel");
    client = new Anthropic();
  }
  return client;
}

// ---------- Step 1: fetch the real posting ----------

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
      .replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

// Many applicant tracking systems embed the full posting as JSON-LD. Prefer it when present.
function jsonLdPosting(html: string): string | null {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const items: unknown[] = Array.isArray(parsed) ? parsed : parsed["@graph"] ?? [parsed];
      for (const item of items) {
        const it = item as Record<string, unknown>;
        if (it["@type"] === "JobPosting" && typeof it.description === "string") {
          const parts = [
            typeof it.title === "string" ? `Title: ${it.title}` : "",
            it.hiringOrganization && typeof (it.hiringOrganization as Record<string, unknown>).name === "string"
              ? `Company: ${(it.hiringOrganization as Record<string, unknown>).name}`
              : "",
            it.jobLocationType ? `Location type: ${String(it.jobLocationType)}` : "",
            it.baseSalary ? `Salary: ${JSON.stringify(it.baseSalary)}` : "",
            htmlToText(decodeEntities(it.description)),
          ];
          return parts.filter(Boolean).join("\n");
        }
      }
    } catch {
      // not valid JSON, try the next block
    }
  }
  return null;
}

export async function fetchPosting(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!res.ok) return "";
    const html = await res.text();
    return (jsonLdPosting(html) ?? htmlToText(html)).slice(0, 40000);
  } catch {
    return "";
  }
}

// ---------- Step 2: extract the employer's exact language (Haiku) ----------

const RequirementsSchema = z.object({
  company_name: z.string(),
  keywords: z.array(z.string()),
  required_qualifications: z.array(z.string()),
  responsibilities: z.array(z.string()),
  tools_and_systems: z.array(z.string()),
  agencies_and_domains: z.array(z.string()),
  methodologies: z.array(z.string()),
  salary_text: z.string(),
  work_location: z.enum(["remote", "hybrid", "onsite", "unclear"]),
  requires_active_clearance: z.boolean(),
});

async function extractRequirements(job: Job, posting: string): Promise<Requirements> {
  const res = await anthropic().messages.parse({
    model: EXTRACT_MODEL,
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(RequirementsSchema) },
    messages: [
      {
        role: "user",
        content: `Read this job posting and pull out what the employer asked for, copying their exact words and phrases. Do not paraphrase.

- keywords: the 15 to 25 most important terms and phrases, exactly as written
- required_qualifications: each required qualification, exactly as written
- responsibilities: each key responsibility, in the employer's wording
- tools_and_systems, agencies_and_domains, methodologies: named items only (e.g. Salesforce, Air Force, Shipley)
- salary_text: the pay range as written, or "" if none
- work_location: remote, hybrid, onsite, or unclear
- requires_active_clearance: true only if an active or current security clearance is required (being able to obtain one later does not count)

Job title: ${job.title}
Company (may be wrong): ${job.company ?? "unknown"}

POSTING:
${posting}`,
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new Error("Haiku declined to read this posting");
  if (!res.parsed_output) throw new Error("Haiku did not return the requirements in the expected format");
  return res.parsed_output;
}

// ---------- Step 3: write the resume (Sonnet) ----------

const FILLER = [
  "results-driven", "results driven", "detail-oriented", "detail oriented", "dynamic", "passionate",
  "proven track record", "team player", "self-starter", "go-getter", "synergy", "hard-working", "hardworking",
  "think outside the box", "seasoned professional", "highly motivated", "best-in-class", "rockstar",
];

function buildPrompt(job: Job, req: Requirements, posting: string): string {
  const extra = ADDITIONAL_EXPERIENCE.length
    ? ADDITIONAL_EXPERIENCE.map((e) => `- ${e}`).join("\n")
    : "(none yet)";
  return `Write a resume for ${CONTACT.name} that makes her read as the right candidate for the job below: someone who already does this job. A hiring manager should see the posting's own function, duties, and vocabulary throughout, not a candidate from a different field.

JOB: ${job.title} at ${req.company_name || job.company || "the employer"}

THE EMPLOYER'S OWN LANGUAGE (mirror these exact words wherever they truthfully describe her experience):
Keywords: ${req.keywords.join("; ")}
Required qualifications: ${req.required_qualifications.join("; ")}
Responsibilities: ${req.responsibilities.join("; ")}
Tools and systems: ${req.tools_and_systems.join("; ") || "none named"}
Agencies and domains: ${req.agencies_and_domains.join("; ") || "none named"}
Methodologies: ${req.methodologies.join("; ") || "none named"}

FULL POSTING:
${posting.slice(0, 20000)}

ROLE FOCUS: ${CATEGORY_FOCUS[job.category]}

HER WORK HISTORY (numbered in locked order):
${workHistoryText()}

ADDITIONAL REAL EXPERIENCE (facts you may use, placed under the role named in each item):
${extra}

CERTIFICATIONS:
${CERTIFICATIONS.map((c) => `- ${c}`).join("\n")}

SKILLS BANK:
${SKILLS}

RULES:
1. Truth: use only facts, numbers, employers, and dates from her history and additional experience. Never invent a metric, employer, client, tool, clearance, degree, or certification. Reframe her real work in the employer's vocabulary wherever the meaning stays true (for example, Davis-Bacon labor standards work is wage and hour and labor compliance; training clients' staff is training and coaching; coordinating IT, Legal, and executives is partnering with leaders). Do not claim a duty she has no basis for.
2. Fit to this job: pick and rewrite bullets so most of them speak to the posting's listed responsibilities and qualifications, in the posting's words. Drop bullets that point to a different field (for example sales metrics for an HR role) unless the posting asks for them. The summary, titles, bullets, and competencies should all read as this job's function.
3. Titles for HER OWN BUSINESS roles: replace the title with a real, functional job title that truthfully describes the work she did there and relates to the job being applied for. Match the posting's level: if the posting is a Manager role, use Manager, Senior Specialist, Consultant, or Lead level titles; never a title above the posting's level (no Director, VP, Head, or Chief for a Manager posting). Never use Founder, Co-Founder, Owner, Owner/Operator, Proprietor, President, CEO, Principal, ownership Partner, or Self-Employed. Keep the company name, location, and dates exactly as given.
4. Titles for EMPLOYER roles: keep the exact title given.
5. Self-employment: do not present her as an entrepreneur. Never write founded, launched my, my firm, my practice, my company, own business, or startup founder. Describe the work, not the ownership. Include at most two of her own businesses unless more are needed to show the posting's required experience.
6. Never use an em dash or en dash. Use a comma, a colon, or a plain hyphen.
7. No filler phrases such as "results-driven", "detail-oriented", "dynamic", "passionate", or "proven track record".
8. Every bullet contains a specific metric or a named skill, tool, law, regulation, agency, or methodology.
9. The summary is 4 sentences at most. Its first sentence names the posting's role function and her strongest match to the employer's top 2 or 3 priorities. Pitch her at the posting's level, not above it.
10. Core competencies: 9 to 12 short items using the posting's exact terms that her history or additional experience supports.
11. Leave out roles that do not help for this job, but keep the ones you include in the numbered order above. Never reorder them.
12. Education: exactly the one line given in the format below, nothing else. No references, no salary, no personal notes, no trial or engagement offers.
13. Length: 1 to 1.5 pages.

OUTPUT FORMAT (plain text, exactly this structure, nothing before or after):
# ${CONTACT.name}
${CONTACT.location} | ${CONTACT.phone} | ${CONTACT.email}
## PROFESSIONAL SUMMARY
(summary paragraph)
## CORE COMPETENCIES
(items separated by " | ")
## PROFESSIONAL EXPERIENCE
### (Company) - (Title per rules 3 and 4) (location as given) | (dates as given)
- (bullet)
## CERTIFICATIONS
- (certification)
## EDUCATION
- ${EDUCATION_LINE}`;
}

const OWNER_WORDS = /\b(founder|co-founder|founded|owner|owner\/operator|proprietor|self-employed|my firm|my practice|my company)\b/i;
const SENIOR_TITLES = /\b(vp|vice president|chief|head of|director|president|ceo|principal)\b/i;

// Applied after the model writes, so the rules hold even if the model slips.
export function enforceRules(resume: string): { text: string; warnings: string[] } {
  const warnings: string[] = [];
  let text = resume
    .replace(/\s*[—―]\s*/g, ", ") // em dash and horizontal bar
    .replace(/(\d)\s*–\s*(\d)/g, "$1-$2") // en dash in number ranges
    .replace(/\s*–\s*/g, " - ") // any other en dash
    .replace(/,\s*,/g, ",")
    .trim();
  text = text.replace(/^```[a-z]*\n?|\n?```$/g, "").trim();

  const lower = text.toLowerCase();
  for (const f of FILLER) if (lower.includes(f)) warnings.push(`Contains filler phrase "${f}"`);

  // Check the locked role order.
  const positions = WORK_HISTORY.map((r) => text.indexOf(`### ${r.key} -`)).filter((p) => p >= 0);
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] < positions[i - 1]) {
      warnings.push("Roles are not in the locked order");
      break;
    }
  }
  const owner = text.match(OWNER_WORDS);
  if (owner) warnings.push(`Mentions self-employment ("${owner[0]}")`);
  return { text, warnings };
}

// Flags from reading the full posting. These do not delete the job; they warn you.
function postingFlags(job: Job, req: Requirements, posting: string, settings: Settings): string[] {
  const flags: string[] = [];
  const text = `${job.title}\n${posting}`;
  if (!posting) flags.push("Could not load the full posting; resume is based on the search snippet");
  const clearance = clearanceReason(text);
  if (req.requires_active_clearance || clearance) flags.push(clearance ?? "Posting requires an active security clearance");
  if (req.work_location === "hybrid" || req.work_location === "onsite") flags.push(`Posting says ${req.work_location}`);
  else {
    const notRemote = notRemoteReason(text);
    if (notRemote) flags.push(notRemote);
  }
  const salary = parseSalary(req.salary_text || "");
  const low = salaryReason(salary.max, settings.min_salary);
  if (low) flags.push(low);
  return flags;
}

export interface GeneratedResume {
  resume: string;
  requirements: Requirements;
  description: string;
  flags: string[];
  salary_text: string | null;
}

export async function generateResume(job: Job, settings: Settings): Promise<GeneratedResume> {
  const posting = (await fetchPosting(job.url)) || `${job.title}\n${job.snippet ?? ""}`;
  const requirements = await extractRequirements(job, posting);

  const message = await anthropic()
    .messages.stream({
      model: WRITE_MODEL,
      max_tokens: 32000,
      messages: [{ role: "user", content: buildPrompt(job, requirements, posting) }],
    })
    .finalMessage();

  if (message.stop_reason === "refusal") throw new Error("Sonnet declined to write this resume");
  if (message.stop_reason === "max_tokens") throw new Error("Resume was cut off before it finished; try again");
  const raw = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  if (!raw.trim()) throw new Error("Sonnet returned an empty resume");

  const { text, warnings } = enforceRules(raw);
  // A heading above the posting's level (e.g. Director on a Manager posting) gets flagged.
  if (!SENIOR_TITLES.test(job.title)) {
    for (const line of text.split("\n").filter((l) => l.startsWith("### "))) {
      const title = line.slice(4).split(" | ")[0];
      const m = title.match(SENIOR_TITLES);
      if (m) warnings.push(`Role title above this job's level ("${m[0]}" in ${title})`);
    }
  }
  return {
    resume: text,
    requirements,
    description: posting,
    flags: [...postingFlags(job, requirements, posting, settings), ...warnings],
    salary_text: requirements.salary_text || job.salary_text,
  };
}
