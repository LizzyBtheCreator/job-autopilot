import 'server-only'
import { supabaseAdmin } from './supabase'
import type { RoleCategory } from './types'
import { PLATFORMS, ALL_PLATFORMS, type PlatformKey } from './platforms'

export { PLATFORMS, ALL_PLATFORMS, type PlatformKey }

// Title keywords used both to build search queries and to score/validate
// results — a result only counts for a category if its title actually
// contains one of these phrases (guards against Serper drift/noise).
const ROLE_TITLE_KEYWORDS: Record<RoleCategory, string[]> = {
  proposal_writer: ['proposal writer', 'proposal specialist', 'proposal coordinator', 'proposal analyst'],
  capture_manager: ['capture manager', 'capture director', 'director of capture', 'head of capture', 'capture lead'],
  compliance_manager: ['compliance manager', 'compliance director', 'director of compliance', 'compliance program manager', 'grc manager'],
  contracts_administrator: ['contracts administrator', 'contracts manager', 'contract specialist', 'contracts specialist', 'contract administrator'],
  business_development: ['business development manager', 'business development director', 'director of business development', 'vp of business development', 'business development executive', 'bd manager'],
  govcon_other: ['proposal manager', 'proposal director', 'bid manager', 'bid coordinator', 'vp of proposals'],
  general_remote: ['program manager', 'director of operations', 'government relations', 'federal sales', 'account director'],
  pricing_analyst: ['pricing analyst', 'proposal pricing analyst', 'price analyst', 'cost analyst', 'cost price analyst', 'pricing manager', 'proposal pricing manager', 'cost volume lead'],
  contracting_officer: ['contracting officer', 'contract officer', 'contracting officer representative', 'cor ', 'administrative contracting officer', 'aco ', 'pco ', 'procurement officer'],
  grants_manager: ['grants manager', 'grants administrator', 'grants management specialist', 'grant administrator', 'grants coordinator', 'federal grants manager'],
  procurement_analyst: ['procurement analyst', 'procurement manager', 'procurement specialist', 'acquisition analyst', 'acquisition specialist', 'acquisition manager', 'federal procurement'],
}

// Search queries — built as "<keyword> remote <domain modifier>" per category.
// Each is later combined with an ATS site: operator in runDiscovery().
const BASE_QUERIES: Record<RoleCategory, string[]> = {
  proposal_writer: [
    'proposal writer remote federal', 'proposal writer remote defense',
    'senior proposal writer remote federal', 'proposal specialist remote federal',
    'proposal coordinator remote federal', 'proposal analyst remote federal',
  ],
  capture_manager: [
    'capture manager remote federal', 'senior capture manager remote federal',
    'capture manager remote defense', 'capture manager remote DoD',
    'director of capture remote federal', 'head of capture remote defense',
  ],
  compliance_manager: [
    'compliance manager remote federal', 'compliance manager remote defense',
    'compliance manager CMMC remote', 'compliance manager NIST 800-171 remote',
    'director of compliance remote federal', 'compliance program manager remote government',
  ],
  contracts_administrator: [
    'contracts administrator remote federal', 'contracts administrator remote government',
    'contract specialist remote federal', 'contracts manager remote federal',
    'senior contracts administrator remote government',
  ],
  business_development: [
    'business development manager remote federal', 'business development director remote defense',
    'director of business development remote government', 'VP of business development remote federal',
    'business development manager remote aerospace',
  ],
  govcon_other: [
    'proposal manager remote federal', 'proposal manager remote defense',
    'senior proposal manager remote federal', 'proposal director remote federal',
    'bid manager remote federal', 'bid manager remote defense',
  ],
  general_remote: [
    'program manager remote federal $100k', 'director of operations remote government',
    'government relations manager remote', 'federal sales director remote',
  ],
  pricing_analyst: [
    'pricing analyst remote federal', 'proposal pricing analyst remote defense',
    'cost analyst remote federal', 'price analyst remote government',
    'pricing analyst remote DoD', 'cost volume lead remote federal',
    'proposal pricing manager remote federal',
  ],
  contracting_officer: [
    'contracting officer remote federal', 'contracting officer representative remote',
    'contract officer remote government', 'administrative contracting officer remote',
    'contracting officer remote DoD', 'COR remote federal',
  ],
  grants_manager: [
    'grants manager remote federal', 'grants administrator remote government',
    'grants management specialist remote', 'federal grants manager remote',
    'grants coordinator remote federal agency',
  ],
  procurement_analyst: [
    'procurement analyst remote federal', 'acquisition analyst remote government',
    'procurement specialist remote federal', 'acquisition specialist remote DoD',
    'procurement manager remote federal', 'acquisition manager remote defense',
  ],
}

