import 'server-only'
import { supabaseAdmin } from './supabase'
import type { Category } from './types'

// Excluded job board domains — forces Google to return company career pages only
const BOARD_EXCLUSIONS = [
  '-site:indeed.com',
  '-site:linkedin.com',
  '-site:glassdoor.com',
  '-site:ziprecruiter.com',
  '-site:monster.com',
  '-site:careerbuilder.com',
  '-site:salary.com',
  '-site:payscale.com',
  '-site:simplyhired.com',
  '-site:jooble.org',
  '-site:snagajob.com',
  '-site:dice.com',
].join(' ')

// 81 targeted queries across 8 job families.
// Each query hits the open web with job board exclusions so Google returns
// results from actual company career pages (Workday, Greenhouse, iCIMS,
// company-subdomain careers pages) rather than aggregator listings.
const QUERIES: { query: string; category: Category }[] = [
  // ── Proposals & Capture ───────────────────────────────────────────
  { query: `"proposal manager" remote federal ${BOARD_EXCLUSIONS}`, category: 'proposals' },
  { query: `"senior proposal manager" remote ${BOARD_EXCLUSIONS}`, category: 'proposals' },
  { query: `"proposal director" remote federal defense ${BOARD_EXCLUSIONS}`, category: 'proposals' },
  { query: `"capture manager" remote federal ${BOARD_EXCLUSIONS}`, category: 'proposals' },
  { query: `"senior capture manager" remote ${BOARD_EXCLUSIONS}`, category: 'proposals' },
  { query: `"director of capture" remote federal ${BOARD_EXCLUSIONS}`, category: 'proposals' },
  { query: `"proposal operations manager" remote ${BOARD_EXCLUSIONS}`, category: 'proposals' },
  { query: `"proposal development manager" remote federal ${BOARD_EXCLUSIONS}`, category: 'proposals' },
  { query: `"bid manager" remote federal defense ${BOARD_EXCLUSIONS}`, category: 'proposals' },
  { query: `"federal proposal manager" remote ${BOARD_EXCLUSIONS}`, category: 'proposals' },
  { query: `"government proposal manager" remote ${BOARD_EXCLUSIONS}`, category: 'proposals' },

  // ── Contracts & Procurement ───────────────────────────────────────
  { query: `"contracts manager" remote federal government ${BOARD_EXCLUSIONS}`, category: 'contracts' },
  { query: `"contract administrator" remote federal ${BOARD_EXCLUSIONS}`, category: 'contracts' },
  { query: `"contract specialist" remote federal government ${BOARD_EXCLUSIONS}`, category: 'contracts' },
  { query: `"procurement manager" remote federal ${BOARD_EXCLUSIONS}`, category: 'contracts' },
  { query: `"procurement analyst" remote federal government ${BOARD_EXCLUSIONS}`, category: 'contracts' },
  { query: `"contracting officer" remote federal ${BOARD_EXCLUSIONS}`, category: 'contracts' },
  { query: `"vendor manager" remote federal government ${BOARD_EXCLUSIONS}`, category: 'contracts' },
  { query: `"procurement specialist" remote federal ${BOARD_EXCLUSIONS}`, category: 'contracts' },
  { query: `"acquisition manager" remote federal ${BOARD_EXCLUSIONS}`, category: 'contracts' },
  { query: `"government contracts" manager remote ${BOARD_EXCLUSIONS}`, category: 'contracts' },

  // ── Compliance & Risk ─────────────────────────────────────────────
  { query: `"compliance manager" remote federal government ${BOARD_EXCLUSIONS}`, category: 'compliance' },
  { query: `"regulatory compliance" manager remote ${BOARD_EXCLUSIONS}`, category: 'compliance' },
  { query: `"government compliance" manager remote ${BOARD_EXCLUSIONS}`, category: 'compliance' },
  { query: `"compliance director" remote federal ${BOARD_EXCLUSIONS}`, category: 'compliance' },
  { query: `"risk and compliance" manager remote government ${BOARD_EXCLUSIONS}`, category: 'compliance' },
  { query: `"compliance program manager" remote federal ${BOARD_EXCLUSIONS}`, category: 'compliance' },
  { query: `"quality assurance" manager remote federal government ${BOARD_EXCLUSIONS}`, category: 'compliance' },
  { query: `"program integrity" manager remote federal ${BOARD_EXCLUSIONS}`, category: 'compliance' },
  { query: `"regulatory affairs" manager remote government ${BOARD_EXCLUSIONS}`, category: 'compliance' },
  { query: `"federal compliance" manager remote ${BOARD_EXCLUSIONS}`, category: 'compliance' },

  // ── Grants & Programs ─────────────────────────────────────────────
  { query: `"grants manager" remote federal ${BOARD_EXCLUSIONS}`, category: 'grants' },
  { query: `"grants administrator" remote federal ${BOARD_EXCLUSIONS}`, category: 'grants' },
  { query: `"grants management" director remote ${BOARD_EXCLUSIONS}`, category: 'grants' },
  { query: `"grant compliance" manager remote ${BOARD_EXCLUSIONS}`, category: 'grants' },
  { query: `"program administrator" remote federal government ${BOARD_EXCLUSIONS}`, category: 'grants' },
  { query: `"technical assistance" manager remote federal ${BOARD_EXCLUSIONS}`, category: 'grants' },
  { query: `"federal grants" manager remote ${BOARD_EXCLUSIONS}`, category: 'grants' },
  { query: `"2 CFR" grants manager remote ${BOARD_EXCLUSIONS}`, category: 'grants' },
  { query: `"HUD" grants program manager remote ${BOARD_EXCLUSIONS}`, category: 'grants' },
  { query: `"CDBG" program manager remote ${BOARD_EXCLUSIONS}`, category: 'grants' },

  // ── Program & Operations ──────────────────────────────────────────
  { query: `"program manager" remote federal government defense ${BOARD_EXCLUSIONS}`, category: 'program_ops' },
  { query: `"program operations manager" remote federal ${BOARD_EXCLUSIONS}`, category: 'program_ops' },
  { query: `"PMO manager" remote federal government ${BOARD_EXCLUSIONS}`, category: 'program_ops' },
  { query: `"program management office" director remote ${BOARD_EXCLUSIONS}`, category: 'program_ops' },
  { query: `"program controls" manager remote federal ${BOARD_EXCLUSIONS}`, category: 'program_ops' },
  { query: `"portfolio manager" remote federal government ${BOARD_EXCLUSIONS}`, category: 'program_ops' },
  { query: `"senior program analyst" remote federal ${BOARD_EXCLUSIONS}`, category: 'program_ops' },
  { query: `"strategic operations" director remote ${BOARD_EXCLUSIONS}`, category: 'program_ops' },
  { query: `"process improvement" manager remote federal ${BOARD_EXCLUSIONS}`, category: 'program_ops' },
  { query: `"program governance" manager remote federal ${BOARD_EXCLUSIONS}`, category: 'program_ops' },

  // ── Government & Public Sector ────────────────────────────────────
  { query: `"government consulting" director remote ${BOARD_EXCLUSIONS}`, category: 'govcon_public' },
  { query: `"public sector consulting" director remote ${BOARD_EXCLUSIONS}`, category: 'govcon_public' },
  { query: `"government programs" manager remote ${BOARD_EXCLUSIONS}`, category: 'govcon_public' },
  { query: `"community development" director remote federal ${BOARD_EXCLUSIONS}`, category: 'govcon_public' },
  { query: `"economic development" director remote ${BOARD_EXCLUSIONS}`, category: 'govcon_public' },
  { query: `"workforce development" manager remote federal ${BOARD_EXCLUSIONS}`, category: 'govcon_public' },
  { query: `"organizational development" director remote federal ${BOARD_EXCLUSIONS}`, category: 'govcon_public' },
  { query: `"public sector" program manager remote ${BOARD_EXCLUSIONS}`, category: 'govcon_public' },
  { query: `"government relations" director remote ${BOARD_EXCLUSIONS}`, category: 'govcon_public' },
  { query: `"federal programs" manager remote ${BOARD_EXCLUSIONS}`, category: 'govcon_public' },

  // ── Business Development ──────────────────────────────────────────
  { query: `"business development director" remote federal government ${BOARD_EXCLUSIONS}`, category: 'business_dev' },
  { query: `"business development manager" remote federal defense ${BOARD_EXCLUSIONS}`, category: 'business_dev' },
  { query: `"vice president business development" remote federal ${BOARD_EXCLUSIONS}`, category: 'business_dev' },
  { query: `"director of business development" remote federal ${BOARD_EXCLUSIONS}`, category: 'business_dev' },
  { query: `"strategic partnerships" director remote federal ${BOARD_EXCLUSIONS}`, category: 'business_dev' },
  { query: `"account director" remote federal government ${BOARD_EXCLUSIONS}`, category: 'business_dev' },
  { query: `"sales director" remote federal government ${BOARD_EXCLUSIONS}`, category: 'business_dev' },
  { query: `"professional services" director remote federal ${BOARD_EXCLUSIONS}`, category: 'business_dev' },
  { query: `"BD director" remote federal defense ${BOARD_EXCLUSIONS}`, category: 'business_dev' },
  { query: `"client development" director remote federal ${BOARD_EXCLUSIONS}`, category: 'business_dev' },

  // ── Consulting ────────────────────────────────────────────────────
  { query: `"management consulting" director remote federal government ${BOARD_EXCLUSIONS}`, category: 'consulting' },
  { query: `"implementation consulting" manager remote federal ${BOARD_EXCLUSIONS}`, category: 'consulting' },
  { query: `"government consulting" manager remote ${BOARD_EXCLUSIONS}`, category: 'consulting' },
  { query: `"program consulting" director remote federal ${BOARD_EXCLUSIONS}`, category: 'consulting' },
  { query: `"senior consultant" remote federal government ${BOARD_EXCLUSIONS}`, category: 'consulting' },
  { query: `"principal consultant" remote federal government ${BOARD_EXCLUSIONS}`, category: 'consulting' },
  { query: `"operations consulting" director remote federal ${BOARD_EXCLUSIONS}`, category: 'consulting' },
  { query: `"public sector" consultant director remote ${BOARD_EXCLUSIONS}`, category: 'consulting' },
  { query: `"technical assistance" consultant remote federal ${BOARD_EXCLUSIONS}`, category: 'consulting' },
  { query: `"managing consultant" remote federal government ${BOARD_EXCLUSIONS}`, category: 'consulting' },
]

