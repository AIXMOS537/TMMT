import type { AgentProfile, CaseType, DetectionInput, DetectionResult, WorkType } from "./types";

export type RoutingRule = {
  id: string;
  match: {
    pipelineNameIncludes?: string[];
    stageIncludes?: string[];
    tagsAny?: string[];
    source?: string[];
    businessLine?: string[];
  };
  workType: WorkType;
  caseType: CaseType;
  clickupTemplate?: string;
  priority: number;
  agentProfile: AgentProfile;
};

function norm(s?: string) {
  return (s ?? "").trim().toLowerCase();
}

function includesAny(haystack: string, needles: string[]) {
  const h = norm(haystack);
  return needles.some((n) => h.includes(norm(n)));
}

function tagsMatch(tags: string[] | undefined, ruleTags: string[] | undefined) {
  if (!ruleTags?.length) return true;
  const t = (tags ?? []).map(norm);
  return ruleTags.some((rt) => t.includes(norm(rt)));
}

export const ROUTING_RULES: RoutingRule[] = [
  {
    id: "dispatch-pickup",
    match: {
      pipelineNameIncludes: ["dispatch", "logistics", "freight"],
      stageIncludes: ["pickup", "pick up", "load assigned"],
      businessLine: ["dispatch", "logistics"],
    },
    workType: "dispatch_pickup",
    caseType: "dispatch",
    clickupTemplate: "dispatch_pickup",
    priority: 2,
    agentProfile: "tank",
  },
  {
    id: "dispatch-delivery",
    match: {
      pipelineNameIncludes: ["dispatch", "logistics"],
      stageIncludes: ["delivery", "drop off", "dropoff", "in transit"],
    },
    workType: "dispatch_delivery",
    caseType: "dispatch",
    clickupTemplate: "dispatch_delivery",
    priority: 2,
    agentProfile: "tank",
  },
  {
    id: "dispatch-full",
    match: {
      pipelineNameIncludes: ["dispatch", "logistics", "freight"],
    },
    workType: "dispatch_full",
    caseType: "dispatch",
    clickupTemplate: "dispatch_full",
    priority: 2,
    agentProfile: "tank",
  },
  {
    id: "luxury-intake",
    match: {
      pipelineNameIncludes: ["luxury", "exotic", "premium"],
      businessLine: ["luxury"],
    },
    workType: "rental_intake",
    caseType: "rental",
    clickupTemplate: "rental_intake",
    priority: 2,
    agentProfile: "sticks",
  },
  {
    id: "express-intake",
    match: { businessLine: ["express"] },
    workType: "rental_intake",
    caseType: "rental",
    clickupTemplate: "rental_intake",
    priority: 2,
    agentProfile: "sticks",
  },
  {
    id: "black-intake",
    match: {
      pipelineNameIncludes: ["black", "chauffeur", "executive"],
      businessLine: ["black"],
    },
    workType: "rental_intake",
    caseType: "rental",
    clickupTemplate: "rental_intake",
    priority: 2,
    agentProfile: "sticks",
  },
  {
    id: "auto-intake",
    match: {
      pipelineNameIncludes: ["auto", "wholesale", "shop"],
      businessLine: ["auto"],
    },
    workType: "general_intake",
    caseType: "general",
    clickupTemplate: "general_intake",
    priority: 3,
    agentProfile: "tank",
  },
  {
    id: "dealer-sales",
    match: {
      pipelineNameIncludes: ["dealer", "dealership", "applicants"],
      businessLine: ["dealer", "wholesale-cars"],
    },
    workType: "general_intake",
    caseType: "general",
    clickupTemplate: "general_intake",
    priority: 2,
    agentProfile: "tank",
  },
  {
    id: "moving-intake",
    match: {
      pipelineNameIncludes: ["moving", "move"],
      businessLine: ["moving"],
    },
    workType: "dispatch_full",
    caseType: "dispatch",
    clickupTemplate: "dispatch_full",
    priority: 2,
    agentProfile: "tank",
  },
  {
    id: "cleaning-intake",
    match: {
      pipelineNameIncludes: ["cleaning", "clean"],
      businessLine: ["cleaning"],
    },
    workType: "general_intake",
    caseType: "general",
    clickupTemplate: "general_intake",
    priority: 3,
    agentProfile: "tank",
  },
  {
    id: "restoration-intake",
    match: {
      pipelineNameIncludes: ["restoration", "credit", "restore"],
      businessLine: ["restoration"],
    },
    workType: "general_intake",
    caseType: "general",
    clickupTemplate: "general_intake",
    priority: 3,
    agentProfile: "sticks",
  },
  {
    id: "rental-escalation",
    match: {
      pipelineNameIncludes: ["rental", "renter"],
      stageIncludes: ["overdue", "escalation", "payment overdue"],
      businessLine: ["rentals", "express", "black", "luxury", "rental"],
    },
    workType: "rental_escalation",
    caseType: "rental",
    clickupTemplate: "rental_escalation",
    priority: 1,
    agentProfile: "sticks",
  },
  {
    id: "rental-followup",
    match: {
      pipelineNameIncludes: ["rental", "renter", "tmmt rentals"],
      stageIncludes: ["contacted", "qualifying", "booked", "active"],
    },
    workType: "rental_followup",
    caseType: "rental",
    clickupTemplate: "rental_followup",
    priority: 3,
    agentProfile: "sticks",
  },
  {
    id: "rental-intake",
    match: {
      pipelineNameIncludes: ["rental", "renter"],
      businessLine: ["rentals", "express", "black", "luxury", "rental"],
    },
    workType: "rental_intake",
    caseType: "rental",
    clickupTemplate: "rental_intake",
    priority: 3,
    agentProfile: "sticks",
  },
  {
    id: "investor-inquiry",
    match: {
      pipelineNameIncludes: ["investor", "capital", "fund"],
      tagsAny: ["investor", "lp"],
      source: ["investor_portal", "investor"],
    },
    workType: "investor_inquiry",
    caseType: "investor",
    clickupTemplate: "investor_inquiry",
    priority: 3,
    agentProfile: "sticks",
  },
  {
    id: "intake-delivery",
    match: {
      source: ["web", "api", "airtable", "zapier", "n8n"],
      tagsAny: ["delivery"],
    },
    workType: "dispatch_delivery",
    caseType: "dispatch",
    clickupTemplate: "dispatch_delivery",
    priority: 3,
    agentProfile: "tank",
  },
  {
    id: "general-fallback",
    match: {},
    workType: "general_intake",
    caseType: "general",
    clickupTemplate: "general_intake",
    priority: 4,
    agentProfile: "tank",
  },
];

