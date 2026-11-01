// Types for the state and local bid search. Kept apart from the job search types.

export type BidStatus = "new" | "bidding" | "submitted" | "won" | "lost" | "dismissed";

export const BID_STATUS_LABELS: Record<BidStatus, string> = {
  new: "New",
  bidding: "Bidding",
  submitted: "Submitted",
  won: "Won",
  lost: "Lost",
  dismissed: "Dismissed",
};

export interface BidSettings {
  states: string[];
  bid_terms: string;
  recency: "d" | "w" | "m" | "y" | "any";
  results_per_query: number;
}

export interface BidQuery {
  id: string;
  sort_order: number;
  label: string;
  query: string;
  enabled: boolean;
}

export interface Bid {
  id: string;
  url: string;
  title: string;
  agency: string | null;
  state: string | null;
  snippet: string | null;
  query_label: string | null;
  due_date: string | null;
  due_text: string | null;
  flags: string[];
  status: BidStatus;
  contractor_cost: number | null;
  bid_price: number | null;
  notes: string | null;
  first_seen_at: string;
  last_seen_at: string;
  submitted_at: string | null;
}

export interface BidQueryStats {
  label: string;
  query: string;
  returned: number;
  new: number;
  seen_before: number;
  dropped: number;
  error: string | null;
  note: string | null;
}

export interface BidDropped {
  query_label: string;
  title: string;
  url: string;
  reason: string;
}

export interface BidRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  total_returned: number;
  total_new: number;
  total_seen_before: number;
  total_dropped: number;
  per_query: BidQueryStats[];
  dropped: BidDropped[];
  error: string | null;
}
