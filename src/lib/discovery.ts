import 'server-only'
import { supabaseAdmin } from './supabase'
import type { Category } from './types'

const EXCL = [
  '-site:indeed.com', '-site:linkedin.com', '-site:glassdoor.com',
  '-site:ziprecruiter.com', '-site:monster.com', '-site:careerbuilder.com',
  '-site:simplyhired.com', '-site:salary.com',
].join(' ')

const QUERIES: { q: string; category: Category }[] = [
  { q: `"proposal manager" OR "capture manager" OR "proposal director" OR "bid manager" remote job ${EXCL}`, category: 'proposals' },
  { q: `"senior capture manager" OR "director of capture" OR "VP proposals" remote federal job ${EXCL}`, category: 'proposals' },
  { q: `"contracts manager" OR "contract administrator" OR "contract specialist" OR "procurement manager" remote job ${EXCL}`, category: 'contracts' },
  { q: `"compliance manager" OR "compliance director" OR "compliance program manager" remote job ${EXCL}`, category: 'compliance' },
  { q: `"grants manager" OR "grants administrator" OR "grant compliance" OR "federal grants" remote job ${EXCL}`, category: 'grants' },
  { q: `"program manager" OR "program director" OR "PMO director" remote federal government job ${EXCL}`, category: 'program_ops' },
  { q: `"business development director" OR "VP of business development" OR "director of business development" remote job ${EXCL}`, category: 'business_dev' },
  { q: `"senior consultant" OR "principal consultant" OR "managing consultant" remote federal job ${EXCL}`, category: 'consulting' },
  { q: `"community development director" OR "economic development director" OR "workforce development director" remote job ${EXCL}`, category: 'govcon_public' },
  { q: `"chief diversity officer" OR "VP of DEI" OR "director of DEI" OR "director of diversity" OR "chief people officer" remote job ${EXCL}`, category: 'dei_hr' },
  { q: `"DEI manager" OR "diversity equity inclusion manager" OR "HR compliance manager" OR "employee relations manager" OR "EEO officer" remote job ${EXCL}`, category: 'dei_hr' },
  { q: `"people operations" OR "VP HR compliance" OR "director employee relations" OR "labor compliance manager" remote job ${EXCL}`, category: 'dei_hr' },
]

const TECH_ONLY = [
  'software engineer', 'software developer', 'devops engineer', 'data scientist',
  'machine learning engineer', 'frontend engineer', 'backend engineer',
  'full stack engineer', 'data engineer', 'mobile engineer', 'ios engineer',
  'android engineer', 'site reliability engineer', 'security engineer',
  'network engineer', 'cloud engineer', 'infrastructure engineer',
]

function isTechRole(title: string): boolean {
  const t = title.toLowerCase()
  return TECH_ONLY.some(d => t.includes(d))
}

function score(title: string, snippet: string, cat: Category): number {
  const text = (title + ' ' + snippet).toLowerCase()
  let s = 72
  if (/remote|work from home/.test(text)) s += 5
  if (/federal|government|dod|defense|public sector|grants|compliance/.test(text)) s += 6
  if (/senior|director|vp |vice president|head of|chief|principal|managing|manager/.test(title.toLowerCase())) s += 8
  if (['proposals', 'compliance', 'dei_hr', 'grants'].includes(cat)) s += 3
  return Math.min(97, s)
}

function detectCat(title: string, snippet: string, fallback: Category): Category {
  const t = (title + ' ' + snippet).toLowerCase()
  if (/diversity|dei|inclusion|equity|chief diversity|chief people|employee relations|eeo|hr compliance|labor compliance|people ops/.test(t)) return 'dei_hr'
  if (/proposal|capture|bid manager/.test(t)) return 'proposals'
  if (/contract |contracts |procurement/.test(t)) return 'contracts'
  if (/compliance|regulatory/.test(t)) return 'compliance'
  if (/\bgrant|\bgrants/.test(t)) return 'grants'
  if (/program manager|program director|pmo|portfolio manager/.test(t)) return 'program_ops'
  if (/community development|economic development|workforce development/.test(t)) return 'govcon_public'
  if (/business development|bd director/.test(t)) return 'business_dev'
  if (/consultant|consulting/.test(t)) return 'consulting'
  return fallback
}

