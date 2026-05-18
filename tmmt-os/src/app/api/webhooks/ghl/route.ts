import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { upsertLeadForVerification } from "@/lib/crm-sync/airtable";
import { resolveCanonicalStage } from "@/lib/crm-sync/stage-map";
import { syncClientAlertsForStage } from "@/lib/client-rental/sync-alerts";
import { runGhlStageAutoOps } from "@/lib/ops-command/ghl-auto-ops";
import { isGhlAutoOpsEnabled } from "@/lib/ops-command/stage-rules";
import type { CanonicalRenterStage, GhlStageWebhookBody } from "@/lib/crm-sync/types";

const Body = z.object({
  event: z.string().optional(),
  pipeline_id: z.string().optional(),
  pipeline_name: z.string().optional(),
  opportunity_id: z.string().optional(),
  contact_id: z.string().min(1),
  contact: z
    .object({
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

/**
 * GHL opportunity stage changed → Supabase CRM + optional Airtable mirror.
 * When GHL_AUTO_OPS is enabled (default), auto-verify, update case, assign staff, route to ClickUp.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-ghl-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data as GhlStageWebhookBody;
  const { canonical, businessLine } = resolveCanonicalStage({
    pipelineId: data.pipeline_id,
    pipelineName: data.pipeline_name,
    stageName: data.stage,
  });

  const supabase = createSupabaseServiceClient();

  const { data: eventRow } = await supabase
    .from("sync_events")
    .insert({
      source: "ghl",
      event_type: data.event ?? "opportunity.stage_changed",
      external_id: data.opportunity_id ?? data.contact_id,
      payload: data as unknown as Record<string, unknown>,
      processed: false,
    })
    .select("id")
    .single();

  const contactName = data.contact?.name;
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
    customer_email: data.contact?.email ?? null,
    customer_phone: data.contact?.phone ?? null,
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
    return NextResponse.json({ error: syncErr.message }, { status: 500 });
  }

  const airtable = await upsertLeadForVerification({
    ghlContactId: data.contact_id,
    ghlOpportunityId: data.opportunity_id,
    pipelineName: data.pipeline_name,
    ghlStage: data.stage,
    canonicalStage: canonical,
    customerName: contactName,
    customerEmail: data.contact?.email,
    customerPhone: data.contact?.phone,
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

  if (eventRow?.id) {
    await supabase
      .from("sync_events")
      .update({ processed: true, sync_record_id: syncRow.id })
      .eq("id", eventRow.id);
  }

  const autoOps = await runGhlStageAutoOps(supabase, {
    syncRecordId: syncRow.id,
    canonicalStage: canonical,
    customerEmail: data.contact?.email,
    customerName: contactName,
    customerPhone: data.contact?.phone,
    ghlStageLabel: data.stage,
    ghlContactId: data.contact_id,
    pipelineId: data.pipeline_id,
    pipelineName: data.pipeline_name,
    businessLine: data.business_line ?? businessLine,
    customFields: data.custom_fields,
  });

  const clientEmail = data.contact?.email;
  if (
    clientEmail &&
    process.env.GHL_CLIENT_ALERTS !== "false" &&
    !autoOps.applied
  ) {
    await syncClientAlertsForStage(supabase, {
      customerEmail: clientEmail,
      canonicalStage: canonical as CanonicalRenterStage,
      ghlContactId: data.contact_id,
      syncRecordId: syncRow.id,
      ghlStageLabel: data.stage,
    }).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    sync_record_id: syncRow.id,
    canonical_stage: canonical,
    airtable,
    auto_ops: autoOps,
    message: autoOps.applied
      ? autoOps.message
      : isGhlAutoOpsEnabled()
        ? "Logged — stage not configured for auto-apply."
        : "Logged — enable GHL_AUTO_OPS for automatic case updates.",
  });
}
