import type { CreditProfile, NegativeItem } from "../types";

export interface FundingReadinessResult {
  score: number; // 0-100
  tier: "not_ready" | "warming" | "almost" | "funding_ready" | "elite";
  avgScore: number | null;
  minScore: number | null;
  activeNegatives: number;
  removedCount: number;
  blockers: string[];
  wins: string[];
  nextSteps: string[];
  ghlTag: string;
}

const FUNDING_THRESHOLDS = {
  minimum: 620,
  good: 680,
  excellent: 720,
  elite: 760,
};

export function assessFundingReadiness(
  profile: CreditProfile,
  items: NegativeItem[]
): FundingReadinessResult {
  const scores = [
    profile.scoreExperian,
    profile.scoreEquifax,
    profile.scoreTransunion,
  ].filter((s): s is number => s !== undefined && s > 0);

  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const minScore = scores.length > 0 ? Math.min(...scores) : null;

  const activeNegatives = items.filter((i) => i.status !== "removed" && i.status !== "closed");
  const removedCount = items.filter((i) => i.status === "removed").length;

  const blockers: string[] = [];
  const wins: string[] = [];
  const nextSteps: string[] = [];

  // Score blockers
  if (minScore === null) {
    blockers.push("No bureau scores on file — pull MyFreeScoreNow report");
  } else if (minScore < FUNDING_THRESHOLDS.minimum) {
    blockers.push(`Lowest score ${minScore} — need ${FUNDING_THRESHOLDS.minimum}+ for most funders`);
  } else if (minScore < FUNDING_THRESHOLDS.good) {
    blockers.push(`Score ${minScore} — subprime tier, limited funding options`);
  } else {
    wins.push(`Score ${minScore}+ meets baseline funder requirements`);
  }

  // Negative item blockers
  const criticalTypes = ["bankruptcy", "foreclosure", "tax_lien", "judgment"];
  const criticalActive = activeNegatives.filter((i) => criticalTypes.includes(i.itemType));
  if (criticalActive.length > 0) {
    blockers.push(`${criticalActive.length} public record(s) still active — most funders require removal`);
  }

  const collections = activeNegatives.filter((i) => i.itemType === "collection");
  if (collections.length > 0) {
    blockers.push(`${collections.length} open collection(s) — dispute or settle before funding`);
  }

  const chargeOffs = activeNegatives.filter((i) => i.itemType === "charge_off");
  if (chargeOffs.length > 2) {
    blockers.push(`${chargeOffs.length} charge-offs — funder may decline`);
  }

  if (activeNegatives.length === 0 && scores.length > 0) {
    wins.push("Zero active negatives — credit file is clean");
  }

  if (removedCount > 0) {
    wins.push(`${removedCount} item(s) successfully removed`);
  }

  // Calculate readiness score
  let score = 0;

  if (minScore !== null) {
    if (minScore >= FUNDING_THRESHOLDS.elite) score += 40;
    else if (minScore >= FUNDING_THRESHOLDS.excellent) score += 35;
    else if (minScore >= FUNDING_THRESHOLDS.good) score += 28;
    else if (minScore >= FUNDING_THRESHOLDS.minimum) score += 18;
    else score += Math.max(0, Math.round((minScore / FUNDING_THRESHOLDS.minimum) * 15));
  }

  const negativePenalty = Math.min(40, activeNegatives.length * 8);
  score += 40 - negativePenalty;

  if (removedCount > 0) score += Math.min(20, removedCount * 5);

  score = Math.max(0, Math.min(100, score));

  let tier: FundingReadinessResult["tier"];
  let ghlTag: string;

  if (score >= 85 && activeNegatives.length === 0) {
    tier = "elite";
    ghlTag = "funding-ready";
    nextSteps.push("Tag GHL: funding-ready — schedule warm intro to AIXMOS funding partner");
    nextSteps.push("Collect handoff package: bank statements, ID, entity docs");
  } else if (score >= 70) {
    tier = "funding_ready";
    ghlTag = "funding-prep";
    nextSteps.push("Tag GHL: funding-prep — begin handoff package collection");
  } else if (score >= 50) {
    tier = "almost";
    ghlTag = "credit-guidance-active";
    nextSteps.push("Continue dispute rounds on remaining negatives");
    nextSteps.push("Re-pull scores in 30 days");
  } else if (score >= 25) {
    tier = "warming";
    ghlTag = "credit-guidance-active";
    nextSteps.push("Run full dispute protocol on all P0 items");
    nextSteps.push("Focus on collections and charge-offs first");
  } else {
    tier = "not_ready";
    ghlTag = "credit-guidance-active";
    nextSteps.push("Enroll in MyFreeScoreNow if not active");
    nextSteps.push("Import full 3-bureau report and run deep audit");
    nextSteps.push("Generate Round 1 letters for all negatives");
  }

  return {
    score,
    tier,
    avgScore,
    minScore,
    activeNegatives: activeNegatives.length,
    removedCount,
    blockers,
    wins,
    nextSteps,
    ghlTag,
  };
}

export function tierLabel(tier: FundingReadinessResult["tier"]): string {
  const labels: Record<FundingReadinessResult["tier"], string> = {
    not_ready: "Not Ready",
    warming: "Warming Up",
    almost: "Almost There",
    funding_ready: "Funding Ready",
    elite: "Elite — Fund Now",
  };
  return labels[tier];
}

export function tierColor(tier: FundingReadinessResult["tier"]): string {
  const colors: Record<FundingReadinessResult["tier"], string> = {
    not_ready: "#ef4444",
    warming: "#f97316",
    almost: "#eab308",
    funding_ready: "#22c55e",
    elite: "#a78bfa",
  };
  return colors[tier];
}
