import 'server-only'
import { supabaseAdmin } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Target companies — all use Greenhouse's public job board API.
// Free, no API key, no quota, no credits. Runs unlimited times.
// Organized by primary focus but most employ across all job families.
// ─────────────────────────────────────────────────────────────────────────────
const COMPANIES: string[] = [
  // Government consulting & professional services
  'guidehouse', 'icf', 'noblis', 'lmi', 'anser', 'mitre', 'rand',
  'urban-institute', 'mathematica', 'abt-associates', 'westat',
  'prtm', 'boozallen', 'leidos', 'saic', 'caci', 'mantech',
  'peraton', 'amentum', 'chenega', 'akima', 'caliber-systems',
  'mav6', 'engility', 'dxc', 'unison', 'kforce',
  // Big consulting / management consulting
  'mckinsey', 'bcg', 'bain', 'accenture', 'deloitte', 'pwc', 'kpmg', 'ey',
  'oliver-wyman', 'roland-berger', 'strategy-and', 'a-t-kearney',
  'huron-consulting', 'navigant', 'fti-consulting', 'ankura',
  'west-monroe', 'slalom', 'protiviti', 'kroll', 'tetra-tech',
  'aecom', 'burns-mcdonnell', 'wsatkins', 'cdm-smith',
  // Federal program / grants / compliance
  'urban', 'policylink', 'center-on-budget', 'nlihc',
  'national-council-nonprofits', 'vera-institute', 'csg-justice',
  'third-sector', 'grantmakers-health', 'childrendefense',
  'community-solutions', 'enterprise-community', 'lisc',
  'neighborworks', 'homebase', 'nhpf',
  // Compliance & risk
  'riskonnect', 'rsm', 'baker-tilly', 'moss-adams', 'crowe',
  'forvis', 'plante-moran', 'wipfli', 'marcum',
  'ankura-consulting', 'cohnreznick', 'grant-thornton',
  // Healthcare / federal health programs
  'lewin-group', 'health-management-associates', 'maximus',
  'molina-healthcare', 'centene', 'magellan-health',
  'conduent', 'cotiviti', 'evolent-health', 'novu',
  // Technology companies with large federal practices
  'palantir', 'oracle', 'sap', 'microsoft', 'amazon',
  'google', 'salesforce', 'servicenow', 'verint',
  'carahsoft', 'immuta', 'telos', 'perspecta',
  // Workforce / economic development / nonprofits
  'jobstogether', 'workforce-development', 'goodwill',
  'opportunities-industrialization', 'year-up', 'per-scholas',
  'merit-america', 'general-assembly', 'teals',
  // Housing / community development
  'habitat-for-humanity', 'enterprise', 'local-initiatives',
  'low-income-investment-fund', 'national-equity-fund',
  'boston-capital', 'raymond-james-tax-credit',
  // Financial services / public finance
  'public-financial-management', 'ehlers', 'piper-sandler',
  'raymond-james', 'stifel', 'baird',
  // Research & policy
  'rand-corporation', 'urban-institute', 'brookings', 'cato',
  'heritage', 'center-american-progress', 'new-america',
  'aspen-institute', 'carnegie', 'kaiser-family-foundation',
  // Infrastructure / engineering (program mgmt roles)
  'parsons', 'jacobs', 'wsp', 'hntb', 'pbworld',
  'stantec', 'gannett-fleming', 'hdr', 'louis-berger',
  // Defense & intelligence (capture / proposal / contracts)
  'northrop-grumman', 'l3harris', 'bae-systems', 'raytheon',
  'general-dynamics', 'lockheed-martin', 'boeing', 'textron',
  'sierra-nevada', 'vectrus', 'dyncorp', 'parsons-defense',
  'titan-defense', 'apogee', 'gdit', 'unison-consulting',
  // SaaS / tech with BD / program roles
  'stripe', 'twilio', 'zendesk', 'hubspot', 'klaviyo',
  'lattice', 'rippling', 'brex', 'ramp', 'merge',
]

// ─────────────────────────────────────────────────────────────────────────────
// Job title keywords — any job whose title contains one of these passes.
// ─────────────────────────────────────────────────────────────────────────────
const TITLE_KEYWORDS = [
  // Proposals & Capture
  'proposal', 'capture', 'bid manager', 'bid coordinator',
  // Contracts & Procurement
  'contract', 'contracts', 'procurement', 'acquisition', 'vendor manager',
  // Compliance & Risk
  'compliance', 'regulatory', 'risk and compliance', 'program integrity',
  'quality assurance', 'policy and compliance',
  // Grants & Programs
  'grants', 'grant ', 'grant manager', 'grant admin', 'technical assistance',
  'program administrator',
  // Program & Operations
  'program manager', 'program operations', 'pmo', 'portfolio manager',
  'program analyst', 'program director', 'program governance',
  'strategic operations', 'process improvement', 'operations manager',
  'operations director', 'program controls',
  // Government & Public Sector
  'government consulting', 'public sector', 'community development',
  'economic development', 'workforce development', 'government programs',
  'government relations', 'federal programs',
  // Business Development
  'business development', 'bd director', 'bd manager',
  'capture director', 'director of business', 'vice president business',
  'strategic partnerships', 'account director', 'sales director',
  'professional services director', 'client development',
  // Consulting
  'senior consultant', 'principal consultant', 'managing consultant',
  'management consulting', 'implementation consultant',
]

