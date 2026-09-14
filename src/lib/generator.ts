import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase'
import type { RoleCategory, DiscoveredJob } from './types'

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
      .replace(/[•‣◦⁃∙]/g, '-')
      .replace(/[–—―]/g, '-')
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/[^\x00-\x7F]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
    return text.slice(0, 4000)
  } catch {
    return ''
  }
}

// Extract structured requirements from a full job description using Haiku — cheap, fast
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
BS Information Technology - Western Governors University (Jan 2026)
Fayetteville Technical Community College
Fayetteville State University
`

const SKILLS = `
Business Development and Capture: CRM tools (Salesforce, HubSpot, GoHighLevel), consultative selling, pipeline management (200+ accounts), Shipley methodology, capture management, win strategy and price-to-win, federal BD lifecycle ($320M+ contract activity, 72% win rate)

Government Contracting and Compliance: Proposal management, capture management, full RFP/RFI/BAA/OTA/IDIQ lifecycle, SBA 8(a)/GSA/IDIQ/GWAC vehicles, FAR/DFARS compliance, teaming partnerships, tribal procurement (ANCs), 2 CFR Part 200, CDBG full program lifecycle, Davis-Bacon labor standards, HUD/IDIS reporting, single audit preparation, SAM.gov navigation, EDGAR compliance, grant writing and federal proposal development, 100+ client engagements with zero audit findings

Compliance and Regulatory Frameworks: CMMC, NIST SP 800-171, NIST 800-53, FedRAMP, FISMA, DFARS flow-down, System Security Plan (SSP) and POA&M documentation, evidence pack development, SPRS scoring, cross-functional compliance program management (IT, Legal, Engineering, Finance, BD alignment)

Contracts: Contract administration across CPFF, T&M, FFP, and fixed-price contract types, teaming agreement negotiation, subcontractor flow-down management, contract compliance review

IT and Technical: Cloud platform administration, CRM administration, technical client support, Next.js, Supabase, Anthropic API

Tools: Microsoft Office 365, Salesforce, HubSpot, GoHighLevel, Supabase, Next.js
`

const categoryContext: Record<RoleCategory, string> = {
  proposal_writer: 'This is a PROPOSAL WRITER / SPECIALIST / COORDINATOR role. Lead with hands-on proposal writing and compliance matrix experience, Shipley methodology, and the 72% win rate. Emphasize writing and coordinating specific proposal sections, compliance with RFP instructions, and color-team review participation.',
  capture_manager: 'This is a CAPTURE MANAGER / DIRECTOR role. Lead with $320M+ in contract activity, 72% win rate, Shipley capture methodology, win strategy development, competitive intelligence, and teaming partnership negotiation across DoD and civilian agencies.',
  compliance_manager: 'This is a COMPLIANCE MANAGER / GRC role. Lead with DefenseComply Pro and DefenseComply advisory practice (CMMC/NIST 800-171/FedRAMP), zero audit findings across 100+ engagements, SSP/POA&M documentation, SPRS scoring, and cross-functional stakeholder alignment. Never lead with BD or sales metrics in this category.',
  contracts_administrator: 'This is a CONTRACTS ADMINISTRATOR / MANAGER role. Lead with contract administration across CPFF/T&M/FFP/fixed-price types, FAR/DFARS compliance, teaming agreement negotiation, subcontractor flow-down management, and 2 CFR Part 200 experience from grant/contract administration.',
  business_development: 'This is a BUSINESS DEVELOPMENT role. Lead with $320M+ in contract activity, $3M+ in recurring revenue closed, 120% quota attainment, CRM expertise (Salesforce, HubSpot, GoHighLevel), and federal BD lifecycle across 10+ agencies.',
  govcon_other: 'This is a GOVCON role (proposal manager, bid manager, or similar). Lead with $320M+ in government contract activity, 72% proposal win rate, Shipley methodology, and federal contract vehicle experience (SBA 8(a), GSA, IDIQ, GWAC, OTA, BAA).',
  general_remote: 'This is a HIGH-PAYING REMOTE role outside the core GovCon lane. Lead with the most transferable achievements: $320M+ in managed contract/program activity, cross-functional leadership of 100+ people, PMP certification, and SaaS founder experience (BidWinAlert, DefenseComply Pro). Frame federal experience as evidence of operating in high-compliance, high-stakes environments, useful in any regulated industry.',
}

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

function isSalaryOver100k(job: DiscoveredJob): boolean {
  if (job.salary_min != null && job.salary_min >= 100000) return true
  if (job.salary_max != null && job.salary_max >= 100000) return true
  return false
}

export async function generateResume(job: DiscoveredJob): Promise<string> {
  const category = job.role_category
  const context = categoryContext[category]
  const includeTrialSection = isSalaryOver100k(job)

  const fullContent = job.url ? await fetchJobContent(job.url) : ''
  const richDescription = toAscii(fullContent.length > 200 ? fullContent : (job.description ?? ''))
  const jobTitle = toAscii(job.title)
  const jobCompany = toAscii(job.company)

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

  const res = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2500,
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
- Mirror the employer's EXACT language and keywords from the extracted requirements
- The Professional Summary (4 sentences max) must open with the most compelling match to this specific role and name the employer's top 2-3 priorities directly
- Each bullet in the PRIMARY role must address at least one requirement from the extracted key requirements
- If the job names a specific agency, branch, or domain (e.g., Air Force, Space Force), name it prominently in the summary AND in the relevant bullets
- If the job names a methodology (e.g., Shipley), name it in the summary AND experience
- If the job names a tool (e.g., Salesforce), name it in experience
- Omit roles that add no value for this specific position, but never reorder the roles you keep. Order is locked as listed above. For compliance category resumes, DefenseComply Pro and DefenseComply are the anchor roles and must always be included.
- No references section. No salary. No personal notes.
- Do NOT include an Education section in the body — it is provided separately.
- Target length: 1 to 1.5 pages — strong and complete, not padded, not cut short
${trialSectionInstructions}

FORMAT OUTPUT EXACTLY — the app's PDF renderer requires these markers:

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
  return clean(res.content.find(b => b.type === 'text')?.text ?? '')
}

export async function generateAndSaveApplication(jobId: string): Promise<string> {
  const db = supabaseAdmin()

  const { data: job } = await db.from('discovered_jobs').select('*').eq('id', jobId).single()
  if (!job) throw new Error('Job not found')

  const resume = await Promise.race([
    generateResume(job as DiscoveredJob),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Generation timed out after 90 seconds')), 90000)
    ),
  ])

  const { data: app, error } = await db
    .from('applications')
    .upsert({ job_id: jobId, resume_text: resume, status: 'New' }, { onConflict: 'job_id' })
    .select('id')
    .single()

  if (error) throw error

  await db
    .from('discovered_jobs')
    .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
    .eq('id', jobId)

  return app.id
}
