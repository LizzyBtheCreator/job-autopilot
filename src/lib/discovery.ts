import 'server-only'
import { supabaseAdmin } from './supabase'
import type { Category } from './types'

// Job board exclusions on every query — forces results to company career pages
const EXCL = '-site:indeed.com -site:linkedin.com -site:glassdoor.com -site:ziprecruiter.com -site:monster.com -site:careerbuilder.com -site:simplyhired.com -site:salary.com'

// 12 queries total — each covers an entire job family.
// At 12 queries per search, 2,500 Serper credits = 208 searches = months of use.
const QUERIES: { q: string; category: Category }[] = [
  // Proposals & Capture
  {
    q: `("proposal manager" OR "capture manager" OR "proposal director" OR "bid manager" OR "proposal operations") remote ${EXCL}`,
    category: 'proposals',
  },
  // Contracts & Procurement
  {
    q: `("contracts manager" OR "contract administrator" OR "contract specialist" OR "procurement manager" OR "procurement analyst" OR "contracting officer") remote ${EXCL}`,
    category: 'contracts',
  },
  // Compliance & Risk
  {
    q: `("compliance manager" OR "compliance director" OR "compliance program manager" OR "regulatory compliance" OR "federal compliance" OR "program integrity") remote ${EXCL}`,
    category: 'compliance',
  },
  // Grants & Programs
  {
    q: `("grants manager" OR "grants administrator" OR "grant compliance" OR "program administrator" OR "federal grants manager") remote ${EXCL}`,
    category: 'grants',
  },
  // Program & Operations
  {
    q: `("program manager" OR "program director" OR "PMO manager" OR "program operations" OR "portfolio manager" OR "program controls") remote federal government ${EXCL}`,
    category: 'program_ops',
  },
  // Government & Public Sector
  {
    q: `("government consulting" OR "public sector consulting" OR "community development director" OR "economic development director" OR "workforce development" OR "government programs") remote ${EXCL}`,
    category: 'govcon_public',
  },
  // Business Development
  {
    q: `("business development director" OR "director of business development" OR "VP of business development" OR "BD director" OR "strategic partnerships director") remote federal ${EXCL}`,
    category: 'business_dev',
  },
  // Consulting
  {
    q: `("senior consultant" OR "principal consultant" OR "managing consultant" OR "management consulting" OR "implementation consultant") remote federal government ${EXCL}`,
    category: 'consulting',
  },
  // DEI & HR Compliance — senior titles
  {
    q: `("chief diversity officer" OR "VP of DEI" OR "director of DEI" OR "chief people officer" OR "VP of HR compliance" OR "director of employee relations") remote ${EXCL}`,
    category: 'dei_hr',
  },
  // DEI & HR Compliance — manager titles
  {
    q: `("DEI compliance manager" OR "diversity equity inclusion manager" OR "HR compliance manager" OR "employee relations manager" OR "EEO officer" OR "people operations compliance" OR "labor compliance manager") remote ${EXCL}`,
    category: 'dei_hr',
  },
  // GovCon BD / federal defense — proposal + capture specific
  {
    q: `("capture manager" OR "proposal manager" OR "senior capture manager" OR "director of capture") remote federal defense DoD ${EXCL}`,
    category: 'proposals',
  },
  // Sales / BD — commercial
  {
    q: `("sales director" OR "account director" OR "professional services director" OR "client development director") remote ${EXCL}`,
    category: 'business_dev',
  },
]

// Title keywords that must appear for a job to pass — covers all categories
const QUALIFYING_TITLES = [
  'proposal', 'capture', 'bid manager',
  'contract', 'contracts', 'procurement', 'acquisition', 'vendor manager',
  'compliance', 'regulatory', 'program integrity', 'quality assurance',
  'grants', 'grant ', 'technical assistance', 'program administrator',
  'program manager', 'program director', 'program operations', 'pmo',
  'portfolio manager', 'program analyst', 'program controls',
  'strategic operations', 'process improvement', 'operations manager', 'operations director',
  'business development', 'bd director', 'bd manager',
  'strategic partnerships', 'account director', 'sales director', 'client development',
  'senior consultant', 'principal consultant', 'managing consultant',
  'government consulting', 'public sector', 'community development',
  'economic development', 'workforce development', 'government programs',
  'diversity', 'dei', 'inclusion', 'equity', 'chief people officer',
  'people operations', 'employee relations', 'eeo officer', 'hr compliance',
  'labor compliance', 'chief diversity',
]

const DISQUALIFY = [
  'software engineer', 'software developer', 'devops', 'data scientist',
  'machine learning', 'ml engineer', 'frontend', 'backend', 'full stack',
  'fullstack', 'data engineer', 'mobile engineer', 'ios ', 'android ',
  'site reliability', 'security engineer', 'network engineer', 'cloud engineer',
]

