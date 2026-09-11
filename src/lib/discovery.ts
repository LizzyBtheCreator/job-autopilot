import 'server-only'
import { supabaseAdmin } from './supabase'
import type { Category } from './types'
import { PLATFORMS, ALL_PLATFORMS, type PlatformKey, TEMP_AGENCIES, ALL_TEMP_AGENCIES, type TempAgencyKey } from './platforms'

// Re-exported for existing server-side callers (API routes) — client
// components should import these directly from '@/lib/platforms' instead.
export { PLATFORMS, ALL_PLATFORMS, type PlatformKey, TEMP_AGENCIES, ALL_TEMP_AGENCIES, type TempAgencyKey }

// Base keyword queries — each will be run once per selected platform
// One platform per query so no platform gets crowded out by higher-authority domains
const baseQueries: Record<Category, string[]> = {
  sales: [
    // Technical Account Manager / Customer Success — govtech and federal SaaS
    '"technical account manager" remote federal',
    '"technical account manager" remote government',
    '"technical account manager" remote SaaS federal',
    '"federal customer success manager" remote',
    '"customer success manager" remote federal government',
    '"senior customer success manager" remote federal',
    '"director of customer success" remote federal',
    // Partner / Channel / Alliance
    '"partner development manager" remote federal',
    '"partner development manager" remote government',
    '"alliance manager" remote federal',
    '"channel partner manager" remote government',
    // Revenue Operations
    '"revenue operations manager" remote',
    '"RevOps manager" remote',
    '"senior revenue operations manager" remote',
    '"director of revenue operations" remote',
    // Solutions Consultant / pre-sales
    '"solutions consultant" remote federal',
    '"solutions consultant" remote government',
    '"pre-sales consultant" remote federal',
    '"solutions architect" remote federal SaaS',
    // Staffing / workforce BD
    '"workforce solutions manager" remote federal',
    '"federal staffing manager" remote',
    '"government services manager" remote staffing',
    // SaaS implementation / onboarding / operations
    '"implementation manager" remote SaaS',
    '"senior implementation manager" remote SaaS',
    '"customer onboarding manager" remote SaaS',
    '"onboarding manager" remote SaaS federal',
    '"technical program manager" remote SaaS',
    '"technical program manager" remote government',
    '"product operations manager" remote SaaS',
    '"partnerships manager" remote SaaS',
    '"director of partnerships" remote SaaS',
    '"implementation consultant" remote government',
    '"deployment manager" remote SaaS federal',
    // Franchise development
    '"franchise development manager" remote',
    '"director of franchise development" remote',
    '"franchise sales manager" remote',
    '"franchise development director" remote',
    '"VP franchise development" remote',
    '"franchise business development" manager remote',
    '"franchise growth manager" remote',
  ],
  govcon: [
    // Proposal management
    '"proposal manager" remote federal',
    '"proposal manager" remote defense',
    '"proposal manager" remote DoD',
    '"proposal manager" remote "government contracts"',
    '"proposal manager" remote IDIQ',
    '"proposal manager" remote cybersecurity federal',
    '"proposal manager" remote aerospace',
    '"proposal manager" remote "intelligence community"',
    // Senior / Director
    '"senior proposal manager" remote federal',
    '"senior proposal manager" remote defense',
    '"director of proposals" remote federal',
    '"proposal director" remote federal',
    '"director of capture" remote federal',
    // Capture management
    '"capture manager" remote federal',
    '"senior capture manager" remote federal',
    '"capture manager" remote defense',
    '"capture manager" remote DoD',
    // Proposal writing / coordination
    '"proposal writer" remote federal',
    '"proposal coordinator" remote federal',
    '"proposal specialist" remote federal',
    '"bid manager" remote federal',
    // BD / Growth — senior
    '"director of business development" remote federal',
    '"director of business development" remote defense',
    '"growth director" remote federal',
    '"business development manager" remote federal',
    '"business development manager" remote defense',
    // Contracts — federal
    '"contracts manager" remote federal',
    '"senior contracts manager" remote federal',
    '"contract specialist" remote federal',
    '"contract specialist" remote DoD',
    '"contracts administrator" remote federal',
    '"contracts administrator" remote defense',
    '"subcontracts manager" remote federal',
    '"director of contracts" remote federal',
    '"contracting officer" remote federal',
    '"acquisition specialist" remote federal',
    '"procurement specialist" remote federal',
    // Contracts — commercial / tech
    '"contracts manager" remote SaaS',
    '"commercial contracts manager" remote',
    '"contracts manager" remote cybersecurity',
    '"senior contracts manager" remote technology',
    // Compliance / grants / pricing
    '"compliance manager" remote federal',
    '"grants manager" remote federal',
    '"grants administrator" remote federal',
    '"pricing analyst" remote federal',
    '"cost analyst" remote federal',
    // Program management
    '"federal program manager" remote',
    '"senior program manager" remote federal',
    '"program manager" remote DoD',
    '"director of program management" remote federal',
    // VP / executive level
    '"VP of business development" remote federal',
    '"VP of business development" remote defense',
    '"VP of capture" remote federal',
    '"VP of proposals" remote federal',
    '"vice president business development" remote federal',
    '"chief growth officer" remote federal',
    '"head of business development" remote federal',
    '"head of capture" remote defense',
    '"SVP business development" remote federal',
    // Procurement Engineering — senior levels
    '"senior procurement engineer" remote',
    '"senior procurement engineer" defense',
    '"senior procurement engineer" federal',
    '"senior procurement engineer" aerospace',
    '"lead procurement engineer" remote',
    '"principal procurement engineer" remote',
    '"procurement engineer" remote federal',
    '"procurement engineer" remote defense',
    '"director of procurement" remote federal',
    '"director of procurement" remote defense',
    '"procurement manager" remote federal',
    '"senior procurement manager" remote defense',
    '"supply chain manager" remote federal',
    // Fractional / contract / interim roles
    '"fractional" "business development" federal defense',
    '"fractional" "capture manager" remote',
    '"fractional" "proposal manager" remote',
    '"fractional" "COO" OR "chief operating officer" remote',
    '"fractional" "BD director" remote federal',
    '"fractional" "program manager" remote federal',
    '"contract" "proposal manager" remote federal',
    '"contract" "capture manager" remote federal',
    '"interim" "business development director" remote federal',
    '"interim" "proposal manager" remote federal',
    '"interim" "program manager" remote federal',
    '"contract" "BD manager" remote defense',
    '"1099" "proposal manager" remote federal',
    '"independent contractor" "capture manager" remote',
    '"senior supply chain manager" remote defense',
    // Grants / Federal Awards — niche, low competition
    '"federal awards administrator" remote',
    '"grants compliance officer" remote federal',
    '"subrecipient monitoring specialist" remote',
    '"2 CFR Part 200" compliance remote',
    '"CDBG program administrator" remote',
    '"community development finance" manager remote',
    '"federal programs director" remote nonprofit',
    '"grants management specialist" remote federal',
    '"federal awards manager" remote',
    '"single audit coordinator" remote',
    // Small Business / Teaming niche
    '"small business liaison officer" remote',
    '"SBLO" remote federal',
    '"teaming agreement manager" remote federal',
    '"subcontracts administrator" remote federal',
    '"small business program manager" remote federal',
    // GWAC / IDIQ task order management
    '"GWAC task order manager" remote',
    '"IDIQ task order manager" remote',
    '"contract closeout specialist" remote federal',
    '"task order manager" remote federal defense',
    '"ordering officer" remote federal',
    // Nonprofit / university federal programs
    '"federal programs director" remote',
    '"federal programs manager" remote nonprofit',
    '"HUD program administrator" remote',
    '"CDBG program manager" remote',
    '"HOME program manager" remote',
    '"community development program manager" remote',
    '"housing development finance manager" remote',
    '"federal grants manager" remote nonprofit',
    '"federal awards manager" remote university',
    '"community development manager" remote federal',
    '"housing program manager" remote HUD',
    '"director of federal programs" remote nonprofit',
    '"LIHTC program manager" remote',
    '"CDFI program manager" remote',
    // Training and Technical Assistance
    '"technical assistance specialist" remote federal',
    '"training specialist" remote federal',
    '"capacity building manager" remote',
    '"program training manager" remote federal',
    '"technical assistance manager" remote HUD',
    '"training and technical assistance" manager remote',
    '"TA specialist" remote federal housing',
    '"compliance training manager" remote federal',
    '"federal training specialist" remote',
  ],
  datacenter: [],
  quickhire: [
    // Nonprofit executive / program leadership
    '"executive director" remote nonprofit',
    '"director of programs" remote nonprofit',
    '"director of programs" nonprofit community services',
    '"community services director" remote',
    '"community services manager" remote',
    '"director of community programs" remote',
    '"program director" remote nonprofit federal',
    // Crisis / youth / social services leadership
    '"crisis services director" remote',
    '"crisis program manager" remote',
    '"youth services director" remote',
    '"youth program director" remote nonprofit',
    '"director of youth services" remote',
    '"director of social services" remote nonprofit',
    '"social services manager" remote nonprofit',
    // Housing / community development nonprofit
    '"housing program director" remote nonprofit',
    '"director of housing" remote nonprofit',
    '"community development director" remote nonprofit',
    '"affordable housing manager" remote',
    '"housing navigator" remote',
    // Operations and admin leadership at nonprofits
    '"director of operations" remote nonprofit',
    '"chief operating officer" remote nonprofit small',
    '"VP of programs" remote nonprofit',
  ],
  compliance: [
    // FedRAMP program management
    '"FedRAMP" "program manager" remote',
    '"FedRAMP" "principal program manager" remote',
    '"FedRAMP" "program manager" SaaS remote',
    '"FedRAMP authorization" "program manager" remote',
    '"FedRAMP" "compliance manager" remote',
    // CMMC
    '"CMMC" "compliance manager" remote',
    '"CMMC" "program manager" remote',
    '"CMMC" "compliance advisor" remote',
    // GRC / public sector
    '"GRC" "public sector" remote',
    '"GRC manager" federal remote',
    '"governance risk compliance" federal remote',
    '"director of GRC" remote federal',
    '"principal GRC" remote',
    // Public sector compliance program management
    '"public sector compliance" "program manager" remote',
    '"federal compliance" "program manager" remote',
    '"principal program manager" "public sector" compliance remote',
    '"senior program manager" FedRAMP remote',
    '"compliance program manager" federal SaaS remote',
    // NIST / FISMA / DoD
    '"NIST 800-171" compliance manager remote',
    '"NIST 800-53" program manager remote',
    '"FISMA" compliance manager remote',
    '"DoD compliance" program manager remote',
    '"IL5" compliance manager remote',
    // Security compliance
    '"security compliance" "program manager" SaaS remote',
    '"senior compliance manager" federal SaaS remote',
    '"compliance director" federal SaaS remote',
    '"director of compliance" public sector remote',
    // Zero trust / SLED
    '"SLED compliance" program manager remote',
    '"state local education" compliance manager remote',
    '"zero trust" compliance program manager remote',
    // ATO / Authorization niche
    '"authority to operate" program manager remote',
    '"ATO program manager" remote federal',
    '"ATO" "program manager" SaaS remote',
    '"authorization to operate" manager remote',
    // Supply chain / SCRM
    '"supply chain risk management" analyst remote federal',
    '"SCRM analyst" remote federal',
    '"supply chain risk" compliance manager remote',
    // CMMC Practitioner
    '"CMMC registered practitioner" remote',
    '"CMMC RP" remote',
    '"CMMC third party assessor" remote',
    '"cybersecurity maturity model" compliance remote',
    // FedRAMP Package Owner
    '"FedRAMP package owner" remote',
    '"FedRAMP reviewer" remote',
    '"cloud security" compliance manager remote federal',
  ],
  temp: [
    'proposal manager contract',
    'proposal coordinator contract remote',
    'business development coordinator contract remote',
    'program manager contract remote',
    'operations coordinator contract remote',
    'project manager contract remote',
    'contracts manager temp remote',
    'proposal writer contract remote',
    'capture manager contract',
    'grants manager contract remote',
    'federal awards administrator contract',
    'compliance manager contract remote federal',
    'customer success manager contract remote',
    'technical account manager contract remote',
  ],
}