interface SearchResult {
  title: string
  url: string
  description: string
}

async function googleCseSearch(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY
  const cseId = process.env.GOOGLE_CSE_ID
  if (!apiKey || !cseId) {
    console.error('Google CSE: GOOGLE_CSE_API_KEY or GOOGLE_CSE_ID not set')
    return []
  }
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}&num=10`
    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`Google CSE error: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`)
      return []
    }
    const data = await res.json()
    return (data?.items ?? []).map((r: { title: string; link: string; snippet?: string }) => ({
      title: r.title ?? '',
      url: r.link ?? '',
      description: r.snippet ?? '',
    }))
  } catch (err) {
    console.error('Google CSE fetch error:', err)
    return []
  }
}

// All job titles we accept — covers every role family from the expanded list
const QUALIFYING_TITLES = [
  // Proposals & Capture
  'proposal manager', 'proposal director', 'proposal writer', 'proposal coordinator',
  'proposal specialist', 'proposal analyst', 'proposal development', 'proposal operations',
  'capture manager', 'capture director', 'capture specialist', 'director of capture',
  'director of proposals', 'vp of proposals', 'vp of capture', 'head of capture',
  'bid manager', 'bid coordinator', 'bid writer', 'bid specialist',
  'federal proposal', 'government proposal', 'public sector proposal',
  // Contracts & Procurement
  'contracting officer', 'contract officer', 'contract specialist', 'contracts administrator',
  'contracts manager', 'contract administrator', 'contract manager', 'contract management',
  'procurement officer', 'contracting specialist', 'procurement manager', 'procurement analyst',
  'procurement specialist', 'acquisition manager', 'acquisition analyst', 'acquisition specialist',
  'vendor manager', 'vendor management', 'government contracts',
  // Compliance & Risk
  'compliance manager', 'compliance director', 'compliance program manager', 'compliance operations',
  'regulatory compliance', 'government compliance', 'federal compliance', 'program compliance',
  'risk and compliance', 'compliance and risk', 'quality assurance', 'program integrity',
  'regulatory affairs', 'policy and compliance',
  // Grants
  'grants manager', 'grants administrator', 'grants coordinator', 'grants management',
  'grant administrator', 'grant manager', 'grant compliance', 'federal grants',
  'program administrator', 'technical assistance',
  // Program & Operations
  'program manager', 'program operations', 'pmo manager', 'program management office',
  'program controls', 'portfolio manager', 'program analyst', 'senior program analyst',
  'strategic operations', 'process improvement', 'program governance', 'business operations',
  'operations manager', 'operations director',
  // Government & Public Sector
  'government consulting', 'public sector consulting', 'government programs',
  'community development', 'economic development', 'workforce development',
  'organizational development', 'government relations', 'federal programs',
  // Business Development
  'business development manager', 'business development director', 'bd manager', 'bd director',
  'director of business development', 'vp of business development', 'vice president business development',
  'strategic partnerships', 'account director', 'sales director', 'professional services director',
  'client development',
  // Consulting
  'management consulting', 'implementation consulting', 'program consulting',
  'operations consulting', 'senior consultant', 'principal consultant', 'managing consultant',
  // Pricing (keep from before)
  'pricing analyst', 'price analyst', 'cost analyst', 'pricing manager',
]

function scoreJob(title: string, description: string): { score: number; notes: string } {
  const titleLower = title.toLowerCase()
  const text = (title + ' ' + description).toLowerCase()
  const matched: string[] = []

  // Hard filter: title must contain a qualifying keyword
  const titleMatch = QUALIFYING_TITLES.find(role => titleLower.includes(role))
  if (!titleMatch) return { score: 0, notes: 'title does not match any qualifying role' }

  // Hard disqualifier: software engineering roles that happen to use qualifying words
  if (/software engineer|software developer|devops|data scientist|machine learning|ml engineer|frontend|backend|full.?stack/.test(titleLower)) {
    return { score: 0, notes: 'tech role disqualified' }
  }

  let score = 70
  matched.push(titleMatch)

  // Remote confirmed
  if (/remote|work from home/.test(text)) { score += 5; matched.push('remote') }
  // Federal/defense/government domain
  if (/federal|dod|defense|government contract|military|civilian agency|public sector|intelligence|hud|hhs|gsa/.test(text)) {
    score += 10; matched.push('federal/gov')
  }
  // Senior/director level
  if (/senior|director|vp |vice president|head of|chief|principal|lead |managing/.test(titleLower)) {
    score += 8; matched.push('senior level')
  }
  // Domain skill signals
  if (/shipley|idiq|gwac|ota|far|dfars|sam\.gov|2 cfr|cdbg|grants\.gov|pmp|cmmc|nist/.test(text)) {
    score += 5; matched.push('domain skills')
  }

  return { score: Math.min(95, score), notes: matched.join(', ') }
}

const CLOSED_PATTERN = /no longer accepting|job not found|position has been filled|posting.*closed|no longer available|this job.*closed|job.*no longer|position.*filled|requisition.*closed|opening.*filled/i

async function isPostingLive(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' },
    })
    if (res.status === 404 || res.status === 410) return false
    if (/[?&]error=true/i.test(res.url)) return false
    if (!res.ok) return true
    const text = await res.text()
    return !CLOSED_PATTERN.test(text)
  } catch {
    return true
  }
}

// Strip title to the job title segment — search results often return "Title | Company" or "Company - Title"
function cleanTitle(raw: string): string {
  const segments = raw.split(/\s*[\|–—]\s*/)
  // Pick the segment that contains a qualifying keyword
  const match = segments.find(s => QUALIFYING_TITLES.some(k => s.toLowerCase().includes(k)))
  return (match ?? segments[0]).trim()
}

async function processQuery(
  query: string,
  category: Category,
  db: ReturnType<typeof supabaseAdmin>
): Promise<{ found: number; saved: number; skipped: number }> {
  let found = 0, saved = 0, skipped = 0
  try {
    const results = await googleCseSearch(query)
    found = results.length

    for (const result of results) {
      if (!result.url || !result.title) { skipped++; continue }

      // Skip job board index/search pages — only individual postings
      const isIndexPage = (
        /\/(jobs|careers|search|listings)\??[^/]*$/.test(result.url) &&
        !/\/job\/|\/jobs\/\d|\/position\/|\/opening\/|\/req\//.test(result.url)
      )
      if (isIndexPage) { skipped++; continue }

      // Skip if URL already in DB (any status except rejected)
      const { data: existing } = await db
        .from('discovered_jobs')
        .select('id, status')
        .eq('url', result.url)
        .maybeSingle()
      if (existing && existing.status !== 'rejected') { skipped++; continue }

      const title = cleanTitle(result.title)
      const { score, notes } = scoreJob(title, result.description)

      if (score < 60) {
        // Try full raw title as fallback
        const fallback = scoreJob(result.title, result.description)
        if (fallback.score < 60) { skipped++; continue }
      }

      // Verify posting is still live before saving
      if (!(await isPostingLive(result.url))) { skipped++; continue }

      const isRemote = /remote|work from home/i.test(result.title + ' ' + result.description)

      const { error: insertErr } = await db.from('discovered_jobs').insert({
        title,
        company: 'See listing',
        url: result.url,
        description: result.description,
        role_category: 'govcon_other',
        role_type: category,
        is_remote: isRemote,
        salary_raw: null,
        fit_score: score,
        fit_notes: notes,
        status: 'new',
      })
      if (insertErr) {
        console.error(`INSERT FAILED: ${insertErr.message} | title="${title}" url="${result.url}"`)
        skipped++
      } else {
        saved++
      }
    }
  } catch (err) {
    console.error(`Discovery error for query "${query.slice(0, 60)}":`, err)
  }
  if (found > 0) {
    console.log(`QUERY "${query.slice(0, 60)}" -> found=${found} saved=${saved} skipped=${skipped}`)
  }
  return { found, saved, skipped }
}

export async function runDiscovery(): Promise<{ found: number; saved: number; skipped: number }> {
  const db = supabaseAdmin()
  const today = new Date().toISOString().split('T')[0]

  let totalFound = 0, totalSaved = 0, totalSkipped = 0

  // Run in batches of 5 to avoid rate limiting the Google CSE API
  const BATCH = 5
  for (let i = 0; i < QUERIES.length; i += BATCH) {
    const batch = QUERIES.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(({ query, category }) => processQuery(query, category, db))
    )
    for (const r of results) {
      totalFound += r.found
      totalSaved += r.saved
      totalSkipped += r.skipped
    }
    if (i + BATCH < QUERIES.length) {
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }

  if (totalSaved > 0) {
    await db.rpc('increment_discovered', { p_date: today, p_count: totalSaved })
  }

  return { found: totalFound, saved: totalSaved, skipped: totalSkipped }
}
