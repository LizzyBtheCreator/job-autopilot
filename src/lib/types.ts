export type Category =
  | "proposals"
  | "contracts"
  | "compliance"
  | "grants"
  | "program_ops"
  | "business_dev"
  | "consulting"
  | "public_sector"
  | "dei_hr";

export const CATEGORY_LABELS: Record<Category, string> = {
  proposals: "Proposals & Capture",
  contracts: "Contracts & Procurement",
  compliance: "Compliance",
  grants: "Grants",
  program_ops: "Program Management",
  business_dev: "Business Development",
  consulting: "Consulting",
  public_sector: "Government / Public Sector",
  dei_hr: "DEI / HR Compliance",
};

export type JobStatus = "new" | "generating" | "needs_review" | "ready" | "applied" | "dismissed" | "error";

export const STATUS_LABELS: Record<JobStatus, string> = {
  new: "New",
  generating: "Generating",
  needs_review: "Needs review",
  ready: "Ready to apply",
  applied: "Applied",
  dismissed: "Dismissed",
  error: "Error",
};

export interface Settings {
  review_required: boolean;
  min_salary: number;
  recency: "d" | "w" | "m" | "y" | "any";
  results_per_query: number;
}

export interface SearchQuery {
  id: string;
  sort_order: number;
  label: string;
  category: Category;
  query: string;
  enabled: boolean;
}

export interface Job {
  id: string;
  url: string;
  title: string;
  company: string | null;
  snippet: string | null;
  category: Category;
  query_label: string | null;
  salary_text: string | null;
  salary_min: number | null;
  salary_max: number | null;
  status: JobStatus;
  flags: string[];
  description: string | null;
  requirements: Requirements | null;
  resume: string | null;
  error: string | null;
  first_seen_at: string;
  last_seen_at: string;
  generated_at: string | null;
  applied_at: string | null;
}

export interface Requirements {
  company_name: string;
  keywords: string[];
  required_qualifications: string[];
  responsibilities: string[];
  tools_and_systems: string[];
  agencies_and_domains: string[];
  methodologies: string[];
  salary_text: string;
  work_location: "remote" | "hybrid" | "onsite" | "unclear";
  requires_active_clearance: boolean;
  is_state_or_local_government: boolean;
}

export interface QueryStats {
  label: string;
  query: string;
  returned: number;
  new: number;
  seen_before: number;
  dropped: number;
  error: string | null;
}

export interface DroppedResult {
  query_label: string;
  title: string;
  url: string;
  reason: string;
}

export interface SearchRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  total_returned: number;
  total_new: number;
  total_seen_before: number;
  total_dropped: number;
  per_query: QueryStats[];
  dropped: DroppedResult[];
  error: string | null;
}