interface SearchResult {
  title: string
  url: string
  description: string
}

// Robert Half job search — parses their public job listing page
async function robertHalfSearch(keywords: string): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams({ q: keywords, location: 'remote' })
    const url = `https://www.roberthalf.com/us/en/jobs?${params}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    if (!res.ok) { console.error(`Robert Half error: ${res.status}`); return [] }
    const html = await res.text()
    const results: SearchResult[] = []

    // Extract job links from HTML — Robert Half uses /us/en/job/ URLs
    const linkPattern = /href="(\/us\/en\/job\/[^"]+)"/g
    const titlePattern = /<h2[^>]*class="[^"]*job[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi
    const seen = new Set<string>()
    let match

    while ((match = linkPattern.exec(html)) !== null) {
      const path = match[1]
      const fullUrl = `https://www.roberthalf.com${path}`
      if (!seen.has(fullUrl)) {
        seen.add(fullUrl)
        // Extract a nearby title snippet from the HTML around this link
        const start = Math.max(0, match.index - 500)
        const chunk = html.slice(start, match.index + 200)
        const titleMatch = chunk.match(/>([A-Z][^<]{10,80})<\//)
        const title = titleMatch ? titleMatch[1].trim() : keywords
        results.push({ title, url: fullUrl, description: `${title} — Robert Half contract placement` })
      }
      if (results.length >= 10) break
    }

    // Fallback: try to find JSON data embedded in the page
    if (results.length === 0) {
      const jsonMatch = html.match(/"jobs"\s*:\s*(\[[\s\S]{0,8000}?\])/)
      if (jsonMatch) {
        try {
          const jobs = JSON.parse(jsonMatch[1])
          for (const job of jobs.slice(0, 10)) {
            if (job.url && job.title) {
              results.push({ title: job.title, url: job.url, description: job.description ?? job.title })
            }
          }
        } catch { /* ignore parse errors */ }
      }
    }

    return results
  } catch (err) {
    console.error('Robert Half search error:', err)
    return []
  }
}