interface SearchResult {
  title: string
  url: string
  description: string
}

async function serperSearch(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) throw new SearchError('SERPER_API_KEY is not set')
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 10 }),
    })
    const data = await res.json().catch(() => null)
    if (data?.message?.includes('credits')) throw new SearchError('Serper is out of search credits')
    if (!res.ok) throw new SearchError(`Serper error: HTTP ${res.status}`)
    return (data?.organic ?? []).map((r: { title: string; link: string; snippet?: string }) => ({
      title: r.title ?? '', url: r.link ?? '', description: r.snippet ?? '',
    }))
  } catch (err) {
    if (err instanceof SearchError) throw err
    console.error('Serper fetch error:', err)
    return []
  }
}

class SearchError extends Error {}

// Google keeps closed postings indexed for weeks, so confirm each one is
// still open before saving. Closed postings show up as a 404/410 (Lever,
// Ashby), a redirect to the company board with ?error=true (Greenhouse), or
// a 200 page with "closed" copy. Unknowns (timeouts, 403 bot blocks) are kept.
const CLOSED_POSTING_PATTERN = /couldn['’]t find anything here|job not found|no longer accepting applications|(job|position|posting) (is|has been) (closed|filled|removed)|this (job|position|posting) is no longer (available|open|active)|the job you are looking for (is no longer|does not exist)/i

async function isPostingLive(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' },
    })
    if (res.status === 404 || res.status === 410) return false
    if (/[?&]error=true/.test(res.url)) return false
    if (!res.ok) return true
    return !CLOSED_POSTING_PATTERN.test(await res.text())
  } catch {
    return true
  }
}

const ENTRY_LEVEL_PATTERN = /\b(intern|internship|entry[\s-]?level|junior)\b/i

function isEntryLevel(title: string): boolean {
  return ENTRY_LEVEL_PATTERN.test(title)
}

function looksRemote(title: string, description: string, url: string): boolean | null {
  const text = (title + ' ' + description + ' ' + url).toLowerCase()
  const remoteSignals = ['remote', 'work from home', 'wfh', 'fully distributed', 'anywhere in the us', 'anywhere in us']
  const onsiteSignals = ['on-site only', 'onsite only', 'must be local', 'no remote', 'in-office required', 'on site required']
  if (onsiteSignals.some(s => text.includes(s))) return false
  if (remoteSignals.some(s => text.includes(s))) return true
  return null
}

// Score a job using keyword matching — no API calls, no credit usage.
// Base starts at 65 because results come from targeted site: queries that
// already filtered for relevance — not random listings.
function scoreJob(title: string, description: string, category: RoleCategory, isRemote: boolean | null): { score: number; notes: string } {
  const text = (title + ' ' + description).toLowerCase()
  const titleLower = title.toLowerCase()
  const matched: string[] = []

  const titleMatches = ROLE_TITLE_KEYWORDS[category].some(k => titleLower.includes(k))
  if (!titleMatches) return { score: 0, notes: `title doesn't match ${category}` }

  if (/software engineer|software developer|devops|data scientist|machine learning|ml engineer/.test(titleLower)) {
    return { score: 0, notes: 'tech role disqualified' }
  }
  if (isEntryLevel(title)) return { score: 0, notes: 'entry level / intern — excluded' }

  let score = 70
  matched.push('title match')

  if (isRemote === true || /remote|work from home/.test(text)) { score += 5; matched.push('remote') }
  if (/federal|dod|defense|government contract|military|civilian agency|public sector|intelligence|aerospace/.test(text)) {
    score += 10; matched.push('defense/federal/aerospace')
  }
  if (/senior|director|vp |vice president|head of|chief|principal|lead /.test(titleLower)) {
    score += 8; matched.push('senior level')
  }
  if (/\$1[0-9]{2},?[0-9]{3}|\$[1-9][0-9]{2}k|100k|110k|120k|130k|140k|150k/.test(text)) {
    score += 5; matched.push('$100k+ signal')
  }
  if (/shipley|idiq|gwac|ota|far|dfars|sam\.gov|cmmc|nist 800-171|fedramp/.test(text)) {
    score += 5; matched.push('govcon/compliance skills')
  }

  score = Math.min(95, score)
  return { score, notes: matched.join(', ') }
}

