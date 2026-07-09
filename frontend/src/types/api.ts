/** Mirrors backend/app/schemas (source of truth: /openapi.json). */

export interface UserOut {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  credit_balance: number;
  created_at: string;
  last_login_at: string;
  dreams_count: number;
}

export interface BalanceOut {
  balance: number;
  held: number;
  videos_remaining: number;
  credits_per_video: number;
}

export interface LedgerEntryOut {
  id: number;
  delta: number;
  reason: "signup_bonus" | "generation" | "generation_refund" | "purchase";
  reference_type: string | null;
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}

export interface LedgerPageOut {
  items: LedgerEntryOut[];
  next_cursor: number | null;
}

export interface SegmentState {
  beat_no: number;
  status: "pending" | "running" | "completed";
  duration_seconds: number;
  is_title_card: boolean;
  detail: string;
}

export interface JobOut {
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  message: string;
  segments: SegmentState[];
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export type DreamStatus =
  | "queued"
  | "scripting"
  | "prompting"
  | "rendering"
  | "stitching"
  | "completed"
  | "failed";

export const ACTIVE_DREAM_STATUSES: DreamStatus[] = [
  "queued",
  "scripting",
  "prompting",
  "rendering",
  "stitching",
];

export interface DreamOut {
  id: string;
  title: string;
  prompt: string;
  status: DreamStatus;
  error: string | null;
  credits_charged: number;
  duration_secs: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  job: JobOut | null;
  video_url: string | null;
  thumbnail_url: string | null;
}

export interface DreamListItem {
  id: string;
  title: string;
  status: DreamStatus;
  created_at: string;
  thumbnail_url: string | null;
}

export interface DreamPageOut {
  items: DreamListItem[];
  next_cursor: number | null;
}

export interface CheckoutOut {
  payment_id: string;
  checkout_url: string;
}

export interface PaymentOut {
  id: string;
  amount_usd: number;
  credits: number;
  status: "pending" | "succeeded" | "failed" | "expired";
  created_at: string;
  fulfilled_at: string | null;
}

export interface ConfigOut {
  mock: boolean;
  payments_mock: boolean;
  signup_bonus_credits: number;
  credit_cost_per_video: number;
  usd_per_credit: number;
  min_purchase_usd: number;
  prompt_min_len: number;
  prompt_max_len: number;
  video: {
    n_segments: number;
    approx_duration_secs: number;
    resolution: string;
    aspect_ratio: string;
  };
}

export type SseEvent =
  | { type: "snapshot"; status: DreamStatus; progress: number; message: string; segments: SegmentState[]; error: string | null; video_url: string | null }
  | { type: "stage"; stage: string; progress: number; message: string }
  | { type: "segment"; beat_no: number; status: string; detail: string; progress: number; message: string }
  | { type: "status"; status: "completed" | "failed"; progress?: number; video_url?: string; error?: string }
  | { type: "close" };
