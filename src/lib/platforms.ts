// Platform definitions — each has a site: operator and a display label.
// Kept separate from discovery.ts so client components can import these
// constants without pulling in server-only code (Anthropic/Supabase clients).
//
// ZipRecruiter, Indeed, and LinkedIn are excluded. Their URLs are unstable,
// frequently redirect to different jobs than what was indexed, or have blocked
// scraping — causing mismatches and wasted searches.
// ATS platforms (Greenhouse, Workday, iCIMS, Ashby, Lever, SmartRecruiters,
// USAJobs) use permanent per-job URLs and are far more reliable.
export const PLATFORMS = {
  greenhouse: { site: 'site:greenhouse.io',            label: 'Greenhouse' },
  workday:    { site: 'site:myworkdayjobs.com',        label: 'Workday' },
  icims:      { site: 'site:icims.com',                label: 'iCIMS' },
  ashby:      { site: 'site:ashbyhq.com',               label: 'Ashby' },
  lever:      { site: 'site:jobs.lever.co',            label: 'Lever' },
  smartr:     { site: 'site:jobs.smartrecruiters.com', label: 'SmartRecruiters' },
  usajobs:    { site: 'site:usajobs.gov/job',           label: 'USAJobs' },
} as const

export type PlatformKey = keyof typeof PLATFORMS
export const ALL_PLATFORMS = Object.keys(PLATFORMS) as PlatformKey[]
