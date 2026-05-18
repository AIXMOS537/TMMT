import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { logServiceActivity } from "@/lib/activity/log-service";
import {
  AGENT_NAMES,
  DEFAULT_PANEL_SIZE,
  DEFAULT_REQUIRED_APPROVALS,
  type AgentEvaluationSessionStatus,
  type AgentName,
  type AgentVote,
  type CastAgentVoteInput,
  type EvaluationSubject,
} from "./types";

function tallyVotes(votes: AgentVote[]) {
  const approve = votes.filter((v) => v === "approve").length;
  const reject = votes.filter((v) => v === "reject").length;
  return { approve, reject };
}

export async function openEvaluationSession(
  subject: EvaluationSubject,
  opts?: { requiredApprovals?: number; panelSize?: number }
) {
  const supabase = createSupabaseServiceClient();
  const requiredApprovals = opts?.requiredApprovals ?? DEFAULT_REQUIRED_APPROVALS;
  const panelSize = opts?.panelSize ?? DEFAULT_PANEL_SIZE;

  const { data: session, error } = await supabase
    .from("agent_evaluation_sessions")
    .insert({
      subject_type: subject.subjectType,
      subject_id: subject.subjectId,
      required_approvals: requiredApprovals,
      panel_size: panelSize,
      status: "pending",
      metadata: subject.metadata ?? {},
    })
    .select("id, subject_type, subject_id, required_approvals, panel_size, status")
    .single();

  if (error) throw new Error(error.message);

  await logServiceActivity({
    entity: "agent_evaluation_session",
    entityId: session.id,
    action: "session_opened",
    data: { subject },
  });

  return session;
}

export async function castAgentVote(input: CastAgentVoteInput) {
  const supabase = createSupabaseServiceClient();

  const { data: session, error: sessionErr } = await supabase
    .from("agent_evaluation_sessions")
    .select("id, status, required_approvals, panel_size, subject_type, subject_id")
    .eq("id", input.sessionId)
    .single();

  if (sessionErr) throw new Error(sessionErr.message);
  if (session.status !== "pending") {
    throw new Error(`Session already ${session.status}`);
  }

  const { error: voteErr } = await supabase.from("agent_evaluations").upsert(
    {
      session_id: input.sessionId,
      agent: input.agent,
      vote: input.vote,
      rationale: input.rationale ?? null,
      payload: input.payload ?? {},
    },
    { onConflict: "session_id,agent" }
  );
  if (voteErr) throw new Error(voteErr.message);

  const { data: votes, error: listErr } = await supabase
    .from("agent_evaluations")
    .select("vote")
    .eq("session_id", input.sessionId);
  if (listErr) throw new Error(listErr.message);

  const tallies = tallyVotes((votes ?? []).map((v) => v.vote as AgentVote));
  let status: AgentEvaluationSessionStatus = "pending";
  let decision: string | null = null;
  let resolvedAt: string | null = null;

  if (tallies.reject >= session.required_approvals) {
    status = "rejected";
    decision = "rejected";
    resolvedAt = new Date().toISOString();
  } else if (tallies.approve >= session.required_approvals) {
    status = "approved";
    decision = "approved";
    resolvedAt = new Date().toISOString();
  }

  if (status !== "pending") {
    await supabase
      .from("agent_evaluation_sessions")
      .update({ status, decision, resolved_at: resolvedAt })
      .eq("id", input.sessionId);
  }

  await logServiceActivity({
    entity: "agent_evaluation_session",
    entityId: input.sessionId,
    action: "agent_vote",
    data: {
      agent: input.agent,
      vote: input.vote,
      tallies,
      status,
    },
  });

  return {
    sessionId: input.sessionId,
    status,
    decision,
    tallies,
    votesRecorded: votes?.length ?? 0,
    panelSize: session.panel_size,
    requiredApprovals: session.required_approvals,
    agents: AGENT_NAMES,
  };
}

export async function getEvaluationSession(sessionId: string) {
  const supabase = createSupabaseServiceClient();
  const { data: session, error } = await supabase
    .from("agent_evaluation_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (error) throw new Error(error.message);

  const { data: votes } = await supabase
    .from("agent_evaluations")
    .select("agent, vote, rationale, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return { session, votes: votes ?? [] };
}