// Adecco job search — parses their public job listing page
async function adeccoSearch(keywords: string): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams({ q: keywords, remote: 'true' })
    const url = `https://www.adeccousa.com/jobs-and-careers/?${params}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    if (!res.ok) { console.error(`Adecco error: ${res.status}`); return [] }
    const html = await res.text()
    const results: SearchResult[] = []
    const seen = new Set<string>()

    // Adecco job links typically contain /job/ or /jobs/
    const linkPattern = /href="((?:https:\/\/www\.adeccousa\.com)?\/(?:jobs?|job-detail|careers?)[^"#?]{5,150})"/g
    let match
    while ((match = linkPattern.exec(html)) !== null) {
      const raw = match[1]
      const fullUrl = raw.startsWith('http') ? raw : `https://www.adeccousa.com${raw}`
      if (!seen.has(fullUrl) && !fullUrl.includes('jobs-and-careers/?') && !fullUrl.includes('/jobs-and-careers/search')) {
        seen.add(fullUrl)
        const start = Math.max(0, match.index - 400)
        const chunk = html.slice(start, match.index + 200)
        const titleMatch = chunk.match(/>([A-Z][^<]{10,80})<\//)
        const title = titleMatch ? titleMatch[1].trim() : keywords
        results.push({ title, url: fullUrl, description: `${title} — Adecco contract placement` })
      }
      if (results.length >= 10) break
    }

    // Also try their JSON API endpoint
    if (results.length === 0) {
      try {
        const apiUrl = `https://www.adeccousa.com/api/jobs/search?q=${encodeURIComponent(keywords)}&remote=true`
        const apiRes = await fetch(apiUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        })
        if (apiRes.ok) {
          const data = await apiRes.json()
          const jobs = Array.isArray(data) ? data : (data.jobs ?? data.results ?? [])
          for (const job of jobs.slice(0, 10)) {
            const title = job.title ?? job.jobTitle ?? keywords
            const jobUrl = job.url ?? job.applyUrl ?? job.detailUrl ?? ''
            if (jobUrl) results.push({ title, url: jobUrl, description: job.description ?? title })
          }
        }
      } catch { /* ignore */ }
    }

    return results
  } catch (err) {
    console.error('Adecco search error:', err)
    return []
  }
}

