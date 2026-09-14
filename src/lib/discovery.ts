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
}

interface SearchResult {
  title: string
  url: string
  description: string
}

async function serperSearch(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) {
    console.error('SERPER_API_KEY not set — skipping search')
    return []
  }
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 10 }),
    })
    if (!res.ok) {
      console.error(`Serper error: ${res.status}`)
      return []
    }
    const data = await res.json()
    if (data?.statusCode === 400 || data?.message?.includes('credits')) {
      console.error('Serper out of credits')
      return []
    }
    return (data?.organic ?? []).map((r: { title: string; link: string; snippet?: string }) => ({
      title: r.title ?? '', url: r.link ?? '', description: r.snippet ?? '',
    }))
  } catch (err) {
    console.error('Serper fetch error:', err)
    return []
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
  db: ReturnType<typeof supabaseAdmin>
): Promise<{ found: number; saved: number; skipped: number }> {
  let found = 0, saved = 0, skipped = 0
  try {
    const results = await serperSearch(query)
    found = results.length

    for (const result of results) {
      if (!result.url || !result.title) { skipped++; continue }

      // Skip job board index/search pages — only individual postings
      if (
        result.url.includes('/jobs-list') ||
        (result.url.includes('myworkdayjobs.com') && result.url.includes('/jobs?')) ||
        result.url.match(/usajobs\.gov\/(Search|search)/)
      ) { skipped++; continue }

      // URL-only dedup — skip if already saved and not rejected
      const { data: existing } = await db.from('discovered_jobs').select('id, status').eq('url', result.url).maybeSingle()
      if (existing && existing.status !== 'rejected') { skipped++; continue }

      const remoteHint = looksRemote(result.title, result.description, result.url)
      const segments = result.title.split(/\s*[\|–—]\s*/)
      const keywords = ROLE_TITLE_KEYWORDS[category]
      const titleClean = segments.find(s => keywords.some(k => s.toLowerCase().includes(k)))?.trim() ?? segments[0].trim()

      const { score, notes } = scoreJob(titleClean, result.description, category, remoteHint)
      if (score < 60) { skipped++; continue }

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
        skipped++
      } else {
        saved++
      }
    }
  } catch (err) {
    console.error(`Discovery error for query "${query}":`, err)
  }
  return { found, saved, skipped }
}

export async function runDiscovery(
  categories: RoleCategory[] = Object.keys(BASE_QUERIES) as RoleCategory[],
  platforms: PlatformKey[] = ALL_PLATFORMS,
): Promise<{ found: number; saved: number; skipped: number }> {
  const db = supabaseAdmin()
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
    const results = await Promise.all(
      batch.map(({ query, category, platform }) => processQuery(query, category, PLATFORMS[platform].label, db))
    )
    for (const r of results) {
      totalFound += r.found
      totalSaved += r.saved
      totalSkipped += r.skipped
    }
    if (i + BATCH < queries.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return { found: totalFound, saved: totalSaved, skipped: totalSkipped }
}
