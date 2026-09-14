export type RoleCategory =
  | 'proposal_writer'
  | 'capture_manager'
  | 'compliance_manager'
  | 'contracts_administrator'
  | 'business_development'
  | 'govcon_other'
  | 'general_remote'

export type JobStatus = 'new' | 'reviewed' | 'rejected' | 'applied'

export type ApplicationStatus = 'New' | 'Applied' | 'Interview' | 'Offer' | 'Rejected'

export interface DiscoveredJob {
  id: string
  title: string
  company: string
  url: string
  description: string | null
  is_remote: boolean | null
  salary_min: number | null
  salary_max: number | null
  salary_raw: string | null
  role_category: RoleCategory
  is_entry_level: boolean
  industry_tags: string[]
  source_platform: string | null
  fit_score: number
  fit_notes: string | null
  status: JobStatus
  discovered_at: string
  reviewed_at: string | null
  applied_at: string | null
}

export interface Application {
  id: string
  job_id: string
  resume_text: string | null
  status: ApplicationStatus
  applied_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  job?: DiscoveredJob
}
