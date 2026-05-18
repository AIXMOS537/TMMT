export const AGENT_NAMES = ["vision", "tank", "fly_guy", "bob", "sticks"] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

export const AGENT_VOTES = ["approve", "reject", "abstain"] as const;
export type AgentVote = (typeof AGENT_VOTES)[number];

export const DEFAULT_REQUIRED_APPROVALS = 3;
export const DEFAULT_PANEL_SIZE = 5;

export type AgentEvaluationSessionStatus = "pending" | "approved" | "rejected";

export type EvaluationSubject = {
  subjectType: string;
  subjectId: string;
  metadata?: Record<string, unknown>;
};

export type CastAgentVoteInput = {
  sessionId: string;
  agent: AgentName;
  vote: AgentVote;
  rationale?: string;
  payload?: Record<string, unknown>;
};
