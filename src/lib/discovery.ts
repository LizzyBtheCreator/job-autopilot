import 'server-only'
import { supabaseAdmin } from './supabase'
import type { Category } from './types'

const EXCL = '-site:indeed.com -site:linkedin.com -site:glassdoor.com -site:ziprecruiter.com -site:monster.com -site:careerbuilder.com -site:simplyhired.com -site:salary.com -site:jobs.lever.co'

const QUERIES: { q: string; category: Category }[] = [
  {
    q: `"proposal manager" OR "capture manager" OR "proposal director" OR "bid manager" remote job ${EXCL}`,
    category: 'proposals',
  },
  {
    q: `"senior capture manager" OR "director of capture" OR "VP of proposals" remote federal job ${EXCL}`,
    category: 'proposals',
  },
  {
    q: `"contracts manager" OR "contract administrator" OR "contract specialist" OR "procurement manager" remote job ${EXCL}`,
    category: 'contracts',
  },
  {
    q: `"compliance manager" OR "compliance director" OR "compliance program manager" OR "federal compliance" remote job ${EXCL}`,
    category: 'compliance',
  },
  {
    q: `"grants manager" OR "grants administrator" OR "grant compliance" OR "federal grants manager" remote job ${EXCL}`,
    category: 'grants',
  },
  {
    q: `"program manager" OR "program director" OR "PMO director" remote federal government job ${EXCL}`,
    category: 'program_ops',
  },
  {
    q: `"business development director" OR "director of business development" OR "VP of business development" remote federal job ${EXCL}`,
    category: 'business_dev',
  },
  {
    q: `"senior consultant" OR "principal consultant" OR "managing consultant" remote federal government job ${EXCL}`,
    category: 'consulting',
  },
  {
    q: `"community development director" OR "economic development director" OR "workforce development director" remote job ${EXCL}`,
    category: 'govcon_public',
  },
  {
    q: `"chief diversity officer" OR "VP of DEI" OR "director of DEI" OR "director of diversity" OR "chief people officer" remote job ${EXCL}`,
    category: 'dei_hr',
  },
  {
    q: `"DEI manager" OR "diversity equity inclusion manager" OR "HR compliance manager" OR "employee relations manager" OR "EEO officer" remote job ${EXCL}`,
    category: 'dei_hr',
  },
  {
    q: `"people operations" OR "VP HR compliance" OR "director employee relations" OR "labor compliance manager" OR "workplace compliance" remote job ${EXCL}`,
    category: 'dei_hr',
  },
]

// Only disqualify obvious tech-only roles
const DISQUALIFY_TITLES = [
  'software engineer', 'software developer', 'devops engineer', 'data scientist',
  'machine learning engineer', 'frontend engineer', 'backend engineer', 'full stack engineer',
  'fullstack engineer', 'data engineer', 'mobile engineer', 'ios engineer', 'android engineer',
  'site reliability engineer', 'security engineer', 'network engineer', 'cloud engineer',
  'infrastructure engineer', 'platform engineer',
]

function isDisqualified(title: string, snippet: string): boolean {
  const t = (title + ' ' + snippet).toLowerCase()
  return DISQUALIFY_TITLES.some(d => t.includes(d))
}

function scoreJob(title: string, snippet: string, category: Category): number {
  const text = (title + ' ' + snippet).toLowerCase()
  let score = 72

  if (/remote|work from home/.test(text)) score += 5
  if (/federal|government|dod|defense|public sector|grants|compliance/.test(text)) score += 6
  if (/senior|director|vp |vice president|head of|chief|principal|lead |managing|manager/.test(title.toLowerCase())) score += 8
  if (/shipley|idiq|far|dfars|pmp|cmmc|nist|2 cfr|cdbg|dei|diversity|inclusion/.test(text)) score += 4

  // Boost categories we care most about
  if (['proposals', 'compliance', 'dei_hr', 'grants'].includes(category)) score += 3

  return Math.min(97, score)
}

