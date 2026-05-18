import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { AgentDraft, AgentProfile, DetectionResult } from "@/lib/routing/types";

export type RunAgentContext = {
  caseId: string;
  customerName?: string;
  subject?: string;
  stage?: string;
  pipelineName?: string;
  detection: DetectionResult;
};

function buildTankDraft(ctx: RunAgentContext): AgentDraft {
  const title = `[TANK] ${ctx.detection.workType} — ${ctx.customerName ?? "Case"}`;
  const description = [
    `Work type: ${ctx.detection.workType}`,
    ctx.pipelineName ? `Pipeline: ${ctx.pipelineName}` : null,
    ctx.stage ? `Stage: ${ctx.stage}` : null,
    ctx.subject ? `Subject: ${ctx.subject}` : null,
    "",
    "Ops checklist:",
    "- Confirm pickup/dropoff windows",
    "- Assign courier per location prefs",
    "- Update ClickUp when load is scheduled",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    profile: "tank",
    generated_at: new Date().toISOString(),
    task_title: title,
    task_description: description,
    checklist: [
      "Verify load details",
      "Confirm courier assignment",
      "Post status to case",
    ],
  };
}

function buildSticksDraft(ctx: RunAgentContext): AgentDraft {
  const slaHours = ctx.detection.priority <= 2 ? 4 : 24;
  return {
    profile: "sticks",
    generated_at: new Date().toISOString(),
    task_title: `[STICKS] ${ctx.detection.workType} — ${ctx.customerName ?? "Case"}`,
    task_description: `Follow up on ${ctx.subject ?? "open item"}.`,
    sla_note: `Respond within ${slaHours}h (priority ${ctx.detection.priority}).`,
    checklist: ["Initial contact", "Log outcome on case", "Escalate if blocked"],
  };
}

/**
 * Writes agent_draft JSON on the case. Uses OpenAI only when OPENAI_API_KEY is set (future).
 */
export async function runAgentOnCase(ctx: RunAgentContext): Promise<AgentDraft> {
  const profile: AgentProfile = ctx.detection.agentProfile;
  let draft: AgentDraft =
    profile === "tank" ? buildTankDraft(ctx) : buildSticksDraft(ctx);

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey?.trim()) {
    draft = { ...draft, generated_at: new Date().toISOString() };
  }

  const supabase = createSupabaseServiceClient();
  await supabase.from("cases").update({ agent_draft: draft }).eq("id", ctx.caseId);

  return draft;
}
