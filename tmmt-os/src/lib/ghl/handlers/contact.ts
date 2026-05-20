import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logSyncEvent, markSyncEventProcessed } from "@/lib/ghl/sync-event";
import { normalizeGhlEvent, pickContactFields, pickContactId } from "@/lib/ghl/payload";
const Body = z.object({
  event: z.string().optional(),
  contact_id: z.string().optional(),
  location_id: z.string().optional(),
  tags: z.array(z.string()).optional(),
  contact: z.record(z.any()).optional(),
});

export async function handleContact(supabase: SupabaseClient, raw: Record<string, unknown>) {
  const contactId = pickContactId(raw);
  if (!contactId) {
    return { status: 400 as const, body: { error: "contact_id required" } };
  }

  const parsed = Body.safeParse({ ...raw, contact_id: contactId });
  if (!parsed.success) {
    return { status: 400 as const, body: { error: parsed.error.flatten() } };
  }

  const fields = pickContactFields(raw);
  const eventType = normalizeGhlEvent(raw) || "contact.upsert";

  const eventId = await logSyncEvent(supabase, {
    event_type: eventType,
    external_id: contactId,
    payload: raw,
  });

  const tags = Array.isArray(raw.tags)
    ? (raw.tags as string[])
    : Array.isArray(parsed.data.tags)
      ? parsed.data.tags
      : [];

  const { data: row, error } = await supabase
    .from("ghl_contacts")
    .upsert(
      {
        ghl_contact_id: contactId,
        full_name: fields.name ?? null,
        email: fields.email ?? null,
        phone: fields.phone ?? null,
        location_id: parsed.data.location_id ?? (raw.location_id as string | undefined) ?? null,
        tags,
        raw_payload: raw,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "ghl_contact_id" }
    )
    .select("id, ghl_contact_id, email, full_name")
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
      handler: "contact",
      event: eventType,
      ghl_contact_id: row.ghl_contact_id,
      contact_row_id: row.id,
    },
  };
}
