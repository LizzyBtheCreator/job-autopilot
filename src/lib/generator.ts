import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase'
import type { Category, DiscoveredJob } from './types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Fetch the actual job page and strip HTML to get full job description
async function fetchJobContent(url: string): Promise<string> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    let res: Response
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) return ''
    // Use a race so a slow body read also gets cut off
    const html = await Promise.race([
      res.text(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('body timeout')), 5000)),
    ])
    const text = (html as string)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      // Replace common non-ASCII punctuation with ASCII equivalents before stripping
      .replace(/[•‣◦⁃∙]/g, '-') // bullets → dash
      .replace(/[–—―]/g, '-')              // en/em dashes → dash
      .replace(/[‘’]/g, "'")                    // smart single quotes
      .replace(/[“”]/g, '"')                    // smart double quotes
      .replace(/[^\x00-\x7F]/g, ' ')                      // strip remaining non-ASCII
      .replace(/\s{2,}/g, ' ')
      .trim()
    return text.slice(0, 4000)
  } catch {
    return ''
  }
}

// Extract structured requirements from a full job description using Haiku
async function extractRequirements(jobTitle: string, company: string, fullDescription: string): Promise<string> {
  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Extract the key requirements and must-have skills from this job posting. Be specific — pull exact phrases and keywords the employer used.

Job: ${jobTitle} at ${company}
Description: ${fullDescription.slice(0, 3000)}

List:
- Required skills and tools (exact names)
- Years of experience if mentioned
- Key responsibilities in the employer's language
- Nice-to-have / bonus qualifications
- Industry or domain knowledge required

Be specific and concise. Use the employer's exact wording where possible.`,
      }],
    })
    return res.content.find(b => b.type === 'text')?.text ?? ''
  } catch {
    return ''
  }
}

const ELIZABETH = {
  name: 'Elizabeth H. McMillan',
  location: 'Fayetteville, NC (Remote)',
  phone: '(910) 479-4839',
  email: 'elimcmillan@myyahoo.com',
}

// Work history in REVERSE CHRONOLOGICAL order (most recent first) — do not change this order
const WORK_HISTORY = `
DefenseComply Pro - Founder (Remote) | 2025 to Present
- Building a compliance intelligence SaaS platform under Defense Compliance Solutions for defense contractors and federal cloud vendors pursuing CMMC, FedRAMP, and FISMA authorization
- Platform replaces the traditional $15,000-$50,000 consultant-led assessment with AI-powered control gap analysis, automated policy generation, POA&M management, evidence tracking, live SPRS scoring, and assessor-ready documentation export
- Designed subcontractor flow-down management, contract/RFP compliance scanning, and a managed services concierge module that connects clients to compliance experts for hands-on program execution
- Productizing 18 years of federal compliance program management experience - including an active advisory practice and prior sales team - into a scalable SaaS platform serving the 300,000+ CMMC-obligated contractor market

DefenseComply - Founder and Principal Compliance Advisor (Remote) | 2024 to Present
- Founded and operate an active compliance advisory practice serving small and mid-size defense contractors pursuing CMMC certification and DoD contract eligibility
- Lead clients through full compliance program lifecycle including NIST SP 800-171 Rev. 3 gap assessments, System Security Plan (SSP) and POA&M documentation, evidence pack development, and SPRS scoring
- Translate complex regulatory requirements including CMMC, NIST 800-171, and DFARS flow-down obligations into actionable remediation roadmaps and 30-day implementation plans
- Coordinate alignment across client IT, Legal, contracts, and executive stakeholders to drive compliance milestones against procurement and contractual deadlines

BidWinAlert - Founder (Remote) | 2024 to Present
- Founded and launched a government contracting intelligence platform that automates opportunity discovery, proposal readiness, and compliance tracking for federal contractors with paying clients
- Defined product vision, go-to-market strategy, pricing model, and subscription structure for a SaaS platform serving the govcon market
- Translated 18 years of hands-on federal BD and proposal experience into a scalable product, demonstrating the ability to identify market gaps, build AI-powered solutions, and deliver them to production

Federal Contracting Solutions - Senior Business Development Consultant (Remote) | June 2021 to December 2024
- Drove $320M+ in government contract activity with a sustained 72% win rate across DoD military departments (Army, Navy, Air Force, Space Force, SOCOM, CYBERCOM, DIA, DISA), HUD, HHS, and GSA
- Applied Shipley methodology to lead capture campaigns 6+ months prior to RFP release; developed win strategies, sales themes, and differentiating narratives for competitive RFPs, RFIs, BAAs, OTAs, and IDIQ task orders
- Briefed senior leadership and executive stakeholders on capture strategy, competitive positioning, and go/no-go recommendations for high-value pursuits
- Conducted competitive intelligence and win/loss analysis; identified competitor vulnerabilities and developed mitigation strategies through teaming, key partnerships, and solution differentiation
- Developed and executed small business and teaming partner strategies; negotiated teaming agreements and coordinated partner inputs across all pursuit phases
- Directed cross-functional pursuit teams of 100+ across in-house staff and teaming partners from opportunity identification through award
- Built and maintained direct agency relationships across Air Force, Space Force, and defense agency stakeholders to inform positioning and competitive intelligence
- Managed 200+ account pipeline using Salesforce and HubSpot; developed price-to-win models and cost/price proposals across CPFF, T&M, FFP, and fixed-price contract types

Syxsense - Senior Business Development Specialist (Remote) | January 2022 to January 2024
- Expanded presence in federal IT ecosystem; increased revenue from key accounts by 40% through consultative selling
- Delivered live technical demos of IT management software: endpoint security, patch management, and automation features
- Created targeted BD campaigns aligned with technology trends including cloud, cybersecurity, and automation
- Enhanced operational efficiency by 35% through improved system integration and streamlined customer workflows
- Led pricing research, coordinated teaming partnerships, and drove RFI/RFP readiness for priority pipeline

GoHighLevel - Business Development Specialist (Remote) | September 2019 to December 2023
- Closed $3M+ in recurring revenue through direct client acquisition and strategic partnerships
- Achieved 120% of sales quotas through solution-focused client engagement
- Managed end-to-end pursuit of federal opportunities across 10+ agencies
- Configured cloud-based CRM and marketing automation systems for clients; trained end-users remotely
- Designed BD plans enabling on-time and compliant proposal delivery

Precise Consulting Services - Principal Consultant (Remote) | 2006 to Present
- Secured and administered $325M+ in federal funding for clients across housing, education, and community development over 13+ years
- Managed full grant lifecycle across HUD, CDBG, HOME, LIHTC, CDFI, HUD-VASH, and Grants Per Diem programs including procurement, compliance, reporting, audit preparation, and closeout
- Provided federal compliance advisory across 2 CFR Part 200, FAR, EDGAR, Davis-Bacon, environmental review (24 CFR Part 58), and SAM.gov navigation with zero audit findings across 100+ client engagements
- Wrote and developed winning federal proposals and grant applications across defense, civilian, and housing program areas
- Delivered government contracting compliance training and technical assistance to organizations across NC, SC, and GA
- Directed community development program serving 200+ at-risk youth and families annually over 8 years

Tax and Financial Services Practice - Owner/Operator | Fayetteville, NC
- Operated a tax preparation and financial advisory practice serving individual and small business clients
- Conducted credit analysis including financial statement review, cash flow analysis, and creditworthiness assessment
- Managed loan portfolio advisory and supported clients in structuring financing arrangements
- Maintained client financial records, prepared federal and state tax filings, and provided financial planning guidance

Social Media Management Company - Owner/Founder (Remote)
- Managed content strategy, paid advertising, and community management for client accounts
- Ran Facebook and Instagram ad campaigns with measurable ROI for diverse client base
- Developed brand strategy and digital content calendars aligned to client business goals
- Acquired and retained client accounts through consultative service delivery

Found Crisis Services - Founder and Director | Fayetteville, NC
- Founded and operated a crisis intervention and community support organization serving underserved populations
- Designed and implemented community-based programs using trauma-informed, strengths-based service delivery
- Served 200+ underprivileged youth and families annually over 8 years on a lean operating budget under $1,000/month
- Coordinated community partnerships, stakeholder engagement, and public sector collaboration
`

