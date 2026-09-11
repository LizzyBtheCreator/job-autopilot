import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 120

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const ELIZABETH_BIO = `
Name: Elizabeth H. McMillan
Location: Fayetteville, NC (Remote)
Phone: (910) 479-4839
Email: elimcmillan@myyahoo.com

CAREER HIGHLIGHTS:
- 16+ years in government contracting compliance (2 CFR Part 200, FAR, EDGAR, SAM.gov)
- Secured $3.5M+ in federal funding; advised on $4.85M+ in housing development activity
- 72% proposal win rate; $50M+ in awarded federal contracts
- $3M+ in recurring revenue closed; 120% quota attainment
- PMP, CBDE, CSM certified
- Founded BidWinAlert — a government contracting SaaS platform (2024-present)
- WOSB, WBE, MBE qualifying entity

WORK HISTORY (most recent first):
1. BidWinAlert - Founder & SaaS Developer (2024-present)
2. Federal Contracting Solutions - Senior BD Consultant (June 2021 - December 2024)
3. Syxsense - Senior BD Specialist (January 2022 - January 2024)
4. GoHighLevel - Business Development Specialist (September 2019 - December 2023)
5. Precise Consulting Services - Principal Consultant (2006-present)
   - CDBG full lifecycle, Davis-Bacon, 24 CFR Part 58, HUD/IDIS, 2 CFR Part 200
   - SAM.gov, FAR, federal compliance advisory
   - Served 100+ veterans, $3.5M+ secured in federal funding
6. Tax & Financial Services Practice - Owner/Operator
7. Social Media Management Company - Owner/Founder
8. Found Crisis Services - Founder & Director

EDUCATION: MS Information Technology - Western Governors University (in progress, 2027)
CERTIFICATIONS: PMP, CBDE, CSM, Google Data Analytics, CompTIA A+ (in progress)
`

async function searchCompany(company: string, role: string): Promise<string> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) return ''

  const queries = [
    `"${company}" employee reviews culture glassdoor indeed`,
    `"${company}" interview questions "${role}"`,
    `"${company}" company overview federal government contracts`,
  ]

  const results: string[] = []

  for (const q of queries) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, num: 5 }),
      })
      const data = await res.json()
      const snippets = (data?.organic ?? []).map((r: { title: string; snippet?: string }) =>
        `${r.title}: ${r.snippet ?? ''}`
      ).join('\n')
      results.push(snippets)
    } catch { /* skip */ }
  }

  return results.join('\n\n')
}

export async function POST(req: NextRequest) {
  const { applicationId, company, role, jobDescription } = await req.json()
  if (!company || !role) return NextResponse.json({ error: 'company and role required' }, { status: 400 })

  const db = supabaseAdmin()

  // Research the company
  const companyResearch = await searchCompany(company, role)

  // Generate all sections in parallel
  const [researchRes, aboutRes, qaRes, questionsRes] = await Promise.all([

    // Company research summary
    client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: `Summarize what a candidate should know about ${company} before an interview for a ${role} position.

RAW RESEARCH:
${companyResearch}

JOB DESCRIPTION:
${jobDescription ?? ''}

Write a concise summary covering:
- What the company does and who they serve
- Company culture and what employees say (if available)
- Recent news or notable projects
- What they likely value in candidates for this role
- Any red flags or green flags mentioned in reviews

Keep it under 300 words. Plain text, no markdown symbols.` }] }),

    // Tell me about yourself
    client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: `Write a "Tell me about yourself" answer for Elizabeth McMillan interviewing for ${role} at ${company}.

ELIZABETH'S BACKGROUND:
${ELIZABETH_BIO}

JOB DESCRIPTION:
${jobDescription ?? ''}

INSTRUCTIONS:
- 60-90 seconds when spoken out loud (about 150-200 words)
- Start with her current role/identity, not with "I was born" or "I've always loved"
- Connect her experience directly to what this role needs
- End with why she's excited about THIS company and THIS role specifically
- Sound like a real person talking, not a rehearsed speech
- Do NOT use em dashes (—). Use commas or hyphens instead.
- Plain text only` }] }),

    // Interview Q&A
    client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: `Generate the 10 most likely interview questions for ${role} at ${company} and write Elizabeth's prepared answers for each.

ELIZABETH'S BACKGROUND:
${ELIZABETH_BIO}

JOB DESCRIPTION:
${jobDescription ?? ''}

COMPANY RESEARCH:
${companyResearch.slice(0, 500)}

For each question:
- Write the question
- Write Elizabeth's specific answer using her real experience and real numbers
- Each answer should be 3-6 sentences, concrete and specific
- Use the STAR format (Situation, Task, Action, Result) where it fits naturally
- Do NOT use em dashes (—)
- Plain text, number each question 1-10

Include: behavioral questions, role-specific technical questions, culture fit questions, and at least one about her non-traditional background.` }] }),

    // Questions to ask
    client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: `Write 5 smart questions Elizabeth McMillan should ask the interviewer for a ${role} position at ${company}.

JOB DESCRIPTION: ${jobDescription ?? ''}
COMPANY RESEARCH: ${companyResearch.slice(0, 300)}

Make them specific to this company and role - not generic. Questions that show she has done her research and is serious about the role. Plain text, numbered 1-5. No em dashes.` }] }),
  ])

  const getText = (res: Anthropic.Message) => res.content.find(b => b.type === 'text')?.text ?? ''
  const clean = (t: string) => t.replace(/—/g, '-').replace(/–/g, '-')

  const research = clean(getText(researchRes))
  const aboutYourself = clean(getText(aboutRes))
  const questionsAnswers = clean(getText(qaRes))
  const questionsToAsk = clean(getText(questionsRes))

  // Build cheat sheet
  const cheatSheet = `INTERVIEW CHEAT SHEET
${role} at ${company}
${'='.repeat(50)}

TELL ME ABOUT YOURSELF
${aboutYourself}

${'='.repeat(50)}
COMPANY SNAPSHOT
${research}

${'='.repeat(50)}
KEY NUMBERS TO REMEMBER
- 16+ years government contracting compliance
- $50M+ in awarded federal contracts, 72% win rate
- $3.5M+ in federal funding secured
- $3M+ in recurring revenue closed, 120% quota
- 2 CFR Part 200, FAR, CDBG, SAM.gov, HUD/IDIS
- Led cross-functional teams of 30+
- PMP, CBDE, CSM certified
- WOSB, WBE, MBE qualifying entity

${'='.repeat(50)}
TOP 10 Q&A
${questionsAnswers}

${'='.repeat(50)}
QUESTIONS TO ASK THEM
${questionsToAsk}
`

  // Save to database — delete existing then insert fresh so it always saves cleanly
  if (applicationId) {
    await db.from('interview_prep').delete().eq('application_id', applicationId)
    await db.from('interview_prep').insert({
      application_id: applicationId,
      company,
      role,
      company_research: research,
      about_yourself: aboutYourself,
      questions_answers: questionsAnswers,
      questions_to_ask: questionsToAsk,
      cheat_sheet: cheatSheet,
    })
  }

  return NextResponse.json({
    success: true,
    research,
    aboutYourself,
    questionsAnswers,
    questionsToAsk,
    cheatSheet,
  })
}
