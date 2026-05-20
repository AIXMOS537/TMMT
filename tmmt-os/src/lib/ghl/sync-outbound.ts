import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { resolveGhlStageLabel } from "@/lib/crm-sync/reverse-stage-map";
import type { CanonicalRenterStage } from "@/lib/crm-sync/types";
import { addContactTag, isGhlConfigured, updateOpportunityStage } from "./client";

type SyncRecordGhl = {
  ghl_contact_id?: string | null;
  ghl_opportunity_id?: string | null;
  ghl_pipeline_id?: string | null;
  ghl_pipeline_name?: string | null;
  canonical_stage?: string | null;
};

/** Push TMMT canonical stage back to GHL when team verifies or advances CRM. */
export async function pushCanonicalStageToGhl(args: {
  syncRecordId?: string;
  caseId?: string;
  canonical: CanonicalRenterStage;
  source?: string;
}): Promise<{ ok: boolean; detail?: string }> {
  if (!isGhlConfigured()) return { ok: false, detail: "GHL not configured" };

  try {
    const supabase = createSupabaseServiceClient();
    let record: SyncRecordGhl | null = null;

    if (args.syncRecordId) {
      const { data } = await supabase
        .from("crm_sync_records")
        .select(
          "ghl_contact_id, ghl_opportunity_id, ghl_pipeline_id, ghl_pipeline_name, canonical_stage"
        )
        .eq("id", args.syncRecordId)
        .maybeSingle();
      record = data;
    } else if (args.caseId) {
      const { data: c } = await supabase
        .from("cases")
        .select("metadata")
        .eq("id", args.caseId)
        .maybeSingle();
      const ghl = (c?.metadata as { ghl?: SyncRecordGhl })?.ghl;
      if (ghl?.ghl_opportunity_id) {
        record = {
          ghl_contact_id: ghl.ghl_contact_id,
          ghl_opportunity_id: ghl.ghl_opportunity_id,
          ghl_pipeline_id: ghl.ghl_pipeline_id,
          ghl_pipeline_name: ghl.ghl_pipeline_name,
        };
      } else {
        const { data } = await supabase
          .from("crm_sync_records")
          .select(
            "ghl_contact_id, ghl_opportunity_id, ghl_pipeline_id, ghl_pipeline_name, canonical_stage"
          )
          .eq("case_id", args.caseId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        record = data;
      }
    }

    if (!record?.ghl_opportunity_id || !record.ghl_pipeline_id) {
      return { ok: false, detail: "No GHL opportunity on record" };
    }

    const stageLabel = resolveGhlStageLabel({
      pipelineId: record.ghl_pipeline_id,
      pipelineName: record.ghl_pipeline_name,
      canonical: args.canonical,
    });

    if (record.ghl_contact_id) {
      await addContactTag(record.ghl_contact_id, `tmmt-${args.canonical.replace(/_/g, "-")}`);
    }

    if (stageLabel) {
      await updateOpportunityStage({
        opportunityId: record.ghl_opportunity_id,
        pipelineId: record.ghl_pipeline_id,
        stageName: stageLabel,
      });
    }

    await supabase.from("sync_events").insert({
      source: "tmmt_os",
      event_type: "ghl_stage_push",
      payload: {
        canonical: args.canonical,
        ghl_stage: stageLabel,
        opportunity_id: record.ghl_opportunity_id,
        trigger: args.source ?? "manual",
      },
    });

    return { ok: true, detail: stageLabel ? `Moved to ${stageLabel}` : "Tagged contact only" };
  } catch (err) {
    console.error("[ghl] pushCanonicalStageToGhl", err);
    return { ok: false, detail: err instanceof Error ? err.message : "push failed" };
  }
}
