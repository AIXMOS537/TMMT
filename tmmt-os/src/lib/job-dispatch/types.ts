import type { CaseType, WorkType } from "@/lib/routing/types";
import type { RequestType } from "@/lib/workflow/statuses";

export const DISPATCH_WORK_TYPES = [
  "dispatch_pickup",
  "dispatch_delivery",
  "dispatch_full",
] as const;

export type DispatchWorkType = (typeof DISPATCH_WORK_TYPES)[number];

export type StaffDispatchJobInput = {
  /** Local vendor company outsourcing work to TMMT */
  vendor_company: string;
  vendor_contact_name?: string;
  vendor_contact_email?: string;
  vendor_contact_phone?: string;
  /** TMMT network vendor to assign immediately (optional) */
  assign_vendor_id?: string;
  work_type: DispatchWorkType;
  request_type?: RequestType;
  business_line?: string;
  subject: string;
  details?: string;
  pickup?: string;
  dropoff?: string;
  window_start?: string;
  window_end?: string;
  offered_price?: number;
  due_at?: string;
  /** Restrict delivery to specific partner apps; otherwise auto-routed */
  target_partner_apps?: string[];
  /** Staff actor id when available */
  actor_id?: string | null;
};

export type ProtocolStepResult = {
  step: string;
  ok: boolean;
  detail?: string;
  data?: Record<string, unknown>;
};

export type DispatchJobResult = {
  caseId: string;
  refCode: string;
  vendorJobId?: string;
  protocolRunId: string;
  workType: WorkType;
  caseType: CaseType;
  deliveries: Array<{
    partner_app_slug: string;
    status: string;
    delivery_id: string;
  }>;
  routing?: Record<string, unknown>;
};

export type PartnerAppEndpoint = {
  id: string;
  partner_app_slug: string;
  webhook_url: string;
  webhook_secret: string | null;
  work_types: string[];
  case_types: string[];
  active: boolean;
};

export type JobInboxItem = {
  delivery_id: string;
  case_id: string;
  ref_code: string;
  vendor_job_id: string | null;
  work_type: string | null;
  case_type: string | null;
  subject: string;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
};