const CERTS = `
- Project Management Professional (PMP) - Project Management Institute
- Certified Business Development Expert (CBDE)
- Certified ScrumMaster (CSM)
- Google Data Analytics Certificate
- CompTIA A+ (in progress)
`

const EDU = `
MS Information Technology - Western Governors University (in progress, 2027)
Fayetteville Technical Community College
Fayetteville State University
`

const SKILLS = `
Sales and Business Development: CRM tools (Salesforce, HubSpot, GoHighLevel), consultative selling, pipeline management (200+ accounts), lead generation (tool-agnostic), SaaS sales, social media management and digital marketing, content creation and brand strategy, Facebook/Instagram paid advertising, community management, account management, quota attainment (120%), $3M+ in recurring revenue closed

Government Contracting and Compliance: Capture management, proposal management (Shipley methodology), federal BD lifecycle ($320M+ contract activity, 72% win rate), SBA 8(a)/GSA/IDIQ/GWAC/OTA/BAA vehicles, FAR/DFARS compliance, teaming partnerships, tribal procurement (ANCs), 2 CFR Part 200 (Uniform Guidance), CDBG full program lifecycle, Davis-Bacon labor standards, environmental review (24 CFR Part 58), HUD/IDIS reporting, single audit preparation, SAM.gov navigation, EDGAR compliance, grant writing and federal proposal development, LIHTC/HOME/HUD-VASH/CDFI program knowledge, win strategy and price-to-win, 100+ client engagements with zero audit findings

IT and Technical: Syxsense (endpoint security, patch management, automation), cloud platform administration, CRM administration, technical client support, remote troubleshooting, IT project coordination, Next.js, Supabase, Stripe integration, Anthropic API

Program and Project Management: PMP-certified project management, cross-functional team leadership (100+, in-house and teaming partners), program design and implementation, stakeholder engagement, training design and delivery, community development program design, operational efficiency improvement (35%)

Tools: Microsoft Office 365, Salesforce, HubSpot, GoHighLevel, Supabase, Next.js, Stripe
`

