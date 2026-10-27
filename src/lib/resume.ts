import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { clearanceReason, notRemoteReason, parseSalary, salaryReason, stateOrLocalGovReason } from "./filters";
import { CATEGORY_FOCUS, CERTIFICATIONS, CONTACT, SKILLS, WORK_HISTORY, workHistoryText } from "./profile";
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
  is_state_or_local_government: z.boolean(),
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
- is_state_or_local_government: true only if the employer is a state, county, city, or school district government

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

function salaryAtLeast(job: Job, req: Requirements, floor: number): boolean {
  const fromReq = parseSalary(req.salary_text ?? "");
  const top = Math.max(job.salary_max ?? 0, fromReq.max ?? 0);
  return top >= floor;
}

function buildPrompt(job: Job, req: Requirements, posting: string, includeTrial: boolean): string {
  const trial = includeTrial
    ? `Right after the summary, include this section:
## TRIAL ENGAGEMENT AVAILABLE
Two or three sentences offering a one-week, no-risk trial that begins within 10 business days of the first interview. Cite the 72% win rate or the $320M+ in contract activity. Confident, framed as standard consulting practice. State that the offer expires if not started within 10 business days of the first interview.`
    : "Do not include a trial engagement section.";

  return `Write a resume for ${CONTACT.name}, tailored to the job below.

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

CERTIFICATIONS:
${CERTIFICATIONS.map((c) => `- ${c}`).join("\n")}

SKILLS BANK:
${SKILLS}

RULES:
1. Use only facts, numbers, employers, titles, and dates from her history above. Never invent a metric, client, clearance, degree, or certification. You may rephrase a bullet in the employer's words if the meaning stays true.
2. Never use an em dash or en dash. Use a comma, a colon, or a plain hyphen.
3. No filler phrases such as "results-driven", "detail-oriented", "dynamic", "passionate", or "proven track record".
4. Every bullet contains a specific metric or a named skill, tool, regulation, agency, or methodology.
5. The summary is 4 sentences at most. Its first sentence is her strongest match to this specific role and names the employer's top 2 or 3 priorities.
6. Leave out roles that do not help for this job, but keep the ones you include in the numbered order above. Never reorder them.
7. No education section, no references, no salary, no personal notes.
8. Length: 1 to 1.5 pages.
9. ${trial}

OUTPUT FORMAT (plain text, exactly this structure, nothing before or after):
# ${CONTACT.name}
${CONTACT.location} | ${CONTACT.phone} | ${CONTACT.email}
## PROFESSIONAL SUMMARY
(summary paragraph)
## PROFESSIONAL EXPERIENCE
### (role heading exactly as given in her history)
- (bullet)
## CERTIFICATIONS
- (certification)`;
}

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
  if (/^##\s*education/im.test(text)) warnings.push("Contains an education section");
  return { text, warnings };
}

// Flags from reading the full posting. These do not delete the job; they warn you.
function postingFlags(job: Job, req: Requirements, posting: string, settings: Settings): string[] {
  const flags: string[] = [];
  const text = `${job.title}\n${posting}`;
  if (!posting) flags.push("Could not load the full posting; resume is based on the search snippet");
  const clearance = clearanceReason(text);
  if (req.requires_active_clearance || clearance) flags.push(clearance ?? "Posting requires an active security clearance");
  const gov = stateOrLocalGovReason(job.url, text);
  if (req.is_state_or_local_government || gov) flags.push(gov ?? "Employer is state or local government");
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
  const includeTrial = salaryAtLeast(job, requirements, 100000);

  const message = await anthropic()
    .messages.stream({
      model: WRITE_MODEL,
      max_tokens: 32000,
      messages: [{ role: "user", content: buildPrompt(job, requirements, posting, includeTrial) }],
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
  return {
    resume: text,
    requirements,
    description: posting,
    flags: [...postingFlags(job, requirements, posting, settings), ...warnings],
    salary_text: requirements.salary_text || job.salary_text,
  };
}