async function processQuery(
  query: string,
  category: RoleCategory,
  platform: string,
  db: ReturnType<typeof supabaseAdmin>,
  errors: Set<string>,
): Promise<{ found: number; saved: number; skipped: number }> {
  let found = 0, saved = 0, skipped = 0
  try {
    const results = await serperSearch(query)
    found = results.length
    // Start every liveness check now so they run in parallel, not one per loop pass
    const liveChecks = results.map(r => r.url ? isPostingLive(r.url) : Promise.resolve(false))

    for (const [i, result] of results.entries()) {
      if (!result.url || !result.title) { skipped++; continue }

      // Skip job board index/search pages — only individual postings
      if (
        result.url.includes('/jobs-list') ||
        (result.url.includes('myworkdayjobs.com') && result.url.includes('/jobs?')) ||
        result.url.match(/usajobs\.gov\/(Search|search)/)
      ) { skipped++; continue }

      // URL-only dedup — url is unique, and rejected jobs shouldn't resurface
      const { data: existing } = await db.from('discovered_jobs').select('id').eq('url', result.url).maybeSingle()
      if (existing) { skipped++; continue }

      const remoteHint = looksRemote(result.title, result.description, result.url)
      const segments = result.title.split(/\s*[\|–—]\s*/)
      const keywords = ROLE_TITLE_KEYWORDS[category]
      const titleClean = segments.find(s => keywords.some(k => s.toLowerCase().includes(k)))?.trim() ?? segments[0].trim()

      const { score, notes } = scoreJob(titleClean, result.description, category, remoteHint)
      if (score < 60) { skipped++; continue }

      if (!(await liveChecks[i])) { skipped++; continue }

      const { error: insertErr } = await db.from('discovered_jobs').insert({
        title: titleClean || result.title,
        company: 'See listing',
        url: result.url,
        description: result.description,
        role_category: category,
        is_remote: remoteHint ?? true,
        is_entry_level: false, // already filtered out above
        source_platform: platform,
        fit_score: score,
        fit_notes: notes,
        status: 'new',
      })
      if (insertErr) {
        console.error(`Insert failed: ${insertErr.message} | title="${titleClean}" url="${result.url}"`)
        errors.add(`Database insert failed: ${insertErr.message}`)
        skipped++
      } else {
        saved++
      }
    }
  } catch (err) {
    if (err instanceof SearchError) { errors.add(err.message); throw err }
    console.error(`Discovery error for query "${query}":`, err)
  }
  return { found, saved, skipped }
}

export async function runDiscovery(
  categories: RoleCategory[] = Object.keys(BASE_QUERIES) as RoleCategory[],
  platforms: PlatformKey[] = ALL_PLATFORMS,
): Promise<{ found: number; saved: number; skipped: number; errors: string[] }> {
  const db = supabaseAdmin()
  const errors = new Set<string>()
  const selectedPlatforms = platforms.length > 0 ? platforms : ALL_PLATFORMS

  const queries: { query: string; category: RoleCategory; platform: PlatformKey }[] = []
  for (const category of categories) {
    for (const keyword of BASE_QUERIES[category]) {
      for (const pk of selectedPlatforms) {
        queries.push({ query: `${keyword} ${PLATFORMS[pk].site}`, category, platform: pk })
      }
    }
  }

  const BATCH = 5
  let totalFound = 0, totalSaved = 0, totalSkipped = 0

  for (let i = 0; i < queries.length; i += BATCH) {
    const batch = queries.slice(i, i + BATCH)
    const results = await Promise.allSettled(
      batch.map(({ query, category, platform }) => processQuery(query, category, PLATFORMS[platform].label, db, errors))
    )
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      totalFound += r.value.found
      totalSaved += r.value.saved
      totalSkipped += r.value.skipped
    }
    // Search API is down/out of credits — remaining queries would all fail too
    if (results.some(r => r.status === 'rejected')) break
    if (i + BATCH < queries.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return { found: totalFound, saved: totalSaved, skipped: totalSkipped, errors: [...errors] }
}