// Generic staffing agency scraper — uses their public search page and JSON APIs
async function genericStaffingSearch(
  agencyKey: string,
  keywords: string
): Promise<SearchResult[]> {
  const configs: Record<string, { url: string; linkPattern: RegExp; label: string }> = {
    staffmark: {
      url: `https://www.staffmark.com/find-a-job?q=${encodeURIComponent(keywords)}&location=remote`,
      linkPattern: /href="((?:https:\/\/www\.staffmark\.com)?\/jobs?\/[^"#?]{5,150})"/g,
      label: 'Staffmark',
    },
    kelly: {
      url: `https://jobs.kellyservices.com/search?q=${encodeURIComponent(keywords)}&location=remote`,
      linkPattern: /href="((?:https:\/\/jobs\.kellyservices\.com)?\/job\/[^"#?]{5,150})"/g,
      label: 'Kelly Services',
    },
    manpower: {
      url: `https://www.manpower.com/wps/portal/manpowerUSA/jobSearch?keywords=${encodeURIComponent(keywords)}&remote=true`,
      linkPattern: /href="((?:https:\/\/www\.manpower\.com)?\/wps\/portal\/manpowerUSA\/jobDetail[^"#?]{5,150})"/g,
      label: 'Manpower',
    },
    aerotek: {
      url: `https://jobs.aerotek.com/us/en/search?q=${encodeURIComponent(keywords)}&remote=1`,
      linkPattern: /href="((?:https:\/\/jobs\.aerotek\.com)?\/us\/en\/job\/[^"#?]{5,150})"/g,
      label: 'Aerotek',
    },
    spherion: {
      url: `https://www.spherion.com/jobs-search?q=${encodeURIComponent(keywords)}&remote=true`,
      linkPattern: /href="((?:https:\/\/www\.spherion\.com)?\/jobs?\/[^"#?]{5,150})"/g,
      label: 'Spherion',
    },
    randstad: {
      url: `https://www.randstadusa.com/jobs/?q=${encodeURIComponent(keywords)}&remote=true`,
      linkPattern: /href="((?:https:\/\/www\.randstadusa\.com)?\/jobs\/[^"#?]{5,200})"/g,
      label: 'Randstad',
    },
  }

  const cfg = configs[agencyKey]
  if (!cfg) return []

  try {
    const res = await fetch(cfg.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    if (!res.ok) { console.error(`${cfg.label} error: ${res.status}`); return [] }
    const html = await res.text()
    const results: SearchResult[] = []
    const seen = new Set<string>()
    let match
    const re = cfg.linkPattern
    re.lastIndex = 0

    while ((match = re.exec(html)) !== null) {
      const raw = match[1]
      const base = cfg.url.match(/^(https:\/\/[^/]+)/)?.[1] ?? ''
      const fullUrl = raw.startsWith('http') ? raw : `${base}${raw}`
      if (!seen.has(fullUrl)) {
        seen.add(fullUrl)
        const start = Math.max(0, match.index - 500)
        const chunk = html.slice(start, match.index + 200)
        const titleMatch = chunk.match(/>([A-Z][^<]{10,80})<\//)
        const title = titleMatch ? titleMatch[1].trim() : keywords
        results.push({ title, url: fullUrl, description: `${title} — ${cfg.label} contract placement` })
      }
      if (results.length >= 8) break
    }
    return results
  } catch (err) {
    console.error(`${agencyKey} search error:`, err)
    return []
  }
}

// Map agency key to the right scraper
async function tempAgencySearch(agencyKey: string, keywords: string): Promise<SearchResult[]> {
  if (agencyKey === 'adecco') return adeccoSearch(keywords)
  if (agencyKey === 'roberthalf') return robertHalfSearch(keywords)
  return genericStaffingSearch(agencyKey, keywords)
}

// LinkedIn guest jobs API — free, no key needed, returns real individual job postings
async function linkedinGuestSearch(keywords: string, start = 0): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams({
      keywords,
      location: 'United States',
      f_WT: '2', // remote
      start: String(start),
    })
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    if (!res.ok) { console.error(`LinkedIn guest error: ${res.status}`); return [] }
    const html = await res.text()

    // Parse job cards from HTML
    const results: SearchResult[] = []
    const cardPattern = /<li[^>]*>[\s\S]*?<\/li>/g
    const cards = html.match(cardPattern) ?? []

    for (const card of cards) {
      // Extract job URL
      const linkMatch = card.match(/href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"?]+)/)
      if (!linkMatch) continue
      const url = linkMatch[1]

      // Extract title
      const titleMatch = card.match(/class="base-search-card__title"[^>]*>\s*([\s\S]*?)\s*<\/h3>/) ||
                         card.match(/class="[^"]*job-search-card__title[^"]*"[^>]*>\s*([\s\S]*?)\s*<\//)
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : ''

      // Extract company
      const companyMatch = card.match(/class="base-search-card__subtitle"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/) ||
                           card.match(/class="[^"]*job-search-card__company-name[^"]*"[^>]*>([\s\S]*?)<\//)
      const company = companyMatch ? companyMatch[1].replace(/<[^>]+>/g, '').trim() : ''

      // Extract location/description snippet
      const locMatch = card.match(/class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/) ||
                       card.match(/class="[^"]*base-search-card__metadata[^"]*"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/)
      const description = locMatch ? locMatch[1].replace(/<[^>]+>/g, '').trim() : 'Remote'

      if (title && url) {
        results.push({ title: company ? `${title} at ${company}` : title, url, description })
      }
    }
    return results
  } catch (err) {
    console.error('LinkedIn guest search error:', err)
    return []
  }
}

// Brave Search API — free tier (2,000 queries/month), respects site: operators
// Get a free key at https://api.search.brave.com/
async function braveSearch(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY
  if (!apiKey) return []
  try {
    const params = new URLSearchParams({ q: query, count: '10' })
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    })
    if (!res.ok) {
      console.error(`Brave Search error: ${res.status}`)
      return []
    }
    const data = await res.json()
    return (data?.web?.results ?? []).map((r: { title: string; url: string; description?: string }) => ({
      title: r.title ?? '', url: r.url ?? '', description: r.description ?? '',
    }))
  } catch (err) {
    console.error('Brave Search error:', err)
    return []
  }
}

async function serperSearch(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) {
    // No Serper key — try Brave
    return braveSearch(query)
  }
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 10 }),
    })
    if (!res.ok) {
      console.error(`Serper error: ${res.status} — falling back to Brave Search`)
      return braveSearch(query)
    }
    const data = await res.json()
    // Check for "Not enough credits" response body
    if (data?.statusCode === 400 || data?.message?.includes('credits')) {
      console.error('Serper out of credits — falling back to Brave Search')
      return braveSearch(query)
    }
    return (data?.organic ?? []).map((r: { title: string; link: string; snippet?: string }) => ({
      title: r.title ?? '', url: r.link ?? '', description: r.snippet ?? '',
    }))
  } catch (err) {
    console.error('Serper fetch error — falling back to Brave Search:', err)
    return braveSearch(query)
  }
}

