import type {
  CreditProfile,
  DisputeProtocolConfig,
  DisputeRoundType,
  DisputeStatus,
  NegativeItem,
  RoundStatus,
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
  status: DisputeStatus | RoundStatus;
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

// ─── Legacy ungated path — DISABLED in C1 ─────────────────────────────
//
// generatePendingLetters() / runDisputeProtocol() walked every item through the
// aggressive sequence with deep-audit's first-person "facts" ("I did not authorize…")
// and invented prior attempts, with no accuracy policy in front. The [id] page's
// "Generate next round" button called it, which is how the policy was bypassed.
//
// They now refuse (bodies are in git history at e1b683ff). The only
// sanctioned path is the generateDisputeRound() server action, which runs the
// accuracy policy, the grounding rule and the CROA gate on the server.
export class LegacyProtocolDisabledError extends Error {
  constructor() {
    super("The legacy ungated dispute protocol is disabled. Use the generateDisputeRound server action.");
    this.name = "LegacyProtocolDisabledError";
  }
}
// ─── Generate all pending dispute letters for a client — DISABLED ─────
//
// The pre-C1 bodies of these two functions (and their helpers buildPriorAttempts /
// groupByBureau) are in git history at e1b683ff. They cannot be kept as live code:
// they are the bypass. Anything that needs letters calls generateDisputeRound().

export function generatePendingLetters(
  profile: CreditProfile,
  items: NegativeItem[],
  protocol: DisputeProtocolConfig = AGGRESSIVE_FCRA_PROTOCOL
): DisputeLetterBatch[] {
  void profile;
  void items;
  void protocol;
  throw new LegacyProtocolDisabledError();
}

export function runDisputeProtocol(
  profile: CreditProfile,
  items: NegativeItem[],
  protocol: DisputeProtocolConfig = AGGRESSIVE_FCRA_PROTOCOL
): ProtocolRunResult {
  void profile;
  void items;
  void protocol;
  throw new LegacyProtocolDisabledError();
}

// ─── Score impact estimator ────────────────────────────────────────────
//
// C1 (see CREDIT_SCORE_ESTIMATE_AUDIT.md): a sum of HARD-CODED per-type ranges.
// Not a model, not a prediction, not based on this customer's file beyond item
// types. Owner-desk only; must never be shown to a customer. Shown with
// SCORE_ESTIMATE_DISCLAIMER wherever it appears.
export const SCORE_ESTIMATE_DISCLAIMER =
  "Rough internal heuristic from fixed ranges per item type. Not a prediction or a promise; removal is not assumed.";


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
