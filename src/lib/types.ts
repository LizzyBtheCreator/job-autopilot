export type Category = 'sales' | 'govcon' | 'datacenter' | 'quickhire' | 'compliance' | 'temp'

export type JobStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'applying'
  | 'applied'
  | 'archived'

export type ApplicationStatus =
  | 'draft'
  | 'ready'
  | 'filled'
  | 'submitted'
  | 'rejected'
  | 'interviewing'
  | 'offer'
  | 'closed'
  | 'unavailable'

export interface MasterProfile {
  id: string
  full_name: string
  email: string
  phone: string
  location: string
  cover_letter_tone: string
  salary_min: number
  remote_only: boolean
  no_commission_only: boolean
  daily_target: number
  daily_target_production: number
  is_testing_phase: boolean
  category_floor: number
  category_cap_pct: number
}

export interface ProfileSection {
  id: string
  profile_id: string
  category: Category
  summary: string
  skills: string[]
  keywords: string[]
  target_roles: string[]
}

export interface WorkHistory {
  id: string
  profile_id: string
  company: string
  title: string
  start_date: string
  end_date: string | null
  is_current: boolean
  is_remote: boolean
  location: string | null
  bullets: string[]
  categories: Category[]
  sort_order: number
}

export interface Certification {
  id: string
  profile_id: string
  name: string
  issuer: string | null
  year: string | null
  in_progress: boolean
}

export interface Education {
  id: string
  profile_id: string
  institution: string
  degree: string | null
  field: string | null
  year: string | null
  in_progress: boolean
}

export interface DiscoveredJob {
  id: string
  title: string
  company: string
  url: string
  description: string | null
  category: Category | null
  role_type: string | null
  is_remote: boolean | null
  salary_min: number | null
  salary_max: number | null
  salary_raw: string | null
  is_commission_only: boolean
  fit_score: number
  fit_notes: string | null
  status: JobStatus
  application_form_type: string | null
  discovered_at: string
  reviewed_at: string | null
  applied_at: string | null
}

export interface Application {
  id: string
  job_id: string
  resume_text: string | null
  cover_letter: string | null
  fractional_brochure: string | null
  status: ApplicationStatus
  form_filled_at: string | null
  submitted_at: string | null
  interview_date: string | null
  thank_you_sent_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  job?: DiscoveredJob
}

export interface DailyStats {
  id: string
  date: string
  discovered: number
  approved: number
  rejected: number
  applied: number
  sales_applied: number
  govcon_applied: number
  datacenter_applied: number
  target: number
}