function titleMatches(title: string): boolean {
  const t = title.toLowerCase()
  if (DISQUALIFY.some(d => t.includes(d))) return false
  return QUALIFYING_TITLES.some(k => t.includes(k))
}

function scoreJob(title: string, description: string): number {
  const t = title.toLowerCase()
  const text = (title + ' ' + description).toLowerCase()
  let score = 70

  if (/remote|work from home/.test(text)) score += 5
  if (/federal|government|dod|defense|public sector|grants|compliance/.test(text)) score += 8
  if (/senior|director|vp |vice president|head of|chief|principal|lead |managing/.test(t)) score += 8
  if (/shipley|idiq|far|dfars|pmp|cmmc|nist|2 cfr|cdbg/.test(text)) score += 5

  return Math.min(95, score)
}

function mapCategory(title: string): Category {
  const t = title.toLowerCase()
  if (/diversity|dei|inclusion|equity|chief diversity|chief people|people ops|employee relations|eeo|hr compliance|labor compliance/.test(t)) return 'dei_hr'
  if (/proposal|capture|bid/.test(t)) return 'proposals'
  if (/contract|procurement|acquisition|vendor/.test(t)) return 'contracts'
  if (/compliance|regulatory|risk|integrity/.test(t)) return 'compliance'
  if (/grant|technical assistance|program admin/.test(t)) return 'grants'
  if (/program manager|program ops|pmo|portfolio|program analyst|program director|program controls|operations manager|operations director|process improvement/.test(t)) return 'program_ops'
  if (/community development|economic development|workforce|government program|government relation|public sector|federal program/.test(t)) return 'govcon_public'
  if (/business development|bd director|bd manager|partnerships|account director|sales director|client development/.test(t)) return 'business_dev'
  if (/consultant|consulting/.test(t)) return 'consulting'
  return 'govcon'
}

interface SerperResult {
  title: string
  link: string
  snippet?: string
}

async function serperSearch(query: string): Promise<{ title: string; url: string; description: string }[]> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) {
    console.error('SERPER_API_KEY not set')
    return []
  }
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 10 }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`Serper error: ${res.status} — ${body.slice(0, 200)}`)
      return []
    }
    const data = await res.json()
    if (data?.statusCode === 400 || data?.message?.toLowerCase().includes('credit')) {
      console.error('Serper out of credits')
      return []
    }
    return (data?.organic ?? []).map((r: SerperResult) => ({
      title: r.title ?? '',
      url: r.link ?? '',
      description: r.snippet ?? '',
    }))
  } catch (err) {
    console.error('Serper fetch error:', err)
    return []
  }
}

// Clean "Company | Job Title" or "Job Title - Company" to extract just the job title
function cleanTitle(raw: string): string {
  const segments = raw.split(/\s*[\|–—]\s*/)
  const match = segments.find(s => QUALIFYING_TITLES.some(k => s.toLowerCase().includes(k)))
  return (match ?? segments[0]).trim()
}


export async function runDiscovery(): Promise<{ found: number; saved: number; skipped: number }> {
  const db = supabaseAdmin()
  const today = new Date().toISOString().split('T')[0]
  let totalFound = 0, totalSaved = 0, totalSkipped = 0

  for (const { q, category } of QUERIES) {
    const results = await serperSearch(q)
    totalFound += results.length

    for (const result of results) {
      if (!result.url || !result.title) { totalSkipped++; continue }

      // Skip job board index pages (no path segment after /jobs or /careers)
      if (/\/(jobs|careers)\/?$/.test(result.url)) {
        totalSkipped++; continue
      }

      // Skip if already in DB
      const { data: existing } = await db
        .from('discovered_jobs')
        .select('id')
        .eq('url', result.url)
        .maybeSingle()
      if (existing) { totalSkipped++; continue }

      const title = cleanTitle(result.title)
      const score = scoreJob(title, result.description)

      if (!titleMatches(title) && !titleMatches(result.title)) { totalSkipped++; continue }

      const isRemote = /remote|work from home/i.test(result.title + ' ' + result.description)
      const cat = mapCategory(title) !== 'govcon' ? mapCategory(title) : category

      const { error } = await db.from('discovered_jobs').insert({
        title,
        company: 'See listing',
        url: result.url,
        description: result.description,
        role_category: 'govcon_other',
        role_type: cat,
        is_remote: isRemote,
        salary_raw: null,
        fit_score: score,
        fit_notes: cat,
        status: 'new',
      })

      if (error) {
        console.error(`INSERT FAILED: ${error.message} | ${title}`)
        totalSkipped++
      } else {
        totalSaved++
      }
    }

    // Small delay between Serper calls
    await new Promise(r => setTimeout(r, 300))
  }

  if (totalSaved > 0) {
    await db.rpc('increment_discovered', { p_date: today, p_count: totalSaved })
  }

  console.log(`Discovery: found=${totalFound} saved=${totalSaved} skipped=${totalSkipped}`)
  return { found: totalFound, saved: totalSaved, skipped: totalSkipped }
}