async function googleCseSearch(query: string, apiKey: string, cseId: string): Promise<SearchResult[]> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}&num=10`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`Google CSE error: ${res.status} ${res.statusText}`)
      // On quota exceeded, fall back to Indeed RSS instead of returning empty
      if (res.status === 429) return indeedRssSearch(query)
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

// Indeed RSS fallback — completely free, no API key needed
// Strips site: operators from the query since RSS uses keyword search
async function indeedRssSearch(query: string): Promise<SearchResult[]> {
  try {
    // Remove site: operators — Indeed RSS uses keywords only
    const keywords = query.replace(/site:\S+/g, '').replace(/OR/g, '').replace(/\s+/g, ' ').trim()
    const url = `https://www.indeed.com/rss?q=${encodeURIComponent(keywords)}&l=Remote&sort=date&limit=25`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    })
    if (!res.ok) return []
    const xml = await res.text()
    const items: SearchResult[] = []
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
    for (const match of itemMatches) {
      const block = match[1]
      const title = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ?? block.match(/<title>(.*?)<\/title>/)?.[1] ?? ''
      const link = block.match(/<link>(.*?)<\/link>/)?.[1] ?? ''
      const desc = block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]?.replace(/<[^>]+>/g, ' ').trim() ?? ''
      if (title && link) items.push({ title, url: link, description: desc.slice(0, 300) })
    }
    return items
  } catch (err) {
    console.error('Indeed RSS error:', err)
    return []
  }
}