function parseTitle(raw: string): string {
  // Google titles come as "Job Title | Company" or "Job Title - Company | Careers"
  // Split on pipe first, take the first chunk, then strip company suffix after " - "
  const pipeParts = raw.split('|')
  let candidate = pipeParts[0].trim()
  // Remove trailing " - Company Name" if the first chunk is "Title - Company"
  const dashParts = candidate.split(' - ')
  if (dashParts.length >= 2 && dashParts[0].length < 80) {
    candidate = dashParts[0].trim()
  }
  return candidate || raw.trim()
}

function parseCompany(raw: string, url: string): string {
  const pipeParts = raw.split('|')
  if (pipeParts.length >= 2) {
    const last = pipeParts[pipeParts.length - 1].trim()
    if (last.length > 1 && last.length < 60 && !/careers|jobs|apply|hiring/i.test(last)) return last
    if (pipeParts.length >= 3) {
      const mid = pipeParts[1].trim()
      if (mid.length > 1 && mid.length < 60 && !/careers|jobs/i.test(mid)) return mid
    }
  }
  try {
    const host = new URL(url).hostname.replace('www.', '').split('.')[0]
    return host.charAt(0).toUpperCase() + host.slice(1)
  } catch { return 'See listing' }
}

async function serperSearch(q: string): Promise<{ title: string; link: string; snippet: string }[]> {
  const key = process.env.SERPER_API_KEY
  if (!key) { console.error('SERPER_API_KEY missing'); return [] }
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, num: 10 }),
    })
    if (!res.ok) { console.error(`Serper ${res.status}`); return [] }
    const data = await res.json()
    if (data?.message?.toLowerCase().includes('credit')) { console.error('Serper credits exhausted'); return [] }
    return (data?.organic ?? []).map((r: { title?: string; link?: string; snippet?: string }) => ({
      title: r.title ?? '',
      link: r.link ?? '',
      snippet: r.snippet ?? '',
    }))
  } catch (e) { console.error('Serper fetch error:', e); return [] }
}

export async function runDiscovery(): Promise<{ found: number; saved: number; skipped: number }> {
  const db = supabaseAdmin()
  let found = 0, saved = 0, skipped = 0

  for (const { q, category } of QUERIES) {
    const results = await serperSearch(q)
    found += results.length

    for (const r of results) {
      if (!r.link || !r.title) { skipped++; continue }
      // Skip bare index pages like /jobs or /careers with nothing after
      if (/\/(jobs|careers)\/?$/.test(r.link)) { skipped++; continue }
      // Skip obvious tech-only roles
      if (isTechRole(r.title)) { skipped++; continue }

      const title = parseTitle(r.title)
      const company = parseCompany(r.title, r.link)
      const cat = detectCat(title, r.snippet, category)
      const fitScore = score(title, r.snippet, cat)
      const isRemote = /remote|work from home/i.test(r.title + ' ' + r.snippet)

      // Check if this URL already exists in the DB
      const { data: existing } = await db
        .from('discovered_jobs')
        .select('id, status')
        .eq('url', r.link)
        .maybeSingle()

      if (existing) {
        // Already in queue as 'new' — no need to re-add
        if (existing.status === 'new') { skipped++; continue }
        // Was previously rejected/applied — re-queue it (it's a live posting again)
        const { error: updateErr } = await db
          .from('discovered_jobs')
          .update({ status: 'new', fit_score: fitScore, fit_notes: cat, updated_at: new Date().toISOString() } as Record<string, unknown>)
          .eq('id', existing.id)
        if (updateErr) { console.error('UPDATE error:', updateErr.message); skipped++ }
        else saved++
        continue
      }

      // New URL — insert fresh
      const { error } = await db.from('discovered_jobs').insert({
        title,
        company,
        url: r.link,
        description: r.snippet,
        role_category: 'govcon_other',
        role_type: cat,
        is_remote: isRemote,
        salary_raw: null,
        fit_score: fitScore,
        fit_notes: cat,
        status: 'new',
      })

      if (error) { console.error('INSERT error:', error.message, '|', title); skipped++ }
      else saved++
    }

    await new Promise(r => setTimeout(r, 250))
  }

  console.log(`Discovery: found=${found} saved=${saved} skipped=${skipped}`)
  return { found, saved, skipped }
}
