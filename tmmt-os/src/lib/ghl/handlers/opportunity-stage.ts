import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertLeadForVerification } from "@/lib/crm-sync/airtable";
import { resolveCanonicalStage } from "@/lib/crm-sync/stage-map";
import type { CanonicalRenterStage, GhlStageWebhookBody } from "@/lib/crm-sync/types";
import { syncClientAlertsForStage } from "@/lib/client-rental/sync-alerts";
import { runGhlStageAutoOps } from "@/lib/ops-command/ghl-auto-ops";
import { isGhlAutoOpsEnabled } from "@/lib/ops-command/stage-rules";
import { logSyncEvent, markSyncEventProcessed } from "@/lib/ghl/sync-event";
import { pickContactFields, pickContactId } from "@/lib/ghl/payload";
import { syncContactPortalFields } from "@/lib/ghl/sync-contact-portal-fields";
import { syncDealerLeadFromGhl } from "@/lib/ghl/dealer-lead-sync";

export const OpportunityStageBody = z.object({
  event: z.string().optional(),
  pipeline_id: z.string().optional(),
  pipeline_name: z.string().optional(),
  opportunity_id: z.string().optional(),
  contact_id: z.string().min(1).optional(),
  contact: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  previous_stage: z.string().optional(),
  stage: z.string().min(1),
  business_line: z.string().optional(),
  custom_fields: z.record(z.any()).optional(),
});