// Score a job using keyword matching — no API calls, no credit usage.
// Base score starts at 65 because results come from targeted site: queries
// that already filtered by relevance through Serper/Google — not random listings.
function scoreJob(title: string, _company: string, description: string, category: Category): { score: number; notes: string } {
  const text = (title + ' ' + description).toLowerCase()
  const titleLower = title.toLowerCase()
  let score = 65  // Base: already passed targeted site: query filter
  const matched: string[] = []

  if (category === 'govcon' || category === 'compliance') {
    // Strong title matches — core roles
    const coreRoles = ['proposal manager', 'capture manager', 'proposal director', 'director of proposals',
      'director of capture', 'proposal writer', 'bid manager', 'proposal coordinator', 'proposal specialist',
      'contracts manager', 'contract specialist', 'contracts administrator', 'subcontracts manager',
      'director of contracts', 'senior contracts manager', 'procurement manager', 'procurement engineer',
      'business development manager', 'director of business development', 'growth director',
      'program manager', 'federal program manager', 'senior program manager',
      'compliance manager', 'grants manager', 'pricing analyst', 'fedramp', 'cmmc', 'grc']
    for (const role of coreRoles) {
      if (text.includes(role)) { score += 15; matched.push(role); break }
    }
    // Senior/director level bonus
    if (/senior|director|vp |vice president|head of|chief|principal|lead /.test(text)) { score += 8; matched.push('senior level') }
    // Federal/defense domain bonus
    if (/federal|dod|defense|government contract|military|civilian agency|public sector/.test(text)) { score += 8; matched.push('federal') }
    // Remote confirmation bonus
    if (/remote|work from home/.test(text)) { score += 5; matched.push('remote') }
    // Exact skill matches
    if (/shipley|idiq|gwac|ota|far|dfars|capture|proposal|sam\.gov/.test(text)) { score += 5; matched.push('govcon skills') }
    // Negative signals — only hard disqualifiers
    if (/engineer|software developer|devops|data scientist|machine learning|ml engineer|applied ai|artificial intelligence engineer/.test(titleLower) &&
        !/procurement engineer|systems engineer|proposal engineer/.test(titleLower)) { score -= 40 }
  } else if (category === 'temp') {
    // Temp jobs — anything from a staffing agency site is likely relevant
    if (/proposal|capture|business development|program manager|contracts|coordinator|operations/.test(text)) { score += 10; matched.push('temp role match') }
  } else if (category === 'sales') {
    if (/sales|account executive|business development|revenue|quota/.test(text)) { score += 20; matched.push('sales role') }
    if (/saas|software|technology|cloud/.test(text)) { score += 10; matched.push('tech sales') }
    if (/remote/.test(text)) { score += 5 }
  }

  score = Math.min(99, Math.max(0, score))
  return { score, notes: matched.length ? matched.join(', ') : 'keyword match' }
}

async function processQuery(
  query: string,
  category: Category,
  db: ReturnType<typeof supabaseAdmin>
): Promise<{ found: number; saved: number; skipped: number }> {
  let found = 0, saved = 0, skipped = 0
  try {
    // query already contains the site: operator from runDiscovery()
    // Use Serper for all categories — it respects site: operators correctly
    const results = await serperSearch(query)
    found = results.length

    for (const result of results) {
      if (!result.url || !result.title) { skipped++; continue }

      // Skip job board index/search pages — only individual job postings
      if (
        result.url.match(/linkedin\.com\/jobs\/(remote|search|collections|government|federal|proposal|capture|contract)/) ||
        result.url.match(/usajobs\.gov\/(Search|search)/) ||
        result.url.includes('/jobs-list') ||
        // Workday search/listing pages (individual jobs use /job/ not /jobs?)
        (result.url.includes('myworkdayjobs.com') && result.url.includes('/jobs?')) ||
        // Dice listing pages (individual jobs use /job-detail/UUID)
        (result.url.includes('dice.com') && !result.url.includes('/job-detail/'))
      ) { skipped++; continue }

      // Skip if URL already seen (any status except rejected)
      const { data: existingUrl } = await db.from('discovered_jobs').select('id, status').eq('url', result.url).maybeSingle()
      if (existingUrl && existingUrl.status !== 'rejected') { skipped++; continue }

      // Parse title and company directly from the Serper result — no AI calls.
      // We trust Serper results because they came from targeted site: queries.
      const remoteHint = looksRemote(result.title, result.description, result.url)
      const titleClean = result.title.replace(/\s*[\|–—]\s*.*/g, '').trim() || result.title
      const info = { isJob: true, title: titleClean, company: 'See listing', isRemote: remoteHint ?? true, isCommissionOnly: false, salaryRaw: '' }

      // Skip if same title + company already in db (any non-rejected status)
      const { data: existingJob } = await db.from('discovered_jobs').select('id, status')
        .ilike('title', info.title).ilike('company', info.company).maybeSingle()
      if (existingJob && existingJob.status !== 'rejected') { skipped++; continue }

      const { score, notes } = scoreJob(info.title, info.company, result.description, category)
      // Results came from targeted site: queries so the bar is lower —
      // the query itself already filtered for relevance. Negative signals
      // (wrong role type) still drop the score below threshold.
      const minScore = category === 'temp' ? 55 : 60
      if (score < minScore) { skipped++; continue }

      await db.from('discovered_jobs').insert({
        title: info.title || result.title,
        company: info.company || 'Unknown',
        url: result.url,
        description: result.description,
        category,
        is_remote: info.isRemote ?? false,
        salary_raw: info.salaryRaw || null,
        is_commission_only: false,
        fit_score: score,
        fit_notes: notes,
        status: 'pending_review',
      })
      saved++
    }
  } catch (err) {
    console.error(`Discovery error for query "${query}":`, err)
  }
  return { found, saved, skipped }
}

