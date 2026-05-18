export const CASE_TYPES = ["rental", "dispatch", "investor", "general"] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const ROUTING_STATUSES = [
  "pending",
  "detected",
  "clickup_created",
  "agent_drafted",
  "completed",
  "skipped",
  "failed",
] as const;
export type RoutingStatus = (typeof ROUTING_STATUSES)[number];

export const WORK_TYPES = [
  "rental_intake",
  "rental_followup",
  "rental_escalation",
  "dispatch_pickup",
  "dispatch_delivery",
  "dispatch_full",
  "investor_inquiry",
  "general_intake",
] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export type AgentProfile = "tank" | "sticks";

export type DetectionInput = {
  pipelineId?: string;
  pipelineName?: string;
  stage?: string;
  tags?: string[];
  source?: string;
  businessLine?: string;
};

export type DetectionResult = {
  workType: WorkType;
  caseType: CaseType;
  clickupTemplate?: string;
  priority: number;
  agentProfile: AgentProfile;
  ruleId: string;
};

export type AgentDraft = {
  profile: AgentProfile;
  generated_at: string;
  task_title?: string;
  task_description?: string;
  sla_note?: string;
  checklist?: string[];
};