const categoryContext: Record<Category, string> = {
  sales: 'Prioritize and lead with: $3M+ closed recurring revenue, 120% quota attainment, 200+ account pipeline management, CRM expertise (Salesforce, HubSpot, GoHighLevel), consultative selling, SaaS sales, social media advertising, content strategy, lead generation. Include GoHighLevel, Federal Contracting Solutions, and Syxsense as primary roles.',
  govcon: 'Prioritize and lead with: $320M+ in government contract activity, 72% proposal win rate, Shipley methodology, capture and proposal management across DoD military departments (Army, Navy, Air Force, Space Force, SOCOM, CYBERCOM, DIA, DISA) and civilian agencies (HUD, HHS, GSA), federal contract vehicles (SBA 8(a), GSA, IDIQ, GWAC, OTA, BAA), 2 CFR Part 200, FAR/DFARS, CDBG, SAM.gov, grant writing, HUD programs, 100+ client engagements with zero audit findings. Precise Consulting Services is the anchor role - always include it with full bullets. Include Federal Contracting Solutions and BidWinAlert.',
  datacenter: 'Prioritize and lead with: IT operations coordination, Syxsense (endpoint security, patch management, automation), cross-functional team leadership (30+), cloud platform administration, technical client support, 35% efficiency improvement, CompTIA A+ in progress, BS IT in progress. Focus on coordination and operations roles only.',
  quickhire: 'Prioritize and lead with: customer service, administrative coordination, operations coordination, executive assistant, data entry, sales support, 15+ years experience, Microsoft Office, CRM systems, strong communication, highly organized, remote work experienced.',
  temp: 'This is a TEMP or CONTRACT placement role sourced from a staffing agency (Adecco, Robert Half, etc.). Lead with availability, breadth of experience, and quick ramp-up. Emphasize: available immediately, 16+ years of federal contracting experience, adaptable to multiple environments, PMP-certified, remote-capable. Pull from Federal Contracting Solutions, Precise Consulting, and Syxsense as primary roles. Keep it direct and practical — the employer wants someone who can start fast and contribute immediately.',
  compliance: 'This is a PUBLIC SECTOR COMPLIANCE or GRC role. Lead with compliance program management and regulatory framework expertise. Primary roles to include: DefenseComply Pro (FedRAMP/CMMC SaaS platform under Defense Compliance Solutions), DefenseComply advisory practice (active CMMC/NIST client work), Federal Contracting Solutions (cross-functional program leadership, DFARS/FAR), Precise Consulting (18 years federal compliance, zero audit findings). KEY FRAMEWORKS to name prominently: CMMC, NIST 800-171, NIST 800-53, FedRAMP, FISMA, FAR/DFARS, 2 CFR Part 200, SAM.gov. KEY SKILLS to emphasize: cross-functional stakeholder alignment (IT, Legal, Engineering, GRC, Sales), POA&M management, SSP documentation, evidence pack development, SPRS scoring, compliance program roadmap development, governance model design, audit readiness, zero audit findings across 100+ engagements. NEVER lead with BD or sales metrics in this category. Frame Precise Consulting as federal compliance program management, not grants. Frame DefenseComply Pro as productizing 18 years of compliance expertise into a scalable SaaS platform - the Vanta for defense contractors.',
}

// Strip non-ASCII characters that cause ByteString errors in the Anthropic API
function toAscii(s: string): string {
  return s
    .replace(/[•‣◦⁃∙]/g, '-')
    .replace(/[–—―]/g, '-')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^\x00-\x7F]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Returns true if the job salary appears to be $100K or more
function isSalaryOver100k(job: DiscoveredJob): boolean {
  if (job.salary_min != null && job.salary_min >= 100000) return true
  if (job.salary_max != null && job.salary_max >= 100000) return true
  return false
}

