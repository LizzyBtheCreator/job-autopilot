import "server-only";
import { clearanceReason, notRemoteReason, parseSalary, salaryReason } from "./filters";
import { ADDITIONAL_EXPERIENCE, CATEGORY_FOCUS, CERTIFICATIONS, CONTACT, EDUCATION_LINE, SKILLS, WORK_HISTORY, workHistoryText } from "./profile";
import { resumeFileName } from "./filename";
import type { Job, Settings } from "./types";

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

// ---------- The prompt you paste into a Claude chat ----------

const FILLER = [
  "results-driven", "results driven", "detail-oriented", "detail oriented", "dynamic", "passionate",
  "proven track record", "team player", "self-starter", "go-getter", "synergy", "hard-working", "hardworking",
  "think outside the box", "seasoned professional", "highly motivated", "best-in-class", "rockstar",
];

// Everything a fresh Claude chat needs to write one tailored resume: the full posting,
// her whole profile, and every rule. Nothing else has to be typed.
export function buildChatPrompt(job: Job, posting: string): string {
  const extra = ADDITIONAL_EXPERIENCE.map((e) => `- ${e}`).join("\n") || "(none)";
  const file = resumeFileName(job.title);
  return `I'm ${CONTACT.name}. Write my resume tailored to the job posting below, so I read as the right candidate: someone who already does this job. It must pass applicant tracking systems (ATS) and impress the hiring manager. A reader should see the posting's own function, duties, and vocabulary throughout.

Before writing, pick out the posting's exact keywords, required qualifications, responsibilities, tools, and level. Then write the resume using those exact words wherever they truthfully describe my experience.

JOB: ${job.title} at ${job.company ?? "the employer"}
LINK: ${job.url}

FULL JOB POSTING:
${posting.slice(0, 30000)}

ROLE FOCUS: ${CATEGORY_FOCUS[job.category]}

MY WORK HISTORY (numbered in locked order):
${workHistoryText()}

MY ADDITIONAL REAL EXPERIENCE (facts you may use, under the role named in each item):
${extra}

MY CERTIFICATIONS:
${CERTIFICATIONS.map((c) => `- ${c}`).join("\n")}

MY SKILLS BANK:
${SKILLS}

RULES (follow every one):
1. Truth: use only facts, numbers, employers, and dates from my history and additional experience. Never invent a metric, employer, client, tool, clearance, degree, or certification. Reframe my real work in the employer's vocabulary wherever the meaning stays true (for example, Davis-Bacon labor standards work is wage and hour and labor compliance; training clients' staff is training and coaching; coordinating IT, Legal, and executives is partnering with leaders). Do not claim a duty I have no basis for.
2. Fit to this job: pick and rewrite bullets so most of them speak to the posting's listed responsibilities and qualifications, in the posting's words. Drop bullets that point to a different field (for example sales metrics for an HR role) unless the posting asks for them. The summary, titles, bullets, and competencies should all read as this job's function.
3. Titles for MY OWN BUSINESS roles: replace the title with a real, functional job title that truthfully describes the work I did there and relates to the job being applied for. Match the posting's level: if the posting is a Manager role, use Manager, Senior Specialist, Consultant, or Lead level titles; never a title above the posting's level (no Director, VP, Head, or Chief for a Manager posting). Never use Founder, Co-Founder, Owner, Owner/Operator, Proprietor, President, CEO, Principal, ownership Partner, or Self-Employed. Keep the company name, location, and dates exactly as given.
4. Titles for EMPLOYER roles: keep the exact title given.
5. Self-employment: do not present me as an entrepreneur. Never write founded, launched my, my firm, my practice, my company, own business, or startup founder. Describe the work, not the ownership. Include at most two of my own businesses unless more are needed to show the posting's required experience.
6. Never use an em dash or en dash. Use a comma, a colon, or a plain hyphen.
7. No filler phrases such as "results-driven", "detail-oriented", "dynamic", "passionate", or "proven track record".
8. Every bullet contains a specific metric or a named skill, tool, law, regulation, agency, or methodology.
9. The summary is 4 sentences at most. Its first sentence names the posting's role function and my strongest match to the employer's top 2 or 3 priorities. Pitch me at the posting's level, not above it.
10. Core competencies: 9 to 12 short items using the posting's exact terms that my history or additional experience supports.
11. Leave out roles that do not help for this job, but keep the ones you include in the numbered order above. Never reorder them.
12. Education: exactly the one line given in the format below, nothing else. No references, no salary, no personal notes, no trial or engagement offers.
13. Length: 1 to 1.5 pages.
14. Field language: if the posting is not about government contracting, grants, or federal compliance, do not cite federal regulations or programs by name or code (FAR, DFARS, EDGAR, 2 CFR Part 200, 24 CFR Part 58, Davis-Bacon, CMMC, NIST, HUD, CDBG, HOME, LIHTC, SAM.gov) unless the posting names them. Describe that work in the posting's own field terms (compliance, audits, documentation, policy, training) or leave it out.
15. Scale: leave out details that make my work sound small, such as small budgets.
16. Do not claim knowledge of specific state laws or "multi-state employment law" unless my history says so. My NC, SC, and GA work was compliance training and technical assistance.

OUTPUT:
1. Show the resume as text in exactly this structure:
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
- ${EDUCATION_LINE}

2. Then create a Word document (.docx) named "${file}.docx" with the same resume, formatted for ATS: one column, standard section headings, simple bullets, no tables, text boxes, images, or headers and footers, and a clean professional font.`;
}

const OWNER_WORDS = /\b(founder|co-founder|founded|owner|owner\/operator|proprietor|self-employed|my firm|my practice|my company)\b/i;
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
export function postingFlags(job: Job, posting: string, settings: Settings): string[] {
  const flags: string[] = [];
  const text = `${job.title}\n${posting}`;
  if (!posting) flags.push("Could not load the full posting; open the link and paste the description into the chat yourself");
  const clearance = clearanceReason(text);
  if (clearance) flags.push(clearance);
  const notRemote = notRemoteReason(text);
  if (notRemote) flags.push(notRemote);
  const low = salaryReason(parseSalary(text).max, settings.min_salary);
  if (low) flags.push(low);
  return flags;
}