// Fast heuristic remote check — runs before Haiku to catch obvious cases
function looksRemote(title: string, description: string, url: string): boolean | null {
  const text = (title + ' ' + description + ' ' + url).toLowerCase()
  const remoteSignals = ['remote', 'work from home', 'wfh', 'fully distributed', 'anywhere in the us', 'anywhere in us']
  const onsiteSignals = ['on-site only', 'onsite only', 'must be local', 'no remote', 'in-office required', 'on site required']
  if (onsiteSignals.some(s => text.includes(s))) return false
  if (remoteSignals.some(s => text.includes(s))) return true
  return null // unknown — let Haiku decide
}

// Detect individual job posting URLs by pattern — these are always single jobs.
// Any URL that matches means we skip the Haiku call and trust it's a real posting.
function isIndividualJobUrl(url: string): boolean {
  return !!(
    url.match(/greenhouse\.io\/[^/]+\/jobs\/\d+/) ||
    url.match(/myworkdayjobs\.com\/.*\/job\//) ||
    url.match(/myworkdayjobs\.com\/.*\/jobs\/\d/) ||   // some Workday use /jobs/<id>
    url.match(/jobs\.lever\.co\/[^/]+\/[a-f0-9-]{36}/) ||
    url.match(/jobs\.smartrecruiters\.com\/[^/]+\/\d+/) ||
    url.match(/icims\.com\/jobs\/\d+/) ||
    url.match(/ashbyhq\.com\/[^/]+\/\d+/) ||
    url.match(/usajobs\.gov\/job\/\d+/) ||
    url.match(/linkedin\.com\/jobs\/view\//) ||
    url.match(/indeed\.com\/viewjob\?jk=/) ||
    url.match(/dice\.com\/job-detail\/[a-f0-9-]{8,}/) ||   // Dice UUID job IDs
    url.match(/adeccousa\.com\/jobs?\/[^/?#]{5,}/) ||      // Adecco individual jobs
    url.match(/roberthalf\.com\/us\/en\/job\//) ||          // Robert Half
    url.match(/staffmark\.com\/jobs?\/[^/?#]{5,}/) ||      // Staffmark
    url.match(/kellyservices\.com\/jobs?\/[^/?#]{5,}/) ||  // Kelly
    url.match(/manpowergroup\.com\/jobs?\/[^/?#]{5,}/) ||  // Manpower
    url.match(/aerotek\.com\/en\/job-detail\//) ||         // Aerotek
    url.match(/spherion\.com\/jobs?\/[^/?#]{5,}/) ||       // Spherion
    url.match(/randstadusa\.com\/jobs?\/[^/?#]{5,}/)       // Randstad
  )
}

async function extractJobInfo(result: SearchResult): Promise<{
  isJob: boolean; title: string; company: string; isRemote: boolean; isCommissionOnly: boolean; salaryRaw: string
} | null> {
  const remoteHint = looksRemote(result.title, result.description, result.url)
  const knownJobUrl = isIndividualJobUrl(result.url)

  // Known individual job URL — force isJob=true, parse without Haiku where possible
  if (knownJobUrl) {
    // LinkedIn: title and company are in the URL slug
    // e.g. /jobs/view/proposal-manager-at-company-name-1234567
    const liMatch = result.url.match(/linkedin\.com\/jobs\/view\/(.+)-(\d+)$/)
    if (liMatch) {
      const slug = liMatch[1]
      const atIdx = slug.lastIndexOf('-at-')
      if (atIdx !== -1) {
        const titleSlug = slug.slice(0, atIdx).replace(/-/g, ' ')
        const companySlug = slug.slice(atIdx + 4).replace(/-/g, ' ')
        const title = titleSlug.replace(/\b\w/g, c => c.toUpperCase())
        const company = companySlug.replace(/\b\w/g, c => c.toUpperCase())
        return { isJob: true, title, company, isRemote: remoteHint ?? true, isCommissionOnly: false, salaryRaw: '' }
      }
    }
    // For all other known URLs use result.title and snippet — no Haiku call
    const genericTitles = /^(jobs at |careers|careers at |job application for |explore our open positions)/i
    const title = genericTitles.test(result.title)
      ? result.description.slice(0, 80).split(/[|\-–]/)[0].trim() || result.title
      : result.title
    const company = result.title.replace(/jobs at |careers at /i, '').split(/[|\-–]/)[0].trim()
    return { isJob: true, title, company, isRemote: remoteHint ?? true, isCommissionOnly: false, salaryRaw: '' }
  }

  // Unknown URL pattern — parse title and description directly, no Anthropic call
  // Skip if it looks like a job board index or search results page
  const isJobBoardIndex = /\b(jobs|careers|search results|job listings|open positions)\b/i.test(result.title) &&
    !/[A-Z][a-z]+ (Manager|Specialist|Director|Analyst|Coordinator|Engineer|Consultant|Associate|Lead|Advisor|Officer|Administrator)/i.test(result.title)
  if (isJobBoardIndex) return null
  const titleClean = result.title.replace(/\s*[\|–—]\s*.*/g, '').trim() || result.title
  const companyClean = result.title.includes('|') ? result.title.split('|').slice(-1)[0].trim() :
    result.title.includes(' at ') ? result.title.split(' at ').slice(-1)[0].trim() : 'See listing'
  return { isJob: true, title: titleClean, company: companyClean, isRemote: remoteHint ?? true, isCommissionOnly: false, salaryRaw: '' }
}

// Process temp agency scraper results directly — no Serper, no site: operators
async function processTempResults(
  results: SearchResult[],
  db: ReturnType<typeof supabaseAdmin>
): Promise<{ found: number; saved: number; skipped: number }> {
  let found = results.length, saved = 0, skipped = 0
  for (const result of results) {
    if (!result.url || !result.title) { skipped++; continue }
    // Skip obvious non-job pages
    if (result.url.includes('/jobs-and-careers/?') || result.url.includes('/search?') || result.url.includes('/hire-talent/')) { skipped++; continue }
    // Skip if already in DB
    const { data: existing } = await db.from('discovered_jobs').select('id, status').eq('url', result.url).maybeSingle()
    if (existing && existing.status !== 'rejected') { skipped++; continue }
    // Parse title and company from result (title often contains agency suffix)
    const rawTitle = result.title.replace(/\s*[—–-]+\s*(Adecco|Robert Half|Staffmark|Kelly|Manpower|Aerotek|Spherion|Randstad)[^]*/i, '').trim()
    const title = rawTitle || result.title
    // Score — temp roles start high since they came from targeted agency scrapers
    const { score, notes } = scoreJob(title, '', result.description, 'temp')
    if (score < 55) { skipped++; continue }
    // Skip if same title already in DB
    const { data: existingJob } = await db.from('discovered_jobs').select('id, status')
      .ilike('title', title).maybeSingle()
    if (existingJob && existingJob.status !== 'rejected') { skipped++; continue }
    await db.from('discovered_jobs').insert({
      title,
      company: 'See listing',
      url: result.url,
      description: result.description,
      category: 'temp',
      is_remote: true,
      salary_raw: null,
      is_commission_only: false,
      fit_score: score,
      fit_notes: notes || 'temp agency scrape',
      status: 'pending_review',
    })
    saved++
  }
  return { found, saved, skipped }
}

export async function runDiscovery(
  platforms: PlatformKey[] = ALL_PLATFORMS,
  tempAgencies: TempAgencyKey[] = ALL_TEMP_AGENCIES,
): Promise<{ found: number; saved: number; skipped: number }> {
  const db = supabaseAdmin()
  const today = new Date().toISOString().split('T')[0]

  // Build keyword x platform matrix for govcon and compliance
  // Each query becomes: "<keyword> <site:platform>" — Serper respects site: operators
  const serperQueries: { query: string; category: Category }[] = []
  const selectedPlatforms = platforms.length > 0 ? platforms : ALL_PLATFORMS
  const selectedAgencies = tempAgencies.length > 0 ? tempAgencies : ALL_TEMP_AGENCIES

  for (const keyword of baseQueries.govcon) {
    for (const pk of selectedPlatforms) {
      serperQueries.push({ query: `${keyword} ${PLATFORMS[pk].site}`, category: 'govcon' })
    }
  }
  for (const keyword of baseQueries.compliance) {
    for (const pk of selectedPlatforms) {
      serperQueries.push({ query: `${keyword} ${PLATFORMS[pk].site}`, category: 'compliance' })
    }
  }

  // Run ATS platform searches (Serper) in parallel batches of 5
  const BATCH = 5
  let totalFound = 0, totalSaved = 0, totalSkipped = 0

  for (let i = 0; i < serperQueries.length; i += BATCH) {
    const batch = serperQueries.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(({ query, category }) => processQuery(query, category, db)))
    for (const r of results) {
      totalFound += r.found
      totalSaved += r.saved
      totalSkipped += r.skipped
    }
    if (i + BATCH < serperQueries.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  // Temp agencies: use direct HTTP scrapers — staffing agency job pages are not
  // indexed reliably by Google so site: searches return garbage.
  // Run one keyword x one agency at a time to avoid overwhelming small sites.
  for (const keyword of baseQueries.temp) {
    for (const ak of selectedAgencies) {
      try {
        const results = await tempAgencySearch(ak, keyword)
        const r = await processTempResults(results, db)
        totalFound += r.found
        totalSaved += r.saved
        totalSkipped += r.skipped
      } catch (err) {
        console.error(`Temp agency search error [${ak}/${keyword}]:`, err)
      }
      // Polite delay between agency requests
      await new Promise(resolve => setTimeout(resolve, 600))
    }
  }

  if (totalSaved > 0) {
    await db.rpc('increment_discovered', { p_date: today, p_count: totalSaved })
  }

  return { found: totalFound, saved: totalSaved, skipped: totalSkipped }
}
