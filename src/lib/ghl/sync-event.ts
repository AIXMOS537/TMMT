import type { SupabaseClient } from "@supabase/supabase-js";

export async function logSyncEvent(
  supabase: SupabaseClient,
  args: {
    source?: string;
    event_type: string;
    external_id?: string | null;
    payload: Record<string, unknown>;
    sync_record_id?: string | null;
    processed?: boolean;
    error?: string | null;
  }
): Promise<string | undefined> {
  const { data, error } = await supabase
    .from("sync_events")
    .insert({
      source: args.source ?? "ghl",
      event_type: args.event_type,
      external_id: args.external_id ?? null,
      payload: args.payload,
      sync_record_id: args.sync_record_id ?? null,
      processed: args.processed ?? false,
      error: args.error ?? null,
    })
    .select("id")
    .single();

  if (error) return undefined;
  return data?.id;
}

export async function markSyncEventProcessed(
  supabase: SupabaseClient,
  eventId: string,
  syncRecordId?: string
) {
  await supabase
    .from("sync_events")
    .update({
      processed: true,
      ...(syncRecordId ? { sync_record_id: syncRecordId } : {}),
    })
    .eq("id", eventId);
}