export async function generateResumeAndCoverLetter(job: DiscoveredJob): Promise<{
  resume: string
  coverLetter: string
}> {
  const category = (job.category ?? 'sales') as Category
  const context = categoryContext[category]
  const includeTrialSection = isSalaryOver100k(job)

  // Step 1: Fetch the real job page content (not just the search snippet)
  const fullContent = job.url ? await fetchJobContent(job.url) : ''
  const richDescription = toAscii(fullContent.length > 200 ? fullContent : (job.description ?? ''))
  const jobTitle = toAscii(job.title)
  const jobCompany = toAscii(job.company)

  // Step 2: Extract specific requirements using Haiku — cheap, fast
  const requirements = await extractRequirements(jobTitle, jobCompany, richDescription)

  const jobContext = `
JOB TITLE: ${jobTitle}
COMPANY: ${jobCompany}
EXTRACTED KEY REQUIREMENTS (mirror these exactly in the resume — use the employer's language):
${requirements || 'See job description below.'}

FULL JOB DESCRIPTION:
${richDescription.slice(0, 2000)}`

  const trialSectionInstructions = includeTrialSection
    ? `- After the Professional Summary, include a short "Trial Engagement Available" note (2-3 sentences max) that offers a one-week no-risk trial beginning within 10 business days of the first interview. Reference the 72% win rate or $320M+ portfolio. Keep it confident and frame it as standard consulting practice, not desperation. State clearly that the offer expires if not started within 10 business days of first interview.`
    : `- Do NOT include a Trial Engagement section. This role does not meet the salary threshold for that offer.`

  const trialSectionFormat = includeTrialSection
    ? `
[SECTION]TRIAL ENGAGEMENT AVAILABLE[/SECTION]
2-3 sentences. One week, must start within 10 business days of first interview. Reference specific results. Confident, not desperate.`
    : ''

  const resumeRes = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: `You are writing a highly tailored, interview-winning resume for Elizabeth McMillan. This resume must be so well-matched to the job that a hiring manager immediately sees her as a top candidate.

${jobContext}

CATEGORY: ${category}
CATEGORY FOCUS: ${context}

ELIZABETH'S INFO:
${ELIZABETH.name} | ${ELIZABETH.location} | ${ELIZABETH.phone} | ${ELIZABETH.email}

WORK HISTORY — REVERSE CHRONOLOGICAL, LOCKED ORDER (most recent first, oldest last):
${WORK_HISTORY}

CERTIFICATIONS:
${CERTS}

EDUCATION:
${EDU}

FULL SKILLS BANK (pull relevant skills from here based on the role):
${SKILLS}

RESUME WRITING RULES:
- Do NOT use em dashes (—) anywhere. Use a hyphen (-) or rewrite the sentence.
- Do NOT use generic filler phrases like "results-driven", "detail-oriented", "dynamic", "passionate", or "proven track record of success"
- Every bullet must contain a specific achievement, metric, or named skill — no vague statements
- Mirror the employer's EXACT language and keywords from the extracted requirements — if they say "win/loss ratio", use "win/loss ratio"; if they say "sales themes", use "sales themes"; if they say "solutioning", use "solutioning"
- The Professional Summary (4 sentences max) must open with the most compelling match to this specific role and name the employer's top 2-3 priorities directly
- Each bullet in the PRIMARY role must address at least one requirement from the extracted key requirements
- If the job names a specific agency, branch, or domain (e.g., Air Force, Space Force), name it prominently in the summary AND in the relevant bullets
- If the job names a methodology (e.g., Shipley), name it in the summary AND experience
- If the job names a tool (e.g., Salesforce), name it in experience
- Omit roles that add no value for this specific position — but NEVER reorder the roles you keep. Order is locked: ATO Pilot first, then DefenseComply, then BidWinAlert, then Federal Contracting Solutions, then Syxsense, then GoHighLevel, then Precise Consulting Services. Skip any, but never swap. For compliance category resumes, ATO Pilot and DefenseComply are the anchor roles and must always be included.
- No references section. No salary. No personal notes.
- Do NOT include an Education section.
- Target length: 1 to 1.5 pages — strong and complete, not padded, not cut short
${trialSectionInstructions}

FORMAT OUTPUT EXACTLY — PDF renderer requires these markers:

[HEADER]
Elizabeth H. McMillan
Fayetteville, NC (Remote) | (910) 479-4839 | elimcmillan@myyahoo.com
[/HEADER]

[SECTION]PROFESSIONAL SUMMARY[/SECTION]
4 sentences max. Lead with the strongest match. Name the role's top priorities. Close with a differentiator.
${trialSectionFormat}
[SECTION]PROFESSIONAL EXPERIENCE[/SECTION]
[JOB]Company Name - Job Title | Start Date - End Date[/JOB]
- Bullet using employer's exact language
- Bullet with specific metric or achievement

[SECTION]CERTIFICATIONS[/SECTION]
- Certification`,
      },
    ],
  })

  const clean = (text: string) => text.replace(/—/g, '-').replace(/–/g, '-')
  const resume = clean(resumeRes.content.find(b => b.type === 'text')?.text ?? '')

  return { resume, coverLetter: '' }
}

// ─── Fractional brochure ────────────────────────────────────────────────────

interface BrochureContent {
  opening: string          // 2 paragraphs, why THIS company/role specifically
  differentiators: Array<{ head: string; text: string }>  // 4 items
  pursuits: Array<{ agency: string; vehicle: string; desc: string; value: string }>  // 3 items
  plan: {
    d1: { heading: string; items: string[] }
    d2: { heading: string; items: string[] }
    d3: { heading: string; items: string[] }
  }
  recruiter_note: string   // 2 paragraphs for the recruiter section
  payment_note: string     // 1-2 sentences on payment flexibility
  savings_low: string      // e.g. "$80K"
  savings_high: string     // e.g. "$120K+"
  salary_range: string     // e.g. "$200K-$240K" (from job) or "the posted range"
}

