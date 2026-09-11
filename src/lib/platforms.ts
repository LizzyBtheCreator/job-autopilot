// Platform definitions — each has a site: operator and a display label.
// Kept separate from discovery.ts so client components can import these
// constants without pulling in server-only code (Anthropic/Supabase clients).
//
// ZipRecruiter, Indeed, and LinkedIn are excluded. Their URLs are unstable,
// frequently redirect to different jobs than what was indexed, or have blocked
// scraping — causing mismatches and wasted searches.
// ATS platforms (Greenhouse, Workday, iCIMS, Ashby, Lever, SmartRecruiters)
// use permanent per-job URLs and are far more reliable.
export const PLATFORMS = {
  greenhouse: { site: 'site:greenhouse.io',               label: 'Greenhouse' },
  workday:    { site: 'site:myworkdayjobs.com',           label: 'Workday' },
  icims:      { site: 'site:icims.com',                   label: 'iCIMS' },
  ashby:      { site: 'site:ashbyhq.com',                 label: 'Ashby' },
  lever:      { site: 'site:jobs.lever.co',               label: 'Lever' },
  smartr:     { site: 'site:jobs.smartrecruiters.com',    label: 'SmartRecruiters' },
  usajobs:    { site: 'site:usajobs.gov/job',             label: 'USAJobs' },
} as const
// Dice removed — tech-focused board, returns too many irrelevant developer/architect roles

export type PlatformKey = keyof typeof PLATFORMS
export const ALL_PLATFORMS = Object.keys(PLATFORMS) as PlatformKey[]

// Temp / staffing agency sites — searched for the temp category
// using Serper site: operators (same system as ATS platforms above).
export const TEMP_AGENCIES = {
  adecco:     { site: 'site:adeccousa.com',           label: 'Adecco' },
  roberthalf: { site: 'site:roberthalf.com',           label: 'Robert Half' },
  staffmark:  { site: 'site:staffmark.com',            label: 'Staffmark' },
  kelly:      { site: 'site:kellyservices.com',        label: 'Kelly Services' },
  manpower:   { site: 'site:manpowergroup.com',        label: 'Manpower' },
  aerotek:    { site: 'site:aerotek.com',              label: 'Aerotek' },
  spherion:   { site: 'site:spherion.com',             label: 'Spherion' },
  randstad:   { site: 'site:randstadusa.com',          label: 'Randstad' },
} as const

export type TempAgencyKey = keyof typeof TEMP_AGENCIES
export const ALL_TEMP_AGENCIES = Object.keys(TEMP_AGENCIES) as TempAgencyKey[]
