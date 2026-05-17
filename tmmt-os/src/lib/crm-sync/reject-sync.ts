import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { patchAirtableSyncFields } from "./airtable";

export async function rejectSync(args: {
  syncRecordId: string;
  rejectedBy?: string;
  reason?: string;
}) {
  const supabase = createSupabaseServiceClient();

  const { data: record, error } = await supabase
    .from("crm_sync_records")
    .select("id, airtable_record_id, airtable_table")
    .eq("id", args.syncRecordId)
    .maybeSingle();

  if (error || !record) throw new Error(error?.message ?? "sync record not found");

  await supabase
    .from("crm_sync_records")
    .update({
      sync_status: "rejected",
      verified_by: args.rejectedBy ?? null,
      last_error: args.reason ?? null,
    })
    .eq("id", args.syncRecordId);

  if (record.airtable_record_id) {
    await patchAirtableSyncFields({
      recordId: record.airtable_record_id,
      table: record.airtable_table ?? undefined,
      fields: {
        "Sync Status": "Rejected",
        Verified: false,
      },
    });
  }

  return { ok: true };
}