// Hard disqualifiers — reject these even if a keyword matches
const DISQUALIFY = [
  'software engineer', 'software developer', 'devops', 'data scientist',
  'machine learning', 'ml engineer', 'frontend', 'backend', 'full stack',
  'fullstack', 'data engineer', 'mobile engineer', 'ios engineer',
  'android engineer', 'site reliability', 'security engineer',
  'network engineer', 'cloud engineer',
]

function titleMatches(title: string): boolean {
  const t = title.toLowerCase()
  if (DISQUALIFY.some(d => t.includes(d))) return false
  return TITLE_KEYWORDS.some(k => t.includes(k))
}

interface GreenhouseJob {
  id: number
  title: string
  absolute_url: string
  location?: { name?: string }
  content?: string
}

async function fetchGreenhouseJobs(company: string): Promise<GreenhouseJob[]> {
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.jobs) ? data.jobs : []
  } catch {
    return []
  }
}

function scoreJob(title: string, location: string): number {
  const t = title.toLowerCase()
  const l = (location ?? '').toLowerCase()
  let score = 70

  // Remote confirmed
  if (l.includes('remote') || l.includes('anywhere') || l.includes('united states')) {
    score += 10
  }
  // Senior / director level
  if (/senior|director|vp |vice president|head of|chief|principal|lead |managing/.test(t)) {
    score += 8
  }
  // Federal / government domain signals
  if (/federal|government|public sector|defense|dod|civilian|grants|compliance/.test(t)) {
    score += 7
  }

  return Math.min(95, score)
}

function mapCategory(title: string): string {
  const t = title.toLowerCase()
  if (/proposal|capture|bid/.test(t)) return 'proposals'
  if (/contract|procurement|acquisition|vendor/.test(t)) return 'contracts'
  if (/compliance|regulatory|risk|integrity/.test(t)) return 'compliance'
  if (/grant|technical assistance|program admin/.test(t)) return 'grants'
  if (/program manager|program ops|pmo|portfolio|program analyst|program director|program controls|program govern|operations manager|operations director|process improvement|strategic ops/.test(t)) return 'program_ops'
  if (/community development|economic development|workforce|government program|government relation|public sector|federal program/.test(t)) return 'govcon_public'
  if (/business development|bd director|bd manager|partnerships|account director|sales director|client development/.test(t)) return 'business_dev'
  if (/consultant|consulting/.test(t)) return 'consulting'
  return 'govcon'
}

export async function runDiscovery(): Promise<{ found: number; saved: number; skipped: number }> {
  const db = supabaseAdmin()
  const today = new Date().toISOString().split('T')[0]

  let totalFound = 0, totalSaved = 0, totalSkipped = 0

  // Process companies in batches of 10 to avoid overwhelming Vercel's function timeout
  const BATCH = 10
  for (let i = 0; i < COMPANIES.length; i += BATCH) {
    const batch = COMPANIES.slice(i, i + BATCH)

    const results = await Promise.all(batch.map(async (company) => {
      const jobs = await fetchGreenhouseJobs(company)
      let found = 0, saved = 0, skipped = 0

      for (const job of jobs) {
        found++
        if (!job.title || !job.absolute_url) { skipped++; continue }
        if (!titleMatches(job.title)) { skipped++; continue }

        // Skip if URL already in DB
        const { data: existing } = await db
          .from('discovered_jobs')
          .select('id')
          .eq('url', job.absolute_url)
          .maybeSingle()
        if (existing) { skipped++; continue }

        const location = job.location?.name ?? ''
        const score = scoreJob(job.title, location)
        const category = mapCategory(job.title)
        const isRemote = /remote|anywhere|united states/i.test(location)

        const { error } = await db.from('discovered_jobs').insert({
          title: job.title,
          company: company.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          url: job.absolute_url,
          description: job.content
            ? job.content.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 500)
            : null,
          role_category: 'govcon_other',
          role_type: category,
          is_remote: isRemote,
          salary_raw: null,
          fit_score: score,
          fit_notes: category,
          status: 'new',
        })

        if (error) {
          console.error(`INSERT FAILED [${company}]: ${error.message}`)
          skipped++
        } else {
          saved++
        }
      }

      return { found, saved, skipped }
    }))

    for (const r of results) {
      totalFound += r.found
      totalSaved += r.saved
      totalSkipped += r.skipped
    }

    // Small delay between batches to stay polite
    if (i + BATCH < COMPANIES.length) {
      await new Promise(r => setTimeout(r, 200))
    }
  }

  if (totalSaved > 0) {
    await db.rpc('increment_discovered', { p_date: today, p_count: totalSaved })
  }

  console.log(`Discovery complete: found=${totalFound} saved=${totalSaved} skipped=${totalSkipped}`)
  return { found: totalFound, saved: totalSaved, skipped: totalSkipped }
}
