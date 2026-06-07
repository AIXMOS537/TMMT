import type { SupabaseClient } from "@supabase/supabase-js";
import { applyVerifiedSync } from "@/lib/crm-sync/apply-verified";
import { executeRouting } from "@/lib/routing/execute";
import { executeOpsCommands } from "./execute";
import type { OpsCommandResult } from "./types";
import {
  getGhlStageOpsRule,
  isGhlAutoOpsEnabled,
  normalizeRenterStage,
} from "./stage-rules";

export type GhlAutoOpsInput = {
  syncRecordId: string;
  canonicalStage: string;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  ghlStageLabel: string;
  ghlContactId: string;
  pipelineId?: string | null;
  pipelineName?: string | null;
  businessLine?: string | null;
  customFields?: Record<string, unknown>;
};

export type GhlAutoOpsResult = {
  enabled: boolean;
  applied: boolean;
  caseId?: string | null;
  canonicalStage: string;
  routing?: Awaited<ReturnType<typeof executeRouting>>;
  opsResults?: OpsCommandResult[];
  message: string;
};

export async function runGhlStageAutoOps(
  supabase: SupabaseClient,
  input: GhlAutoOpsInput
): Promise<GhlAutoOpsResult> {
  const canonical = normalizeRenterStage(input.canonicalStage);

  if (!isGhlAutoOpsEnabled()) {
    return {
      enabled: false,
      applied: false,
      canonicalStage: canonical,
      message: "GHL auto-ops disabled (GHL_AUTO_OPS=false).",
    };
  }

  const rule = getGhlStageOpsRule(canonical);
  if (!rule || rule.auto_apply === false) {
    return {
      enabled: true,
      applied: false,
      canonicalStage: canonical,
      message: "Stage logged; manual CRM approve still required.",
    };
  }

  const opsResults: OpsCommandResult[] = [];
  let routing: Awaited<ReturnType<typeof executeRouting>> | undefined;

  try {
    const applied = await applyVerifiedSync({
      syncRecordId: input.syncRecordId,
      verifiedBy: "ghl_auto_ops",
    });

    let caseId = applied.caseId;

    if (rule.run_routing !== false && caseId) {
      routing = await executeRouting({
        syncRecordId: input.syncRecordId,
        caseId,
        customerName: input.customerName ?? undefined,
        subject: `GHL ${input.pipelineName ?? "pipeline"} — ${input.ghlStageLabel}`,
        stage: input.ghlStageLabel,
        pipelineId: input.pipelineId ?? undefined,
        pipelineName: input.pipelineName ?? undefined,
        businessLine: input.businessLine ?? undefined,
        customFields: input.customFields,
        source: "ghl",
        tags: [canonical],
      });
    }

    if (!caseId) {
      const { data: sync } = await supabase
        .from("crm_sync_records")
        .select("case_id")
        .eq("id", input.syncRecordId)
        .maybeSingle();
      caseId = sync?.case_id ?? null;
    }

    if (caseId && rule.assignee_email) {
      const r = await executeOpsCommands({
        supabase,
        commands: [
          {
            action: "assign_staff",
            assignee_email: rule.assignee_email,
            case_id: caseId,
            case_status: rule.case_status,
            title: `${input.ghlStageLabel} — ${input.customerName ?? "Renter"}`,
            note: `Auto from GHL stage: ${canonical}`,
          },
        ],
        actor: { id: "ghl_auto_ops", email: "ghl_auto_ops@system" },
      });
      opsResults.push(...r.results);
    } else if (caseId && rule.case_status) {
      const r = await executeOpsCommands({
        supabase,
        commands: [
          {
            action: "advance_case",
            case_id: caseId,
            to: rule.case_status,
            note: `GHL stage: ${input.ghlStageLabel}`,
          },
        ],
        actor: { id: "ghl_auto_ops", email: "ghl_auto_ops@system" },
      });
      opsResults.push(...r.results);
    }

    return {
      enabled: true,
      applied: true,
      caseId,
      canonicalStage: canonical,
      routing,
      opsResults,
      message: `Auto-applied GHL stage “${canonical}” — case, assignee, and routing updated.`,
    };
  } catch (e) {
    return {
      enabled: true,
      applied: false,
      canonicalStage: canonical,
      opsResults,
      message: e instanceof Error ? e.message : "GHL auto-ops failed",
    };
  }
}
