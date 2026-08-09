export type SubscriptionStatus =
  | "draft"
  | "pending_payment"
  | "rejected"
  | "active"
  | "paused"
  | "expiring_soon"
  | "expired";

export type Column = "lineup" | "ongoing" | "for_approval" | "done";

export type InternalStatus =
  | "in_progress"
  | "blocked_assets"
  | "awaiting_partner"
  | "qa";

export type PaymentStatus = "pending" | "approved" | "rejected";

export type UserRole = "client" | "admin";

export interface AccountRow {
  id: number;
  business_name: string;
  contact_name: string;
  email: string;
  mobile: string;
  viber: string;
  industry: string | null;
  city: string | null;
  drive_folder_id: string | null;
  created_at: string;
}

export interface UserRow {
  id: number;
  account_id: number;
  email: string;
  password_hash: string;
  role: UserRole;
  email_verified: number;
  created_at: string;
}

export interface PlanRow {
  id: number;
  name: string;
  price_php: number;
  active_slots: number;
  includes_video: number;
  consult_hours: number;
  shoot_hours: number;
  includes_ads: number;
  priority_queue: number;
  featured: number;
  tagline: string;
  description: string;
  sort_order: number;
}

export interface AddonRow {
  id: number;
  name: string;
  price_php: number;
  bundled_price_php: number;
  requires_plan: number;
  allowed_plans: string;
  description: string;
}

export interface SubscriptionRow {
  id: number;
  account_id: number;
  plan_id: number | null;
  next_plan_id: number | null;
  status: SubscriptionStatus;
  days_remaining: number;
  last_ticked_on: string | null;
  started_at: string;
  paused_at: string | null;
  expired_at: string | null;
  grace_until: string | null;
  created_at: string;
}

export interface SubscriptionAddonRow {
  id: number;
  subscription_id: number;
  addon_id: number;
  active: number;
}

export interface PaymentRow {
  id: number;
  account_id: number;
  subscription_id: number | null;
  amount_php: number;
  method: string;
  reference_no: string | null;
  proof_url: string | null;
  status: PaymentStatus;
  verified_by: number | null;
  verified_at: string | null;
  rejection_reason: string | null;
  days_granted: number;
  created_at: string;
}

export interface RequestTypeRow {
  id: number;
  slug: string;
  name: string;
  slot_consuming: number;
  brief_schema: string;
  sla_hours: number;
  available_rules: string;
  sort_order: number;
}

export interface RequestRow {
  id: number;
  account_id: number | null;
  request_type_id: number;
  title: string;
  brief_answers: string;
  column: Column;
  internal_status: InternalStatus | null;
  position: number;
  phase_id: number | null;
  revision_count: number;
  due_at: string | null;
  target_completed_at: string | null;
  other_client_name: string | null;
  other_client_email: string | null;
  other_client_mobile: string | null;
  other_client_viber: string | null;
  approval_since: string | null;
  last_approval_reminder_at: string | null;
  auto_approved: number;
  created_at: string;
  updated_at: string;
}

export interface PhaseRow {
  id: number;
  account_id: number;
  name: string;
  position: number;
  created_at: string;
}

export interface BrandProfileRow {
  id: number;
  account_id: number;
  logo_urls: string;
  colors: string;
  fonts: string;
  tone: string;
  links: string;
  avoid_notes: string;
  updated_at: string;
}

export interface EntitlementLogRow {
  id: number;
  account_id: number;
  kind: string;
  amount: number;
  note: string;
  logged_at: string;
  billing_month: string;
}

export interface AdsUpdateRow {
  id: number;
  subscription_id: number;
  month: string;
  summary: string;
  notes: string;
  created_at: string;
}

export interface BriefField {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "select" | "date" | "number" | "links" | "file";
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export interface AvailableRules {
  requires_video?: boolean;
  requires_ads?: boolean;
  requires_consult?: boolean;
  requires_shoot?: boolean;
  requires_addon?: string;
  standalone_only?: boolean;
}

export interface SessionUser {
  user_id: number;
  account_id: number;
  email: string;
  role: UserRole;
}

export interface SessionBundle extends SessionUser {
  account: AccountRow | null;
  subscription: (SubscriptionRow & { plan: PlanRow | null }) | null;
}
