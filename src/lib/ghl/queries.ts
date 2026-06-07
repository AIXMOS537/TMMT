import { createServiceRoleClient } from "@/lib/supabase-service";

export type GhlContactRow = {
  id: string;
  ghl_contact_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  tags: string[] | null;
  synced_at: string;
  updated_at: string;
};

export type GhlFormRow = {
  id: string;
  ghl_submission_id: string | null;
  ghl_contact_id: string | null;
  form_id: string | null;
  form_name: string | null;
  fields: Record<string, unknown>;
  case_id: string | null;
  intake_id: string | null;
  created_at: string;
};

export type GhlAppointmentRow = {
  id: string;
  ghl_appointment_id: string;
  ghl_contact_id: string | null;
  title: string | null;
  status: string | null;
  starts_at: string | null;
  ends_at: string | null;
  synced_at: string;
};

export type GhlSyncEventRow = {
  id: string;
  event_type: string;
  external_id: string | null;
  processed: boolean;
  error: string | null;
  created_at: string;
};

export type GhlSyncCounts = {
  contacts: number;
  forms: number;
  appointments: number;
  events24h: number;
};

export async function fetchGhlSyncDashboard() {
  const supabase = createServiceRoleClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [contacts, forms, appointments, events, contactCount, formCount, apptCount, events24h] =
    await Promise.all([
      supabase
        .from("ghl_contacts")
        .select(
          "id, ghl_contact_id, full_name, email, phone, tags, synced_at, updated_at"
        )
        .order("synced_at", { ascending: false })
        .limit(100),
      supabase
        .from("ghl_form_submissions")
        .select(
          "id, ghl_submission_id, ghl_contact_id, form_id, form_name, fields, case_id, intake_id, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("ghl_appointments")
        .select(
          "id, ghl_appointment_id, ghl_contact_id, title, status, starts_at, ends_at, synced_at"
        )
        .order("starts_at", { ascending: false, nullsFirst: false })
        .limit(100),
      supabase
        .from("sync_events")
        .select("id, event_type, external_id, processed, error, created_at")
        .eq("source", "ghl")
        .order("created_at", { ascending: false })
        .limit(80),
      supabase.from("ghl_contacts").select("id", { count: "exact", head: true }),
      supabase.from("ghl_form_submissions").select("id", { count: "exact", head: true }),
      supabase.from("ghl_appointments").select("id", { count: "exact", head: true }),
      supabase
        .from("sync_events")
        .select("id", { count: "exact", head: true })
        .eq("source", "ghl")
        .gte("created_at", since24h),
    ]);

  const error =
    contacts.error?.message ??
    forms.error?.message ??
    appointments.error?.message ??
    events.error?.message;

  return {
    error,
    contacts: (contacts.data ?? []) as GhlContactRow[],
    forms: (forms.data ?? []) as GhlFormRow[],
    appointments: (appointments.data ?? []) as GhlAppointmentRow[],
    events: (events.data ?? []) as GhlSyncEventRow[],
    counts: {
      contacts: contactCount.count ?? 0,
      forms: formCount.count ?? 0,
      appointments: apptCount.count ?? 0,
      events24h: events24h.count ?? 0,
    } satisfies GhlSyncCounts,
  };
}