function detectCategory(title: string, snippet: string, fallback: Category): Category {
  const t = (title + ' ' + snippet).toLowerCase()
  if (/diversity|dei|inclusion|equity|chief diversity|chief people|people ops|employee relations|eeo|hr compliance|labor compliance|workplace compliance/.test(t)) return 'dei_hr'
  if (/proposal|capture|bid manager/.test(t)) return 'proposals'
  if (/contract |contracts |procurement|acquisition/.test(t)) return 'contracts'
  if (/compliance|regulatory|risk |integrity/.test(t)) return 'compliance'
  if (/grant|grants /.test(t)) return 'grants'
  if (/program manager|program director|pmo|portfolio manager|program ops/.test(t)) return 'program_ops'
  if (/community development|economic development|workforce development/.test(t)) return 'govcon_public'
  if (/business development|bd director|bd manager|partnerships/.test(t)) return 'business_dev'
  if (/consultant|consulting/.test(t)) return 'consulting'
  return fallback
}

// Extract company name from Google result title ("Job Title | Company" or "Job Title - Company | Careers")
function extractCompany(raw: string, url: string): string {
  const segments = raw.split(/\s*[\|]\s*/)
  if (segments.length >= 2) {
    const last = segments[segments.length - 1].trim()
    if (last.length > 1 && last.length < 60 && !/careers|jobs|apply|hiring/i.test(last)) return last
  }
  // Fall back to domain
  try {
    const host = new URL(url).hostname.replace('www.', '')
    const parts = host.split('.')
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  } catch {
    return 'See listing'
  }
}

function cleanJobTitle(raw: string): string {
  // Split on pipe, em dash, en dash, or " - " to isolate the job title part
  const segments = raw.split(/\s*[\|–—]\s*|\s+-\s+/)
  // Return the first segment that looks like a job title (shorter, doesn't look like a company/site name)
  for (const seg of segments) {
    const s = seg.trim()
    if (s.length >= 5 && s.length <= 100 && !/careers|jobs|hiring|apply now|job board/i.test(s)) {
      return s
    }
  }
  return segments[0].trim()
}

interface SerperResult {
  title: string
  link: string
  snippet?: string
}

async function serperSearch(query: string): Promise<SerperResult[]> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) { console.error('SERPER_API_KEY not set'); return [] }
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 10 }),
    })
    if (!res.ok) {
      console.error(`Serper ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
      return []
    }
    const data = await res.json()
    return (data?.organic ?? []) as SerperResult[]
  } catch (err) {
    console.error('Serper error:', err)
    return []
  }
}

export async function runDiscovery(): Promise<{ found: number; saved: number; skipped: number }> {
  const db = supabaseAdmin()
  let found = 0, saved = 0, skipped = 0

  for (const { q, category } of QUERIES) {
    const results = await serperSearch(q)
    found += results.length

    for (const r of results) {
      if (!r.link || !r.title) { skipped++; continue }

      // Skip index/listing pages (no slug after /jobs or /careers)
      if (/\/(jobs|careers)\/?$/.test(r.link)) { skipped++; continue }

      // Skip if disqualified tech role
      if (isDisqualified(r.title, r.snippet ?? '')) { skipped++; continue }

      // Skip if already saved
      const { data: existing } = await db
        .from('discovered_jobs')
        .select('id')
        .eq('url', r.link)
        .maybeSingle()
      if (existing) { skipped++; continue }

      const title = cleanJobTitle(r.title)
      const company = extractCompany(r.title, r.link)
      const snippet = r.snippet ?? ''
      const cat = detectCategory(title, snippet, category)
      const score = scoreJob(title, snippet, cat)
      const isRemote = /remote|work from home/i.test(r.title + ' ' + snippet)

      const { error } = await db.from('discovered_jobs').insert({
        title,
        company,
        url: r.link,
        description: snippet,
        role_category: 'govcon_other',
        role_type: cat,
        is_remote: isRemote,
        salary_raw: null,
        fit_score: score,
        fit_notes: cat,
        status: 'new',
      })

      if (error) {
        console.error(`INSERT ERROR: ${error.message} | ${title}`)
        skipped++
      } else {
        saved++
      }
    }

    await new Promise(r => setTimeout(r, 250))
  }

  console.log(`Discovery done: found=${found} saved=${saved} skipped=${skipped}`)
  return { found, saved, skipped }
}