export function matchRoutingRule(input: DetectionInput): DetectionResult {
  const pipeline = input.pipelineName ?? "";
  const stage = input.stage ?? "";
  const tags = input.tags ?? [];
  const source = input.source ?? "";
  const businessLine = input.businessLine ?? "";

  for (const rule of ROUTING_RULES) {
    const m = rule.match;
    if (m.pipelineNameIncludes?.length && !includesAny(pipeline, m.pipelineNameIncludes)) {
      continue;
    }
    if (m.stageIncludes?.length && !includesAny(stage, m.stageIncludes)) {
      continue;
    }
    if (m.businessLine?.length && !includesAny(businessLine, m.businessLine)) {
      continue;
    }
    if (m.source?.length && !m.source.map(norm).includes(norm(source))) {
      continue;
    }
    if (!tagsMatch(tags, m.tagsAny)) {
      continue;
    }

    return {
      workType: rule.workType,
      caseType: rule.caseType,
      clickupTemplate: rule.clickupTemplate,
      priority: rule.priority,
      agentProfile: rule.agentProfile,
      ruleId: rule.id,
    };
  }

  const fallback = ROUTING_RULES[ROUTING_RULES.length - 1];
  return {
    workType: fallback.workType,
    caseType: fallback.caseType,
    clickupTemplate: fallback.clickupTemplate,
    priority: fallback.priority,
    agentProfile: fallback.agentProfile,
    ruleId: fallback.id,
  };
}
