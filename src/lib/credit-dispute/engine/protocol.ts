import type {
  CreditProfile,
  DisputeProtocolConfig,
  DisputeRoundType,
  DisputeStatus,
  NegativeItem,
} from "../types";
import { AGGRESSIVE_FCRA_PROTOCOL } from "../types";
import { generateLetter, recommendRoundSequence } from "../letters/generator";
import { deepAuditItem, deepAuditAll, confrontationalFacts, type DeepAuditResult } from "./deep-audit";
import { assessFundingReadiness, type FundingReadinessResult } from "./funding-readiness";

export interface ProtocolRunResult {
  profileId: string;
  itemsProcessed: number;
  lettersGenerated: DisputeLetterBatch[];
  nextActions: string[];
}

export interface DisputeLetterBatch {
  negativeItemId: string;
  furnisherName: string;
  bureau: string;
  roundNumber: number;
  roundType: DisputeRoundType;
  letter: ReturnType<typeof generateLetter>;
  status: DisputeStatus;
}

export interface AuditResult {
  item: NegativeItem;
  recommendedRounds: DisputeRoundType[];
  factualIssues: string[];
  eligible: boolean;
  reason?: string;
  deep?: DeepAuditResult;
}

// Re-export for dashboard
export { assessFundingReadiness, type FundingReadinessResult };
export { deepAuditAll, deepAuditItem, type DeepAuditResult };

// ─── Deep audit of negative items ────────────────────────────────────

export function auditNegativeItem(item: NegativeItem, allItems?: NegativeItem[]): AuditResult {
  const deep = deepAuditItem(item, allItems);
  const factualIssues = confrontationalFacts(deep);

  const recommendedRounds = recommendRoundSequence(item.itemType);

  return {
    item,
    recommendedRounds,
    factualIssues,
    eligible: deep.eligible,
    reason: deep.eligible ? undefined : "Item already resolved",
    deep,
  };
}

// ─── Determine next round for an item ────────────────────────────────

export function getNextRoundType(
  item: NegativeItem,
  protocol: DisputeProtocolConfig = AGGRESSIVE_FCRA_PROTOCOL
): DisputeRoundType | null {
  if (item.status === "removed" || item.status === "closed") return null;

  const sequence = recommendRoundSequence(item.itemType);
  const nextIndex = item.currentRound;

  if (nextIndex >= sequence.length || nextIndex >= protocol.maxRounds) return null;

  return sequence[nextIndex];
}

// ─── Generate all pending dispute letters for a client ────────────────

export function generatePendingLetters(
  profile: CreditProfile,
  items: NegativeItem[],
  protocol: DisputeProtocolConfig = AGGRESSIVE_FCRA_PROTOCOL
): DisputeLetterBatch[] {
  const batches: DisputeLetterBatch[] = [];

  for (const item of items) {
    const audit = auditNegativeItem(item, items);
    if (!audit.eligible) continue;

    const roundType = getNextRoundType(item, protocol);
    if (!roundType) continue;

    const roundNumber = item.currentRound + 1;
    const letter = generateLetter(roundType, profile, item, roundNumber, {
      facts: audit.factualIssues,
      priorAttempts: buildPriorAttempts(item),
    });

    batches.push({
      negativeItemId: item.id,
      furnisherName: item.furnisherName,
      bureau: item.bureau,
      roundNumber,
      roundType,
      letter,
      status: "draft",
    });
  }

  return batches;
}

function buildPriorAttempts(item: NegativeItem): string[] {
  const attempts: string[] = [];
  if (item.currentRound >= 1) attempts.push("Initial FCRA §611 dispute sent");
  if (item.currentRound >= 2) attempts.push("Method of verification demanded");
  if (item.currentRound >= 3) attempts.push("Factual confrontation with specific inaccuracies");
  if (item.currentRound >= 4) attempts.push("Direct furnisher dispute under FCRA §623");
  return attempts;
}

// ─── Full protocol run ───────────────────────────────────────────────

export function runDisputeProtocol(
  profile: CreditProfile,
  items: NegativeItem[],
  protocol: DisputeProtocolConfig = AGGRESSIVE_FCRA_PROTOCOL
): ProtocolRunResult {
  const activeItems = items.filter(
    (i) => i.status !== "removed" && i.status !== "closed"
  );

  const letters = generatePendingLetters(profile, activeItems, protocol);

  const nextActions: string[] = [];

  if (letters.length === 0) {
    nextActions.push("No pending disputes — schedule re-pull in 30-45 days");
  } else {
    nextActions.push(`Review and send ${letters.length} dispute letter(s)`);
    nextActions.push("Mail via certified mail with return receipt");
    nextActions.push("Log tracking numbers in dispute_rounds table");
    nextActions.push("Set 30-day follow-up reminders");
  }

  const bureauGroups = groupByBureau(letters);
  for (const [bureau, count] of Object.entries(bureauGroups)) {
    nextActions.push(`${bureau}: ${count} letter(s) ready`);
  }

  return {
    profileId: profile.id,
    itemsProcessed: activeItems.length,
    lettersGenerated: letters,
    nextActions,
  };
}

function groupByBureau(letters: DisputeLetterBatch[]): Record<string, number> {
  const groups: Record<string, number> = {};
  for (const l of letters) {
    groups[l.bureau] = (groups[l.bureau] ?? 0) + 1;
  }
  return groups;
}

// ─── Score impact estimator ────────────────────────────────────────────

export function estimateScoreImpact(items: NegativeItem[]): {
  estimatedGain: { min: number; max: number };
  byType: Record<string, number>;
} {
  const weights: Record<string, { min: number; max: number }> = {
    collection: { min: 15, max: 45 },
    charge_off: { min: 20, max: 50 },
    late_payment: { min: 5, max: 20 },
    bankruptcy: { min: 50, max: 100 },
    foreclosure: { min: 40, max: 80 },
    hard_inquiry: { min: 2, max: 8 },
    tax_lien: { min: 15, max: 40 },
    judgment: { min: 15, max: 40 },
    medical_debt: { min: 10, max: 30 },
    student_loan: { min: 10, max: 30 },
    other: { min: 5, max: 20 },
  };

  let minTotal = 0;
  let maxTotal = 0;
  const byType: Record<string, number> = {};

  for (const item of items) {
    if (item.status === "removed") continue;
    const w = weights[item.itemType] ?? weights.other;
    minTotal += w.min;
    maxTotal += w.max;
    byType[item.itemType] = (byType[item.itemType] ?? 0) + 1;
  }

  return {
    estimatedGain: { min: minTotal, max: maxTotal },
    byType,
  };
}
