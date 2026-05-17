"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { applyVerifiedSync } from "@/lib/crm-sync/apply-verified";
import { fetchAirtableRecord, markAirtableVerified } from "@/lib/crm-sync/airtable";
import { rejectSync } from "@/lib/crm-sync/reject-sync";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function approveSyncAction(formData: FormData) {
  const me = await requireRole(["admin", "internal_team"]);
  const syncRecordId = String(formData.get("sync_record_id"));

  const supabase = createSupabaseServiceClient();
  const { data: record } = await supabase
    .from("crm_sync_records")
    .select("airtable_record_id, airtable_table")
    .eq("id", syncRecordId)
    .maybeSingle();

  let airtableFields: Record<string, unknown> | undefined;
  if (record?.airtable_record_id) {
    airtableFields =
      (await fetchAirtableRecord(
        record.airtable_table ?? process.env.AIRTABLE_LEADS_TABLE ?? "Leads",
        record.airtable_record_id
      )) ?? undefined;
    await markAirtableVerified({
      recordId: record.airtable_record_id,
      table: record.airtable_table ?? undefined,
    });
  }

  const result = await applyVerifiedSync({
    syncRecordId,
    verifiedBy: me.email ?? me.full_name ?? me.id,
    airtableFields,
  });

  revalidatePath("/internal/sync");
  revalidatePath(`/internal/sync/${syncRecordId}`);
  revalidatePath("/internal/dashboard");
  if (result.caseId) revalidatePath(`/internal/cases/${result.caseId}`);
}

export async function rejectSyncAction(formData: FormData) {
  const me = await requireRole(["admin", "internal_team"]);
  const syncRecordId = String(formData.get("sync_record_id"));
  const reason = (formData.get("reason") as string) || undefined;

  await rejectSync({
    syncRecordId,
    rejectedBy: me.email ?? me.full_name ?? me.id,
    reason,
  });

  revalidatePath("/internal/sync");
  revalidatePath(`/internal/sync/${syncRecordId}`);
  revalidatePath("/internal/dashboard");
}
