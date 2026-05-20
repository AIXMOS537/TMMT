import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logSyncEvent, markSyncEventProcessed } from "@/lib/ghl/sync-event";
import { normalizeGhlEvent, pickContactFields, pickContactId } from "@/lib/ghl/payload";
import { upsertGhlContact } from "@/lib/ghl/handlers/opportunity-stage";

const Body = z.object({
  event: z.string().optional(),
  appointment_id: z.string().optional(),
  contact_id: z.string().optional(),
  title: z.string().optional(),
  status: z.string().optional(),
  calendar_id: z.string().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  timezone: z.string().optional(),
  contact: z.record(z.any()).optional(),
});

function pickAppointmentId(raw: Record<string, unknown>): string | undefined {
  const id = raw.appointment_id ?? raw.appointmentId;
  if (typeof id === "string" && id.length > 0) return id;
  const event = normalizeGhlEvent(raw);
  if (event.includes("appointment") && typeof raw.id === "string") {
    return raw.id;
  }
  return undefined;
}

function parseTime(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function handleAppointment(
  supabase: SupabaseClient,
  raw: Record<string, unknown>
) {
  const appointmentId = pickAppointmentId(raw);
  if (!appointmentId) {
    return { status: 400 as const, body: { error: "appointment_id required" } };
  }

  const contactId = pickContactId(raw);
  const parsed = Body.safeParse({
    ...raw,
    appointment_id: appointmentId,
    contact_id: contactId,
    starts_at: (raw.starts_at ?? raw.startTime ?? raw.start_time) as string | undefined,
    ends_at: (raw.ends_at ?? raw.endTime ?? raw.end_time) as string | undefined,
  });

  if (!parsed.success) {
    return { status: 400 as const, body: { error: parsed.error.flatten() } };
  }

  const contactFields = pickContactFields(raw);
  const eventType = normalizeGhlEvent(raw) || "appointment.booked";

  const eventId = await logSyncEvent(supabase, {
    event_type: eventType,
    external_id: appointmentId,
    payload: raw,
  });

  if (contactId) {
    await upsertGhlContact(supabase, {
      ghl_contact_id: contactId,
      full_name: contactFields.name,
      email: contactFields.email,
      phone: contactFields.phone,
      raw_payload: raw,
    });
  }

  const { data: row, error } = await supabase
    .from("ghl_appointments")
    .upsert(
      {
        ghl_appointment_id: appointmentId,
        ghl_contact_id: contactId ?? null,
        title: parsed.data.title ?? (raw.title as string | undefined) ?? null,
        status: parsed.data.status ?? (raw.status as string | undefined) ?? null,
        calendar_id:
          parsed.data.calendar_id ?? (raw.calendar_id as string | undefined) ?? null,
        starts_at: parseTime(parsed.data.starts_at ?? raw.starts_at),
        ends_at: parseTime(parsed.data.ends_at ?? raw.ends_at),
        timezone: parsed.data.timezone ?? (raw.timezone as string | undefined) ?? null,
        raw_payload: raw,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "ghl_appointment_id" }
    )
    .select("id, ghl_appointment_id, starts_at")
    .single();

  if (error) {
    return { status: 500 as const, body: { error: error.message } };
  }

  if (eventId) {
    await markSyncEventProcessed(supabase, eventId);
  }

  return {
    status: 200 as const,
    body: {
      ok: true,
      handler: "appointment",
      event: eventType,
      appointment_row_id: row.id,
      ghl_appointment_id: row.ghl_appointment_id,
      starts_at: row.starts_at,
    },
  };
}
