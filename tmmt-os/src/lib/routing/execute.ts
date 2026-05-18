import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createClickUpTask } from "@/lib/clickup/create-task";
import { runAgentOnCase } from "@/lib/agents/run-on-case";
import { detectWorkFromEvent } from "./detect";
import { resolveOpsLocation } from "./locations";
import type { DetectionInput, DetectionResult, RoutingStatus, WorkType } from "./types";

export type ExecuteRoutingInput = DetectionInput & {
  syncRecordId?: string;
  caseId?: string;
  customerName?: string;
  subject?: string;
  customFields?: Record<string, unknown>;
};

export type ExecuteRoutingResult = {
  detection: DetectionResult;
  routingStatus: RoutingStatus;
  clickupTaskId?: string;
  clickupTaskUrl?: string;
  dispatchLoadId?: string;
  errors: string[];
};

function isDispatchWork(workType: WorkType) {
  return workType.startsWith("dispatch_");
}

async function persistDetection(args: {
  detection: DetectionResult;
  syncRecordId?: string;
  caseId?: string;
  routingStatus: RoutingStatus;
  routingResult: Record<string, unknown>;
}) {
  const supabase = createSupabaseServiceClient();

  if (args.syncRecordId) {
    const { data: row } = await supabase
      .from("crm_sync_records")
      .select("payload")
      .eq("id", args.syncRecordId)
      .maybeSingle();
    const payload = {
      ...((row?.payload as Record<string, unknown>) ?? {}),
      routing: args.routingResult,
    };
    await supabase
      .from("crm_sync_records")
      .update({
        work_type: args.detection.workType,
        routing_status: args.routingStatus,
        payload,
      })
      .eq("id", args.syncRecordId);
  }
  if (args.caseId) {
    const { data: existing } = await supabase
      .from("cases")
      .select("metadata")
      .eq("id", args.caseId)
      .maybeSingle();
    const metadata = {
      ...((existing?.metadata as Record<string, unknown>) ?? {}),
      routing: args.routingResult,
    };
    await supabase
      .from("cases")
      .update({
        work_type: args.detection.workType,
        case_type: args.detection.caseType,
        routing_status: args.routingStatus,
        priority: args.detection.priority,
        metadata,
      })
      .eq("id", args.caseId);
  }
}

async function ensureDispatchLoad(args: {
  caseId: string;
  customFields?: Record<string, unknown>;
  workType: WorkType;
}) {
  const cf = args.customFields ?? {};
  const pickup = (cf.pickup ?? cf.pickup_address ?? cf.Pickup) as string | undefined;
  const dropoff = (cf.dropoff ?? cf.dropoff_address ?? cf.Dropoff) as string | undefined;

  const supabase = createSupabaseServiceClient();
  const { data: existing } = await supabase
    .from("dispatch_loads")
    .select("id")
    .eq("case_id", args.caseId)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data: row, error } = await supabase
    .from("dispatch_loads")
    .insert({
      case_id: args.caseId,
      pickup: pickup ?? null,
      dropoff: dropoff ?? null,
      partner_courier: (cf.partner_courier ?? cf.courier) as string | undefined,
      status: "available",
      metadata: { work_type: args.workType, source_fields: cf },
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return row.id as string;
}

/**
 * detect → optional ClickUp task → optional agent draft → optional dispatch_loads row
 */
export async function executeRouting(input: ExecuteRoutingInput): Promise<ExecuteRoutingResult> {
  const errors: string[] = [];
  const detection = detectWorkFromEvent(input);
  let routingStatus: RoutingStatus = "detected";
  let clickupTaskId: string | undefined;
  let clickupTaskUrl: string | undefined;
  let dispatchLoadId: string | undefined;

  const routingResult: Record<string, unknown> = {
    rule_id: detection.ruleId,
    work_type: detection.workType,
    case_type: detection.caseType,
    agent_profile: detection.agentProfile,
    clickup_template: detection.clickupTemplate,
    detected_at: new Date().toISOString(),
  };

  await persistDetection({
    detection,
    syncRecordId: input.syncRecordId,
    caseId: input.caseId,
    routingStatus,
    routingResult,
  });

  const supabase = createSupabaseServiceClient();
  const location = await resolveOpsLocation(supabase, {
    pipeline_id: input.pipelineId,
    pipeline_name: input.pipelineName,
  });
  const listId = location?.clickup_list_id ?? process.env.CLICKUP_DEFAULT_LIST_ID;

  if (listId && input.caseId) {
    try {
      const taskName = `${detection.workType}: ${input.customerName ?? input.subject ?? "TMMT case"}`;
      const created = await createClickUpTask({
        listId,
        name: taskName,
        description: [
          input.subject,
          input.stage ? `Stage: ${input.stage}` : null,
          input.pipelineName ? `Pipeline: ${input.pipelineName}` : null,
          `Template: ${detection.clickupTemplate ?? "default"}`,
        ]
          .filter(Boolean)
          .join("\n"),
        priority: detection.priority,
        assigneeEmail: location?.overseas_assignee_email ?? undefined,
        tags: [detection.caseType, detection.workType],
      });
      if (created) {
        clickupTaskId = created.taskId;
        clickupTaskUrl = created.url;
        routingStatus = "clickup_created";
        routingResult.clickup = created;

        const supabase = createSupabaseServiceClient();
        await supabase
          .from("cases")
          .update({
            clickup_task_id: created.taskId,
            clickup_task_url: created.url,
            routing_status: routingStatus,
          })
          .eq("id", input.caseId);
      } else {
        routingStatus = "skipped";
        routingResult.clickup_skipped = "CLICKUP_API_TOKEN not set";
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "ClickUp failed");
      routingStatus = "failed";
    }
  }

  if (input.caseId) {
    try {
      await runAgentOnCase({
        caseId: input.caseId,
        customerName: input.customerName,
        subject: input.subject,
        stage: input.stage,
        pipelineName: input.pipelineName,
        detection,
      });
      if (routingStatus !== "failed") routingStatus = "agent_drafted";
      routingResult.agent_drafted = true;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Agent draft failed");
    }

    if (isDispatchWork(detection.workType)) {
      try {
        dispatchLoadId = await ensureDispatchLoad({
          caseId: input.caseId,
          customFields: input.customFields,
          workType: detection.workType,
        });
        routingResult.dispatch_load_id = dispatchLoadId;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "dispatch_load failed");
      }
    }
  }

  if (errors.length === 0 && routingStatus === "agent_drafted") {
    routingStatus = "completed";
  }

  await persistDetection({
    detection,
    syncRecordId: input.syncRecordId,
    caseId: input.caseId,
    routingStatus,
    routingResult: { ...routingResult, errors },
  });

  return {
    detection,
    routingStatus,
    clickupTaskId,
    clickupTaskUrl,
    dispatchLoadId,
    errors,
  };
}
