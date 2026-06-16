export type CallStatus = "in_progress" | "success" | "failed";

export interface Call {
  id: string;
  phone_number: string;
  caller_name: string | null;
  duration_seconds: number | null;
  status: CallStatus;
  summary: string | null;
  label: string | null;
  notes: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  raw_transcript: string | null;
}

export interface CallCounts {
  in_progress: number;
  success: number;
  failed: number;
}

export interface PaginatedCallsResponse {
  data: Call[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  counts: CallCounts;
}

export interface CallsQueryParams {
  status?: CallStatus;
  page?: number;
  page_size?: number;
  // Task 2: advanced filters
  caller_name?: string;
  phone_number?: string;
  label?: string;
  min_duration?: number;
  max_duration?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}