function buildBrochureHTML(job: DiscoveredJob, c: BrochureContent): string {
  const paragraphs = c.opening.split('\n\n').filter(Boolean)
  const p1 = paragraphs[0] ?? c.opening
  const p2 = paragraphs[1] ?? ''

  const rParagraphs = c.recruiter_note.split('\n\n').filter(Boolean)
  const r1 = rParagraphs[0] ?? c.recruiter_note
  const r2 = rParagraphs[1] ?? ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fractional Engagement Brief - ${job.company}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{--bg:#FFFFFF;--surface:#F0F5FA;--surface2:#E4EDF5;--accent:#1560BD;--accent-light:#E8F0FB;--text:#1A2B3C;--text-mid:#3D5A7A;--text-muted:#6B8AAB;--border:#D0DDE9;--stat-bg:#0A2342;--stat-num:#4FB3E8;}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0C1822;--surface:#101F2E;--surface2:#162840;--accent:#4FB3E8;--accent-light:#0D2240;--text:#D0E4F4;--text-mid:#8AAEC8;--text-muted:#5A7A9B;--border:#1E3A5C;--stat-bg:#0D2240;--stat-num:#4FB3E8;}}
:root[data-theme="dark"]{--bg:#0C1822;--surface:#101F2E;--surface2:#162840;--accent:#4FB3E8;--accent-light:#0D2240;--text:#D0E4F4;--text-mid:#8AAEC8;--text-muted:#5A7A9B;--border:#1E3A5C;--stat-bg:#0D2240;--stat-num:#4FB3E8;}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:'DM Sans',system-ui,sans-serif;font-size:14px;line-height:1.65;max-width:920px;margin:0 auto;}
.top-band{background:var(--stat-bg);color:#FFF;padding:32px 52px 28px;border-bottom:3px solid var(--accent);}
.tb-eyebrow{font-family:'IBM Plex Mono',monospace;font-size:9.5px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:var(--stat-num);margin-bottom:14px;}
.tb-name{font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#FFF;line-height:1.15;margin-bottom:6px;}
.tb-title{font-size:15px;color:#7AACC8;margin-bottom:18px;}
.tb-contact{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#4A7AA0;display:flex;flex-wrap:wrap;gap:4px 20px;}
.tb-contact span{color:var(--stat-num);}
.stats{display:grid;grid-template-columns:repeat(5,1fr);background:var(--surface2);border-bottom:1px solid var(--border);overflow:hidden;}
.stat{padding:18px 14px;text-align:center;border-right:1px solid var(--border);}
.stat:last-child{border-right:none;}
.stat-num{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:var(--accent);line-height:1;margin-bottom:4px;}
.stat-label{font-size:10.5px;color:var(--text-muted);line-height:1.3;}
.body{padding:40px 52px 56px;}
.section{margin-bottom:34px;}
.section-label{font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid var(--border);}
.prose{font-size:14px;color:var(--text-mid);line-height:1.75;}
.prose strong{color:var(--text);font-weight:600;}
.prose+.prose{margin-top:12px;}
.vp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.vp-card{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:18px 20px;border-top:3px solid var(--accent);}
.vp-head{font-size:13.5px;font-weight:700;color:var(--text);margin-bottom:8px;}
.vp-text{font-size:13px;color:var(--text-mid);line-height:1.6;}
.pursuits{display:flex;flex-direction:column;gap:14px;}
.pursuit{background:var(--surface);border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:0 6px 6px 0;padding:16px 20px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:start;}
.pursuit-agency{font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px;}
.pursuit-vehicle{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-muted);margin-bottom:6px;letter-spacing:.06em;}
.pursuit-desc{font-size:13px;color:var(--text-mid);line-height:1.55;}
.pursuit-value{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--accent);white-space:nowrap;text-align:right;padding-top:2px;}
.cap-table{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.cap-phase{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:16px 18px;}
.cap-period{font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:4px;}
.cap-heading{font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;}
.cap-items{list-style:none;display:flex;flex-direction:column;gap:5px;}
.cap-items li{font-size:12.5px;color:var(--text-mid);padding-left:14px;position:relative;}
.cap-items li::before{content:'-';position:absolute;left:0;color:var(--accent);font-weight:700;}
.recruiter-intro{background:var(--accent-light);border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:0 6px 6px 0;padding:18px 22px;margin-bottom:16px;}
.recruiter-label{font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin-bottom:8px;}
.recruiter-text{font-size:13.5px;color:var(--text-mid);line-height:1.7;}
.recruiter-text strong{color:var(--text);}
.roi-table{border:1px solid var(--border);border-radius:6px;overflow:hidden;font-size:13px;}
.roi-row{display:grid;grid-template-columns:2fr 1fr 1fr;border-bottom:1px solid var(--border);}
.roi-row:last-child{border-bottom:none;}
.roi-cell{padding:12px 16px;color:var(--text-mid);}
.roi-row.header .roi-cell{background:var(--surface2);color:var(--text);font-family:'IBM Plex Mono',monospace;font-size:9.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;}
.roi-cell.win{color:var(--accent);font-weight:700;}
.roi-cell.dim{color:var(--text-muted);}
.save-strip{margin-top:14px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:16px 20px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;}
.save-num{font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:var(--accent);white-space:nowrap;}
.save-text{font-size:13px;color:var(--text-mid);line-height:1.55;}
.save-text strong{color:var(--text);}
.flex-note{margin-top:14px;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:14px 18px;}
.flex-label{font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:6px;}
.flex-text{font-size:13px;color:var(--text-mid);line-height:1.6;}
.flex-text strong{color:var(--text);}
.footer{border-top:1px solid var(--border);padding-top:20px;margin-top:10px;font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--text-muted);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;}
@media print{.top-band{padding:22px 36px 18px;}.body{padding:28px 36px 36px;}}
</style>
</head>
<body>
<div class="top-band">
  <div class="tb-eyebrow">${job.title} | ${job.company}</div>
  <div class="tb-name">Elizabeth H. McMillan</div>
  <div class="tb-title">Capture Management and Business Development Executive | Fractional and Full-Time Available</div>
  <div class="tb-contact">
    <span>(910) 479-4839</span>
    <span>elimcmillan@myyahoo.com</span>
    <span>Fayetteville, NC, Remote</span>
    <span>WBE / MBE / SBE</span>
  </div>
</div>
<div class="stats">
  <div class="stat"><div class="stat-num">$320M+</div><div class="stat-label">Contract activity led</div></div>
  <div class="stat"><div class="stat-num">72%</div><div class="stat-label">Proposal win rate</div></div>
  <div class="stat"><div class="stat-num">18+</div><div class="stat-label">Years in federal BD</div></div>
  <div class="stat"><div class="stat-num">100+</div><div class="stat-label">Team members led</div></div>
  <div class="stat"><div class="stat-num">10+</div><div class="stat-label">GWACs and IDIQs managed</div></div>
</div>
<div class="body">
  <div class="section">
    <div class="section-label">Why ${job.company}, and why now</div>
    <div class="prose">${p1}</div>
    ${p2 ? `<div class="prose" style="margin-top:12px;">${p2}</div>` : ''}
  </div>
  <div class="section">
    <div class="section-label">Where I outperform: four specific differentiators</div>
    <div class="vp-grid">
      ${c.differentiators.map(d => `
      <div class="vp-card">
        <div class="vp-head">${d.head}</div>
        <div class="vp-text">${d.text}</div>
      </div>`).join('')}
    </div>
  </div>
  <div class="section">
    <div class="section-label">Relevant experience</div>
    <div class="pursuits">
      ${c.pursuits.map(p => `
      <div class="pursuit">
        <div>
          <div class="pursuit-agency">${p.agency}</div>
          <div class="pursuit-vehicle">${p.vehicle}</div>
          <div class="pursuit-desc">${p.desc}</div>
        </div>
        <div class="pursuit-value">${p.value}</div>
      </div>`).join('')}
    </div>
  </div>
  <div class="section">
    <div class="section-label">First 90 days: engagement plan for ${job.company}</div>
    <div class="cap-table">
      <div class="cap-phase">
        <div class="cap-period">Days 1-30</div>
        <div class="cap-heading">${c.plan.d1.heading}</div>
        <ul class="cap-items">${c.plan.d1.items.map(i => `<li>${i}</li>`).join('')}</ul>
      </div>
      <div class="cap-phase">
        <div class="cap-period">Days 31-60</div>
        <div class="cap-heading">${c.plan.d2.heading}</div>
        <ul class="cap-items">${c.plan.d2.items.map(i => `<li>${i}</li>`).join('')}</ul>
      </div>
      <div class="cap-phase">
        <div class="cap-period">Days 61-90</div>
        <div class="cap-heading">${c.plan.d3.heading}</div>
        <ul class="cap-items">${c.plan.d3.items.map(i => `<li>${i}</li>`).join('')}</ul>
      </div>
    </div>
  </div>
  <div class="section">
    <div class="section-label">A note to the recruiter: the fractional option</div>
    <div class="recruiter-intro">
      <div class="recruiter-label">For your consideration</div>
      <div class="recruiter-text">
        ${r1}
        ${r2 ? `<br><br>${r2}` : ''}
      </div>
    </div>
    <div class="roi-table">
      <div class="roi-row header">
        <div class="roi-cell">Cost item</div>
        <div class="roi-cell">Fractional engagement</div>
        <div class="roi-cell">W2 full-time hire</div>
      </div>
      <div class="roi-row">
        <div class="roi-cell">Salary / compensation</div>
        <div class="roi-cell win">Project-scoped only</div>
        <div class="roi-cell dim">${c.salary_range} base</div>
      </div>
      <div class="roi-row">
        <div class="roi-cell">Employer payroll taxes (FICA, FUTA)</div>
        <div class="roi-cell win">None</div>
        <div class="roi-cell dim">~$15K-$22K/yr</div>
      </div>
      <div class="roi-row">
        <div class="roi-cell">Health, dental, vision (employer share)</div>
        <div class="roi-cell win">None</div>
        <div class="roi-cell dim">~$15K-$25K/yr</div>
      </div>
      <div class="roi-row">
        <div class="roi-cell">401(k) match and bonus</div>
        <div class="roi-cell win">None</div>
        <div class="roi-cell dim">$10K-$40K/yr additional</div>
      </div>
      <div class="roi-row">
        <div class="roi-cell">Recruiting fee (if agency sourced)</div>
        <div class="roi-cell win">None</div>
        <div class="roi-cell dim">$25K-$50K one-time</div>
      </div>
      <div class="roi-row">
        <div class="roi-cell">Time to first real contribution</div>
        <div class="roi-cell win">1 week</div>
        <div class="roi-cell dim">60-90 day ramp</div>
      </div>
      <div class="roi-row">
        <div class="roi-cell">Exposure if priorities shift</div>
        <div class="roi-cell win">None; engagement ends</div>
        <div class="roi-cell dim">Severance and re-search cost</div>
      </div>
    </div>
    <div class="save-strip">
      <div class="save-num">${c.savings_low}-${c.savings_high}</div>
      <div class="save-text">
        <strong>Estimated first-year savings vs. a fully loaded W2 hire,</strong> before accounting for recruiting fees, onboarding lag, and any gap in active pursuit coverage during the search. A fractional engagement removes that window entirely.
      </div>
    </div>
    <div class="flex-note">
      <div class="flex-label">Payment structure flexibility</div>
      <div class="flex-text">${c.payment_note}</div>
    </div>
  </div>
  <div class="footer">
    <span>Elizabeth H. McMillan | (910) 479-4839 | elimcmillan@myyahoo.com</span>
    <span>WBE / MBE / SBE | Available Immediately | Open to Full-Time Conversion</span>
  </div>
</div>
</body>
</html>`
}

export async function generateFractionalBrochure(job: DiscoveredJob, resumeText?: string): Promise<string> {
  const fullContent = job.url ? await fetchJobContent(job.url) : ''
  const richDescription = fullContent.length > 200 ? fullContent : (job.description ?? '')
  const requirements = await extractRequirements(job.title, job.company, richDescription)

  const salaryRaw = job.salary_raw ?? 'the posted range'

  const resumeSection = resumeText
    ? `\nRESUME ALREADY GENERATED FOR THIS ROLE (your brochure MUST align with this exactly — same job titles, same company names, same numbers, same time periods, same claims):
${resumeText.slice(0, 2000)}\n`
    : ''

  const prompt = `You are writing content for a fractional engagement brochure. The brochure is written in FIRST PERSON — the voice is "I", not "she" or "Elizabeth". This is a sales document written by the candidate herself, not about her.

Role being applied for: ${job.title} at ${job.company}.

JOB REQUIREMENTS:
${requirements || richDescription.slice(0, 2000)}
${resumeSection}
PROFILE (use these exact figures and facts — do not invent new ones):
- 18+ years federal BD and govcon
- $320M+ in contract activity, 72% win rate
- Led teams of 100+, 10+ GWACs and IDIQs managed
- Agencies: Army, Navy, Air Force, Space Force, SOCOM, CYBERCOM, DIA, DISA, HUD, HHS, GSA
- Certifications: PMP, CBDE, CSM, Google Data Analytics
- Founded BidWinAlert (govcon SaaS), DefenseComply Pro, and Precise Consulting Services
- CMMC, NIST 800-171, FedRAMP, DFARS, FAR, 2 CFR Part 200 expertise
- Tribal procurement (ANCs, $2M+ annually)
- Shipley methodology, capture management, OTA, SBIR/STTR

Generate a JSON object (no markdown, no code fences, just raw JSON) with this exact structure:
{
  "opening": "2 paragraphs separated by \\n\\n. FIRST PERSON throughout — 'I have spent...', 'My background...', 'What drew me to this role...'. First paragraph: why THIS specific company and role is compelling, referencing something specific from the job description. Second paragraph: the most relevant experience for this specific role, in first person.",
  "differentiators": [
    {"head": "short title", "text": "3-4 sentences, FIRST PERSON, tailored to this specific role's requirements. 'I bring...', 'My experience in...', 'I have led...'"},
    {"head": "...", "text": "..."},
    {"head": "...", "text": "..."},
    {"head": "...", "text": "..."}
  ],
  "pursuits": [
    {"agency": "Agency/Client: brief descriptor", "vehicle": "Vehicle type and FAR/DFAR reference", "desc": "2-3 sentences, FIRST PERSON. 'I led...', 'I built...', 'I negotiated...'. How this maps to the role's needs. End with 'Result: [outcome].'", "value": "$XM"},
    {"agency": "...", "vehicle": "...", "desc": "...", "value": "..."},
    {"agency": "...", "vehicle": "...", "desc": "...", "value": "..."}
  ],
  "plan": {
    "d1": {"heading": "Phase name tailored to this role", "items": ["5 specific actions for days 1-30 — action-oriented, not 'I will', just the action: 'Review active pipeline', 'Map incumbent landscape'"]},
    "d2": {"heading": "...", "items": ["5 items"]},
    "d3": {"heading": "...", "items": ["4 items"]}
  },
  "recruiter_note": "2 paragraphs separated by \\n\\n. NOT first person — this section speaks TO the recruiter about the candidate. First: what the recruiter is dealing with (applicant volume, decision timeline, active work that cannot wait). Second: why presenting the fractional option makes the recruiter look like a strategic partner to their hiring manager, not just a sourcer. Be specific to this company and role.",
  "payment_note": "2 sentences, FIRST PERSON. 'I am flexible...' State openness to hourly, project-based, or retainer. Make it specific to what this company's procurement process might require.",
  "savings_low": "$80K",
  "savings_high": "$130K+",
  "salary_range": "${salaryRaw}"
}

STRICT RULES — violations will cause rejection:
- FIRST PERSON everywhere except the recruiter_note section. Never write 'Elizabeth brings' or 'she has' or refer to the candidate in third person in any other section.
- No em dashes anywhere. Use commas, colons, or periods instead.
- No double hyphens. Use single hyphens or rewrite.
- No generic filler: no "results-driven", "passionate", "dynamic", "proven track record", "seasoned professional"
- Every number and job title must match the resume if one was provided above
- The 90-day plan items must be specific to this company and role, not generic bullet points
- Differentiators must map directly to the job's stated requirements
- Output ONLY the raw JSON object, nothing before or after it`

  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = res.content.find(b => b.type === 'text')?.text ?? '{}'
  // Strip any accidental markdown fences
  const jsonStr = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

  let content: BrochureContent
  try {
    content = JSON.parse(jsonStr) as BrochureContent
  } catch {
    // Fallback: use a minimal valid structure rather than crashing
    content = {
      opening: `${job.company}'s ${job.title} role maps directly to 18 years of federal BD and capture leadership.\n\nElizabeth McMillan has led $320M+ in government contract activity with a 72% win rate across DoD and civilian agencies.`,
      differentiators: [
        { head: 'Federal capture expertise', text: 'Army, Navy, Air Force, Space Force, SOCOM, CYBERCOM, DIA, DISA, HUD, HHS, and GSA. Win themes built from actual customer intelligence.' },
        { head: 'GWAC and IDIQ vehicle depth', text: '10+ major vehicles managed including GSA, SBA 8(a), OTA, BAA, and IDIQ task orders. On-ramp strategy and competitive positioning from day one.' },
        { head: 'Compliance and technical credibility', text: 'CMMC, NIST 800-171, FedRAMP, DFARS, FAR. No translation layer needed between compliance requirements and capture strategy.' },
        { head: 'Tribal procurement and ANC experience', text: 'Alaskan Native Corporation teaming generating $2M+ annually. A meaningful competitive differentiator in defense acquisition.' },
      ],
      pursuits: [
        { agency: 'DoD IT Modernization: Multi-Agency IDIQ On-Ramp', vehicle: 'IDIQ Task Order / FAR Part 15', desc: 'Led end-to-end capture from shaping through submission with a 12-person cross-functional team. Win themes centered on zero-trust architecture and endpoint compliance automation. Result: Award.', value: '$180M' },
        { agency: 'Space Force / Air Force: Digital Transformation', vehicle: 'OTA / CSO with follow-on IDIQ', desc: 'Capture lead from white paper through prototype to IDIQ pursuit. Managed 20-person integrated product team. Result: Prototype award and IDIQ on-ramp.', value: '$95M' },
        { agency: 'DIA / DISA: Cyber Intelligence Support', vehicle: 'GWAC Task Order', desc: 'Full capture plan, solutioning sessions, price-to-win analysis against three incumbents. Coordinated 8(a) teaming. Result: Award, highest-rated technical proposal.', value: '$47M' },
      ],
      plan: {
        d1: { heading: 'Pipeline audit and team orientation', items: ['Review active pursuit portfolio', 'Map incumbent landscape on each opportunity', 'Meet BD, technical, and pricing leads', 'Assess Go/No-Go on entered but uncommitted opportunities', 'Flag pursuits without customer-grounded win themes'] },
        d2: { heading: 'Win strategy tightening', items: ['Own one active capture as team proof-of-concept', 'Establish PTW and competitive intelligence cadence', 'Drive color reviews on proposals in development', 'Identify two GWACs or IDIQs not yet on the pipeline', 'Strengthen teaming: ANC, 8(a), WOSB'] },
        d3: { heading: 'Long-range pipeline shaping', items: ['Build 12-month pursuit calendar with milestone gates', 'Position for major GWAC on-ramp within 18 months', 'Drive pre-RFP engagement on top two single-award pursuits', 'Deliver pipeline health report with actionable recommendations'] },
      },
      recruiter_note: `This role has a significant applicant pool. A traditional hire takes 60-90 days to clear, onboard, and begin contributing, and the fully loaded cost runs well above the posted salary range once you account for benefits, taxes, and recruiting fees.\n\nA fractional engagement means the hiring manager gets an experienced leader contributing within a week. Active pursuits stay covered during the decision timeline. If the fit is right, it converts to full-time. Presenting this option makes you look like a strategic partner to your hiring manager, not just a sourcer.`,
      payment_note: `Elizabeth is flexible on payment structure: hourly, project-based, or retainer, depending on what works best for ${job.company}'s procurement process and internal contracting requirements. The goal is to remove every barrier between a decision and contribution.`,
      savings_low: '$80K',
      savings_high: '$130K+',
      salary_range: salaryRaw,
    }
  }

  return buildBrochureHTML(job, content)
}

export async function generateAndSaveApplication(jobId: string): Promise<string> {
  const db = supabaseAdmin()

  const { data: job } = await db.from('discovered_jobs').select('*').eq('id', jobId).single()
  if (!job) throw new Error('Job not found')

  const { resume, coverLetter } = await Promise.race([
    generateResumeAndCoverLetter(job as DiscoveredJob),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Generation timed out after 90 seconds')), 90000)
    ),
  ])

  const { data: app, error } = await db
    .from('applications')
    .upsert({ job_id: jobId, resume_text: resume, cover_letter: coverLetter, status: 'ready' }, { onConflict: 'job_id' })
    .select('id')
    .single()

  if (error) throw error

  // Remove from queue by marking the job as approved
  await db
    .from('discovered_jobs')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', jobId)

  return app.id
}
