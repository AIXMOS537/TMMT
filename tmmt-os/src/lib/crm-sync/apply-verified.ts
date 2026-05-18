import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { syncClientAlertsForStage } from "@/lib/client-rental/sync-alerts";
import { executeRouting } from "@/lib/routing/execute";
import type { CanonicalRenterStage } from "./types";

/**
 * After team verifies in Airtable — promote to Supabase cases + crm_sync_records.
 */
export async function applyVerifiedSync(args: {
  syncRecordId: string;
  verifiedBy?: string;
  airtableFields?: Record<string, unknown>;
}) {
  const supabase = createSupabaseServiceClient();

  const { data: record, error: fetchErr } = await supabase
    .from("crm_sync_records")
    .select("*")
    .eq("id", args.syncRecordId)
    .maybeSingle();

  if (fetchErr || !record) {
    throw new Error(fetchErr?.message ?? "sync record not found");
  }

  const canonical = (record.canonical_stage as CanonicalRenterStage) ?? "inquiry";
  const ghlMeta = {
    contact_id: record.ghl_contact_id,
    opportunity_id: record.ghl_opportunity_id,
    pipeline_id: record.ghl_pipeline_id,
    pipeline_name: record.ghl_pipeline_name,
    stage: record.ghl_stage,
    canonical_stage: canonical,
    verified_at: new Date().toISOString(),
    airtable: args.airtableFields ?? {},
  };

  let caseId = record.case_id as string | null;

  if (!caseId) {
    const { data: newCase, error: caseErr } = await supabase
      .from("cases")
      .insert({
        customer_name: record.customer_name ?? "Unknown",
        customer_email: record.customer_email,
        customer_phone: record.customer_phone,
        request_type: record.business_line === "rentals" ? "rental_booking" : "other",
        subject: `GHL ${record.ghl_pipeline_name ?? "pipeline"} — ${record.ghl_stage}`,
        description: `Synced from GHL; canonical: ${canonical}`,
        airtable_id: record.airtable_record_id,
        metadata: { ghl: ghlMeta },
        status: "internal_review",
      })
      .select("id")
      .single();
    if (caseErr) throw new Error(caseErr.message);
    caseId = newCase.id;
  } else {
    const { data: existing } = await supabase
      .from("cases")
      .select("metadata")
      .eq("id", caseId)
      .maybeSingle();

    const metadata = {
      ...((existing?.metadata as Record<string, unknown>) ?? {}),
      ghl: ghlMeta,
    };

    await supabase
      .from("cases")
      .update({
        metadata,
        airtable_id: record.airtable_record_id ?? undefined,
      })
      .eq("id", caseId);
  }

  await supabase
    .from("crm_sync_records")
    .update({
      sync_status: "verified",
      verified_at: new Date().toISOString(),
      verified_by: args.verifiedBy ?? null,
      case_id: caseId,
    })
    .eq("id", args.syncRecordId);

  if (record.business_line !== "dispatch" && record.customer_email) {
    await syncClientAlertsForStage(supabase, {
      customerEmail: record.customer_email,
      canonicalStage: canonical,
      ghlContactId: record.ghl_contact_id,
      syncRecordId: args.syncRecordId,
      ghlStageLabel: record.ghl_stage ?? undefined,
    }).catch(() => undefined);
  }

  await executeRouting({
    pipelineId: record.ghl_pipeline_id ?? undefined,
    pipelineName: record.ghl_pipeline_name ?? undefined,
    stage: record.ghl_stage,
    source: "airtable_verify",
    businessLine: record.business_line,
    syncRecordId: args.syncRecordId,
    caseId: caseId ?? undefined,
    customerName: record.customer_name ?? undefined,
    subject: record.ghl_pipeline_name
      ? `${record.ghl_pipeline_name} — ${record.ghl_stage}`
      : record.ghl_stage,
    customFields: (record.payload as { custom_fields?: Record<string, unknown> })
      ?.custom_fields,
  });

  return { caseId, canonical };
}
