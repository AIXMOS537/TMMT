export const CANONICAL_RENTER_STAGES = [
  "inquiry",
  "contacted",
  "qualifying",
  "payment_pending",
  "booked",
  "pickup_scheduled",
  "active_rental",
  "return_due",
  "returned",
  "extended",
  "escalation",
  "closed_won",
  "closed_lost",
] as const;

export type CanonicalRenterStage = (typeof CANONICAL_RENTER_STAGES)[number];

export type GhlStageWebhookBody = {
  event?: string;
  pipeline_id?: string;
  pipeline_name?: string;
  opportunity_id?: string;
  contact_id: string;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  previous_stage?: string;
  stage: string;
  business_line?: string;
  custom_fields?: Record<string, unknown>;
};

export type AirtableVerifyWebhookBody = {
  airtable_record_id: string;
  table?: string;
  verified_by?: string;
};

export type GhlContactWebhookBody = {
  event?: string;
  contact_id: string;
  location_id?: string;
  tags?: string[];
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
};

export type GhlFormWebhookBody = {
  event?: string;
  submission_id?: string;
  form_id?: string;
  form_name?: string;
  contact_id?: string;
  fields?: Record<string, unknown>;
  business_line?: string;
  create_case?: boolean;
};

export type GhlAppointmentWebhookBody = {
  event?: string;
  appointment_id: string;
  contact_id?: string;
  title?: string;
  status?: string;
  starts_at?: string;
  ends_at?: string;
};
