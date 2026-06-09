import type { CanonicalRenterStage } from "@/lib/crm-sync/types";

/** DB / legacy GHL enum alias */
export function normalizeRenterStage(stage: string): CanonicalRenterStage {
  if (stage === "active_renter") return "active_rental";
  return stage as CanonicalRenterStage;
}

export type GhlStageOpsRule = {
  /** Auto-verify CRM + update case (default true for listed stages) */
  auto_apply?: boolean;
  /** Internal team owner for this stage */
  assignee_email?: string;
  /** TMMT OS case status after apply */
  case_status?: string;
  /** Run routing engine (ClickUp, dispatch load, agent draft) */
  run_routing?: boolean;
};

function defaultAssignee() {
  return (
    process.env.GHL_DEFAULT_ASSIGNEE_EMAIL?.trim() ||
    process.env.TMMT_OPS_DEFAULT_ASSIGNEE?.trim() ||
    "management@tmmtrentals.net"
  );
}

const BUILTIN_RULES: Record<string, GhlStageOpsRule> = {
  inquiry: { auto_apply: true, case_status: "initial_contact_needed", run_routing: true },
  contacted: { auto_apply: true, case_status: "initial_contact_complete", run_routing: true },
  qualifying: { auto_apply: true, case_status: "internal_review", run_routing: true },
  payment_pending: {
    auto_apply: true,
    assignee_email: defaultAssignee(),
    case_status: "task_assignment",
    run_routing: true,
  },
  booked: {
    auto_apply: true,
    assignee_email: defaultAssignee(),
    case_status: "internal_review",
    run_routing: true,
  },
  pickup_scheduled: {
    auto_apply: true,
    assignee_email: defaultAssignee(),
    case_status: "vendor_needed",
    run_routing: true,
  },
  active_rental: { auto_apply: true, case_status: "vendor_in_progress", run_routing: true },
  active_renter: { auto_apply: true, case_status: "vendor_in_progress", run_routing: true },
  return_due: {
    auto_apply: true,
    assignee_email: defaultAssignee(),
    case_status: "customer_follow_up",
    run_routing: true,
  },
  returned: { auto_apply: true, case_status: "awaiting_approval", run_routing: true },
  extended: { auto_apply: true, case_status: "customer_follow_up", run_routing: true },
  escalation: {
    auto_apply: true,
    assignee_email: defaultAssignee(),
    case_status: "blocked",
    run_routing: true,
  },
  closed_won: { auto_apply: true, case_status: "completed", run_routing: false },
  closed_lost: { auto_apply: true, case_status: "closed", run_routing: false },
};

let cachedOverrides: Record<string, GhlStageOpsRule> | null = null;

function loadOverrides(): Record<string, GhlStageOpsRule> {
  if (cachedOverrides) return cachedOverrides;
  try {
    const raw = process.env.GHL_STAGE_OPS_JSON;
    if (raw) {
      cachedOverrides = JSON.parse(raw) as Record<string, GhlStageOpsRule>;
      return cachedOverrides;
    }
  } catch {
    /* ignore */
  }
  cachedOverrides = {};
  return cachedOverrides;
}

export function getGhlStageOpsRule(canonicalStage: string): GhlStageOpsRule | null {
  const key = normalizeRenterStage(canonicalStage);
  const overrides = loadOverrides();
  const merged = { ...BUILTIN_RULES[key], ...overrides[key], ...overrides[canonicalStage] };
  if (Object.keys(merged).length === 0) return null;
  return merged;
}

export function isGhlAutoOpsEnabled() {
  return process.env.GHL_AUTO_OPS !== "false";
}
