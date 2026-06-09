export const JOURNEY_CHECKPOINTS = [
  "credit_education_acknowledged",
  "credit_enrollment_active",
  "training_path_started",
  "training_core_complete",
  "mentorship_dfy_active",
  "day_90_good_standing",
  "lto_eligible",
  "vehicle_turnover_complete",
] as const;

export type JourneyCheckpointSlug = (typeof JOURNEY_CHECKPOINTS)[number];

export const CREDIT_PATHS = ["monthly_97", "payment_plan_500", "mentorship_dfy_1000"] as const;
export type CreditPath = (typeof CREDIT_PATHS)[number];

export const BASE_CREDIT_PATHS = ["monthly_97", "payment_plan_500"] as const;
export type BaseCreditPath = (typeof BASE_CREDIT_PATHS)[number];

export const OPERATOR_LEVELS = ["candidate", "certified", "senior", "master"] as const;
export type OperatorLevel = (typeof OPERATOR_LEVELS)[number];

/** GHL Operator Activation Pipeline — 8 stages (PDF framework). */
export const OPERATOR_GHL_STAGES = [
  "Identified",
  "Warmed",
  "Discovery scheduled",
  "Discovery complete",
  "Certified",
  "Agreement signed",
  "Onboarding",
  "First revenue",
] as const;
export type OperatorGhlStage = (typeof OPERATOR_GHL_STAGES)[number];

export const OPERATOR_REVENUE_SHARE: Record<OperatorLevel, number> = {
  candidate: 35,
  certified: 35,
  senior: 30,
  master: 25,
};

/** PDF: VA Elevation §07 — Operator Identification Rubric (100 pts). */
export const RUBRIC_CATEGORIES = [
  "consistent_results",
  "community_leadership",
  "platform_engagement",
  "coachability",
  "communication_skill",
  "network_audience",
  "financial_readiness",
] as const;

export type RubricCategory = (typeof RUBRIC_CATEGORIES)[number];

export const RUBRIC_CATEGORY_MAX: Record<RubricCategory, number> = {
  consistent_results: 20,
  community_leadership: 15,
  platform_engagement: 15,
  coachability: 15,
  communication_skill: 15,
  network_audience: 10,
  financial_readiness: 10,
};

export type ClientJourneyRow = {
  id: string;
  profile_id: string | null;
  customer_email: string;
  program_track: string;
  good_standing: boolean;
  good_standing_since: string | null;
  good_standing_days: number;
  lto_eligible: boolean;
};

export type CreditBillingPlan = {
  id: string;
  credit_path: CreditPath;
  status: string;
  is_add_on: boolean;
  amount_cents: number;
  monthly_fee_cents: number | null;
  next_billing_at: string | null;
  due_at: string | null;
  paid_at: string | null;
};

export type JourneyHub = {
  journey: ClientJourneyRow | null;
  checkpoints: { slug: string; title: string; met_at: string | null }[];
  creditPlans: CreditBillingPlan[];
  education: {
    sections: { id: string; title: string; body_md: string; acknowledged: boolean }[];
    allAcknowledged: boolean;
  };
  training: {
    modules: {
      id: string;
      slug: string;
      title: string;
      summary: string | null;
      is_core: boolean;
      percent_complete: number;
      completed_at: string | null;
    }[];
    coreComplete: boolean;
    coreDone: number;
    coreTotal: number;
  };
  lto: {
    eligible: boolean;
    agreements: { id: string; status: string; vin: string | null }[];
  };
  operator: {
    profile: {
      level: string;
      rubric_score: number;
      revenue_share_pct: number;
    } | null;
    candidateUnlocked: boolean;
  };
  gates: {
    basePathSatisfied: boolean;
    educationComplete: boolean;
    trainingComplete: boolean;
    day90GoodStanding: boolean;
  };
};