export async function handleOpportunityStage(
  supabase: SupabaseClient,
  raw: Record<string, unknown>
) {
  const parsed = OpportunityStageBody.safeParse({
    ...raw,
    contact_id: pickContactId(raw) ?? raw.contact_id,
    contact: raw.contact ?? pickContactFields(raw),
  });

  if (!parsed.success) {
    return { status: 400 as const, body: { error: parsed.error.flatten() } };
  }

  const data = {
    ...parsed.data,
    contact_id: parsed.data.contact_id!,
  } as GhlStageWebhookBody;

  const contactFields = pickContactFields(raw);
  const contactName = data.contact?.name ?? contactFields.name;

  const { canonical, businessLine } = resolveCanonicalStage({
    pipelineId: data.pipeline_id,
    pipelineName: data.pipeline_name,
    stageName: data.stage,
  });

  const eventId = await logSyncEvent(supabase, {
    event_type: data.event ?? "opportunity.stage_changed",
    external_id: data.opportunity_id ?? data.contact_id,
    payload: raw,
  });

  if (contactName || contactFields.email || contactFields.phone) {
    await upsertGhlContact(supabase, {
      ghl_contact_id: data.contact_id,
      full_name: contactName,
      email: contactFields.email ?? data.contact?.email,
      phone: contactFields.phone ?? data.contact?.phone,
      raw_payload: raw,
    });
  }

  const upsertPayload = {
    business_line: data.business_line ?? businessLine,
    ghl_contact_id: data.contact_id,
    ghl_opportunity_id: data.opportunity_id ?? null,
    ghl_pipeline_id: data.pipeline_id ?? null,
    ghl_pipeline_name: data.pipeline_name ?? null,
    ghl_stage: data.stage,
    ghl_previous_stage: data.previous_stage ?? null,
    canonical_stage: canonical,
    sync_status: "pending_verification" as const,
    customer_name: contactName ?? null,
    customer_email: contactFields.email ?? data.contact?.email ?? null,
    customer_phone: contactFields.phone ?? data.contact?.phone ?? null,
    payload: { custom_fields: data.custom_fields ?? {} },
  };

  const { data: syncRow, error: syncErr } = await supabase
    .from("crm_sync_records")
    .upsert(upsertPayload, {
      onConflict: "ghl_contact_id,ghl_opportunity_id,ghl_pipeline_id",
    })
    .select("id")
    .single();

  if (syncErr) {
    return { status: 500 as const, body: { error: syncErr.message } };
  }

  const dealerLead = await syncDealerLeadFromGhl({
    ghlContactId: data.contact_id,
    ghlOpportunityId: data.opportunity_id,
    pipelineName: data.pipeline_name,
    stage: data.stage,
    customerName: contactName,
    customerEmail: contactFields.email ?? data.contact?.email,
    customerPhone: contactFields.phone ?? data.contact?.phone,
    businessLine: data.business_line ?? businessLine,
  });

  const airtable = await upsertLeadForVerification({
    ghlContactId: data.contact_id,
    ghlOpportunityId: data.opportunity_id,
    pipelineName: data.pipeline_name,
    ghlStage: data.stage,
    canonicalStage: canonical,
    customerName: contactName,
    customerEmail: contactFields.email ?? data.contact?.email,
    customerPhone: contactFields.phone ?? data.contact?.phone,
    customFields: data.custom_fields,
  });

  if (airtable.recordId) {
    await supabase
      .from("crm_sync_records")
      .update({
        airtable_record_id: airtable.recordId,
        airtable_table: process.env.AIRTABLE_LEADS_TABLE ?? "Leads",
      })
      .eq("id", syncRow.id);
  }

  if (eventId) {
    await markSyncEventProcessed(supabase, eventId, syncRow.id);
  }

  const autoOps = await runGhlStageAutoOps(supabase, {
    syncRecordId: syncRow.id,
    canonicalStage: canonical,
    customerEmail: contactFields.email ?? data.contact?.email,
    customerName: contactName,
    customerPhone: contactFields.phone ?? data.contact?.phone,
    ghlStageLabel: data.stage,
    ghlContactId: data.contact_id,
    pipelineId: data.pipeline_id,
    pipelineName: data.pipeline_name,
    businessLine: data.business_line ?? businessLine,
    customFields: data.custom_fields,
  });

  const { data: linkedCase } = await supabase
    .from("crm_sync_records")
    .select("case_id")
    .eq("id", syncRow.id)
    .maybeSingle();

  if (linkedCase?.case_id) {
    const { data: caseRow } = await supabase
      .from("cases")
      .select("ref_code, customer_email")
      .eq("id", linkedCase.case_id)
      .maybeSingle();

    if (caseRow?.ref_code) {
      void syncContactPortalFields({
        refCode: caseRow.ref_code,
        caseId: linkedCase.case_id,
        customerEmail: caseRow.customer_email,
        ghlContactId: data.contact_id,
      });
    }
  }

  const clientEmail = contactFields.email ?? data.contact?.email;
  if (clientEmail && process.env.GHL_CLIENT_ALERTS !== "false" && !autoOps.applied) {
    await syncClientAlertsForStage(supabase, {
      customerEmail: clientEmail,
      canonicalStage: canonical as CanonicalRenterStage,
      ghlContactId: data.contact_id,
      syncRecordId: syncRow.id,
      ghlStageLabel: data.stage,
    }).catch(() => undefined);
  }

  return {
    status: 200 as const,
    body: {
      ok: true,
      handler: "opportunity.stage_changed",
      sync_record_id: syncRow.id,
      canonical_stage: canonical,
      dealer_lead_sync: dealerLead,
      airtable,
      auto_ops: autoOps,
      message: autoOps.applied
        ? autoOps.message
        : isGhlAutoOpsEnabled()
          ? "Logged — stage not configured for auto-apply."
          : "Logged — enable GHL_AUTO_OPS for automatic case updates.",
    },
  };
}

async function upsertGhlContact(
  supabase: SupabaseClient,
  row: {
    ghl_contact_id: string;
    full_name?: string;
    email?: string;
    phone?: string;
    location_id?: string;
    tags?: string[];
    raw_payload: Record<string, unknown>;
  }
) {
  await supabase.from("ghl_contacts").upsert(
    {
      ghl_contact_id: row.ghl_contact_id,
      full_name: row.full_name ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      location_id: row.location_id ?? null,
      tags: row.tags ?? [],
      raw_payload: row.raw_payload,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "ghl_contact_id" }
  );
}

export { upsertGhlContact };
