import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logServiceActivity } from "@/lib/activity/log-service";
import { openEvaluationSession, castAgentVote } from "@/lib/agents/evaluate";
import { AGENT_NAMES, AGENT_VOTES } from "@/lib/agents/types";

const Body = z.object({
  event: z.string().min(1),
  source: z.string().optional().default("n8n"),
  entity: z.string().optional(),
  entity_id: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
  /** Optional: open a 3/5 agent panel for entity_id */
  open_agent_evaluation: z.boolean().optional(),
  /** Optional: record one agent vote in an existing session */
  agent_vote: z
    .object({
      session_id: z.string().uuid(),
      agent: z.enum(AGENT_NAMES),
      vote: z.enum(AGENT_VOTES),
      rationale: z.string().optional(),
    })
    .optional(),
});

/**
 * Generic n8n inbound webhook — audit in sync_events + activity_logs.
 * Configure n8n HTTP node with header: X-N8N-Secret: $N8N_WEBHOOK_SECRET
 */
export async function POST(req: NextRequest) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-n8n-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const supabase = createSupabaseServiceClient();

  const { data: eventRow, error: eventErr } = await supabase
    .from("sync_events")
    .insert({
      source: data.source,
      event_type: data.event,
      external_id: data.entity_id ?? null,
      payload: data.payload ?? {},
      processed: false,
    })
    .select("id")
    .single();

  if (eventErr) {
    return NextResponse.json({ error: eventErr.message }, { status: 500 });
  }

  if (data.entity && data.entity_id) {
    await logServiceActivity({
      entity: data.entity,
      entityId: data.entity_id,
      action: `n8n:${data.event}`,
      data: { sync_event_id: eventRow.id, payload: data.payload },
    });
  }

  let agentResult: unknown = null;

  if (data.open_agent_evaluation && data.entity && data.entity_id) {
    agentResult = await openEvaluationSession({
      subjectType: data.entity,
      subjectId: data.entity_id,
      metadata: { event: data.event, sync_event_id: eventRow.id },
    });
  }

  if (data.agent_vote) {
    agentResult = await castAgentVote({
      sessionId: data.agent_vote.session_id,
      agent: data.agent_vote.agent,
      vote: data.agent_vote.vote,
      rationale: data.agent_vote.rationale,
    });
  }

  await supabase
    .from("sync_events")
    .update({ processed: true })
    .eq("id", eventRow.id);

  return NextResponse.json({
    ok: true,
    sync_event_id: eventRow.id,
    agent: agentResult,
  });
}
