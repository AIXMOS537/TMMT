import type { AgentName } from "./types";

/** AIXMOS agent roles — keep labels stable for n8n / GHL automations. */
export const AGENT_REGISTRY: Record<
  AgentName,
  { label: string; role: string; description: string }
> = {
  vision: {
    label: "VISION",
    role: "governance",
    description: "Approval, policy, and go/no-go decisions.",
  },
  tank: {
    label: "TANK",
    role: "execution",
    description: "Operational execution and task completion.",
  },
  fly_guy: {
    label: "FLY GUY",
    role: "communication",
    description: "Customer-facing messaging and UX quality.",
  },
  bob: {
    label: "BOB",
    role: "logging",
    description: "Audit trail, explanations, and documentation.",
  },
  sticks: {
    label: "STICKS",
    role: "monitoring",
    description: "Alerts, SLA risk, and anomaly detection.",
  },
};
