/**
 * Dispute policy — the judgement layer in front of the letter generator.
 *
 * WHY THIS EXISTS
 *
 * `letters/generator.ts` is a good renderer: give it an item and a round type and
 * it produces correct FCRA/FDCPA language. What it does not do is decide *whether
 * a letter should exist at all*. `recommendRoundSequence()` branches only on
 * `NegativeItemType`, so a 7-year-old paid collection and a correctly-reported
 * late payment from last month get the same treatment.
 *
 * That gap matters twice over. It is bad practice, and it contradicts the owner's
 * own stated rule, recovered from `dispute-process-lawful.md` and now in the
 * knowledge base:
 *
 *   "Hard rule: If an item is accurate, current, and verifiable, it is NOT
 *    disputed. It is coached on (behavior + time). Document for each item:
 *    bureau(s), creditor, the specific factual reason."
 *
 * So this module sits in front of the generator and answers a different question:
 * given what we actually know about this item, what is the right thing to do?
 * Sometimes the answer is "write nothing".
 *
 * THE RULE THIS ENFORCES: no letter is generated without a recorded factual
 * basis. Not a category — a reason. If nobody can say what is wrong with the
 * item, we do not dispute it.
 *
 * All thresholds live in `DisputePolicyConfig` so they are configuration, not
 * code. Values below are marked [STATED] where they come from the owner or from
 * statute, and [OPEN] where they are placeholders awaiting his decision.
 */

import type {
  DisputeRoundType,
  NegativeItem,
  NegativeItemType,
} from "../types";

// ---------------------------------------------------------------------------
// What we know about an item, factually
// ---------------------------------------------------------------------------

/**
 * The specific, recorded reason an item is disputable. This is deliberately a
 * closed set: "it's hurting my score" is not a factual basis, and free text
 * invites exactly that.
 */
export type FactualBasis =
  | "not_mine" // identity error — never held this account
  | "identity_theft" // fraudulent account, FCRA §605B applies
  | "never_late" // payment history misreported
  | "wrong_balance" // amount is incorrect
  | "wrong_dates" // DOFD, open or close date wrong
  | "wrong_status" // e.g. reported open when settled/paid
  | "duplicate" // same debt reported more than once
  | "obsolete" // past the FCRA reporting period
  | "paid_in_full_reported_unpaid"
  | "settled_reported_unsettled"
  | "included_in_bankruptcy"
  | "no_permissible_purpose" // inquiry the consumer never authorised
  | "unverifiable"; // bureau/furnisher could not verify on a prior round

/** What the desk actually knows about accuracy. Unknown is a real answer. */
export type AccuracyAssessment = "accurate" | "inaccurate" | "unknown";

export interface ItemAssessment {
  /** Has a human confirmed whether the item is factually correct? */
  accuracy: AccuracyAssessment;
  /** The recorded factual basis. Required before any letter is produced. */
  basis?: FactualBasis;
  /** Free-text note supporting the basis. Evidence, not justification. */
  basisNote?: string;
  /** Who made the assessment, for the audit trail. */
  assessedBy?: string;
  assessedAt?: string;
  /** Rounds already sent for this item. */
  roundsSent?: DisputeRoundType[];
  /** Did a previous round come back "verified"? */
  previouslyVerified?: boolean;
}

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

export type DisputeAction =
  /** Generate letters, in this order. */
  | "dispute"
  /** Item is accurate — coach the client on behaviour and time instead. */
  | "coach"
  /** We do not know enough yet. Get the missing fact first. */
  | "hold"
  /** Do not dispute this, now or later, for the stated reason. */
  | "refuse";

export interface DisputeDecision {
  action: DisputeAction;
  /** Plain-English reason, safe to show a client or an auditor. */
  rationale: string;
  /** Only present when action === "dispute". */
  sequence?: DisputeRoundType[];
  /** The basis relied on, echoed for the audit trail. */
  basis?: FactualBasis;
  /** What a human should do next when we are not disputing. */
  nextStep?: string;
  /** Which policy rule fired. Makes decisions reviewable. */
  ruleId: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface DisputePolicyConfig {
  /**
   * Refuse to dispute an item assessed as accurate. [STATED — owner]
   * Turning this off would contradict the hard rule above. It exists as a flag
   * only so the refusal is explicit and auditable, not so it can be casually
   * disabled.
   */
  requireInaccuracy: boolean;

  /** No letter without a recorded factual basis. [STATED — owner] */
  requireFactualBasis: boolean;

  /**
   * FCRA §605 reporting periods, in years. [STATED — statute]
   * Most adverse items: 7 years. Chapter 7 bankruptcy: 10.
   */
  reportingPeriodYears: Record<"default" | "bankruptcy" | "inquiry", number>;

  /**
   * Items younger than this (months) and accurate are coaching cases, not
   * dispute cases. [OPEN — owner sets the number]
   */
  freshAccurateItemMonths: number;

  /** Days to wait between rounds. [STATED — statute allows 30 for §611] */
  daysBetweenRounds: number;

  /**
   * Whether `intent_to_litigate` may ever be generated automatically.
   * [STATED — recommended false] A litigation threat is a legal position, not a
   * template. It should be a deliberate human act.
   */
  allowAutomaticLitigationThreat: boolean;

  /** Maximum rounds before the case goes to a human for review. [OPEN] */
  maxRoundsBeforeReview: number;
}

export const DEFAULT_DISPUTE_POLICY: DisputePolicyConfig = {
  requireInaccuracy: true,
  requireFactualBasis: true,
  reportingPeriodYears: { default: 7, bankruptcy: 10, inquiry: 2 },
  freshAccurateItemMonths: 24, // [OPEN]
  daysBetweenRounds: 30,
  allowAutomaticLitigationThreat: false,
  maxRoundsBeforeReview: 4, // [OPEN]
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function monthsSince(iso?: string): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const now = new Date();
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
}

function reportingPeriodFor(itemType: NegativeItemType, cfg: DisputePolicyConfig): number {
  if (itemType === "bankruptcy") return cfg.reportingPeriodYears.bankruptcy;
  if (itemType === "hard_inquiry") return cfg.reportingPeriodYears.inquiry;
  return cfg.reportingPeriodYears.default;
}

/** Is the item past the point where it may lawfully be reported at all? */
export function isObsolete(
  item: NegativeItem,
  cfg: DisputePolicyConfig = DEFAULT_DISPUTE_POLICY
): boolean {
  const months = monthsSince(item.dateOfFirstDelinquency ?? item.dateReported);
  if (months === null) return false;
  return months > reportingPeriodFor(item.itemType, cfg) * 12;
}

// ---------------------------------------------------------------------------
// Sequencing — only reached once the gate has been passed
// ---------------------------------------------------------------------------

/**
 * Which rounds, in which order, for a given basis and item type.
 *
 * This differs from `recommendRoundSequence()` in the generator: it keys on the
 * FACTUAL BASIS first, because the basis is what determines the strongest route.
 * An obsolete item does not need a six-round campaign — it needs one letter
 * citing §605. An identity-theft item has its own statutory path under §605B.
 */
export function sequenceFor(
  basis: FactualBasis,
  itemType: NegativeItemType,
  cfg: DisputePolicyConfig = DEFAULT_DISPUTE_POLICY
): DisputeRoundType[] {
  let seq: DisputeRoundType[];

  switch (basis) {
    case "obsolete":
      // Straightforward statutory violation. Escalate only if ignored.
      seq = ["initial_611", "cfpb_escalation"];
      break;

    case "identity_theft":
    case "not_mine":
      // Identity disputes go hard and early — this is not a negotiation.
      seq = ["initial_611", "method_of_verification", "factual_confrontation", "cfpb_escalation"];
      break;

    case "no_permissible_purpose":
      seq = ["initial_611", "factual_confrontation", "cfpb_escalation"];
      break;

    case "duplicate":
      seq = ["initial_611", "furnisher_623", "cfpb_escalation"];
      break;

    case "unverifiable":
      // Already failed verification once — demand the method.
      seq = ["method_of_verification", "factual_confrontation", "cfpb_escalation"];
      break;

    default:
      // Data-accuracy disputes: bureau first, then the furnisher who supplied it.
      seq = ["initial_611", "method_of_verification", "furnisher_623", "cfpb_escalation"];
  }

  // Collections carry an FDCPA validation right that the bureaus do not.
  // Use it first — it is the cheapest possible win.
  if (itemType === "collection" && !seq.includes("fdcpa_validation")) {
    seq = ["fdcpa_validation", ...seq];
  }

  if (!cfg.allowAutomaticLitigationThreat) {
    seq = seq.filter((r) => r !== "intent_to_litigate");
  }

  return seq;
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

/**
 * Decide what to do with a single negative item.
 *
 * Returns "dispute" only when there is a recorded factual reason to. Every other
 * path returns a rationale that can be shown to the client or an auditor.
 */
export function decideForItem(
  item: NegativeItem,
  assessment: ItemAssessment,
  cfg: DisputePolicyConfig = DEFAULT_DISPUTE_POLICY
): DisputeDecision {
  // 1. Obsolete items are disputable regardless of accuracy — an accurate item
  //    reported beyond its lawful period is still a violation. Checked first so
  //    that a truthful old debt is not sent to coaching.
  if (isObsolete(item, cfg)) {
    return {
      action: "dispute",
      basis: "obsolete",
      sequence: sequenceFor("obsolete", item.itemType, cfg),
      rationale:
        "This item is past the reporting period allowed by FCRA §605, so it should no longer appear regardless of whether it is accurate.",
      ruleId: "obsolete-item",
    };
  }

  // 2. No accuracy assessment yet. We are not guessing.
  if (assessment.accuracy === "unknown") {
    return {
      action: "hold",
      rationale:
        "Nobody has yet confirmed whether this item is accurate, so there is no basis for a dispute.",
      nextStep:
        "Review the item against the client's records and record whether it is accurate, plus the specific factual reason if it is not.",
      ruleId: "accuracy-unknown",
    };
  }

  // 3. THE HARD RULE. Accurate, current and verifiable items are coached on,
  //    never disputed. This is the owner's stated policy and the single most
  //    important line in this file.
  if (cfg.requireInaccuracy && assessment.accuracy === "accurate") {
    const age = monthsSince(item.dateOfFirstDelinquency ?? item.dateReported);
    const fresh = age !== null && age <= cfg.freshAccurateItemMonths;
    return {
      action: "coach",
      rationale:
        "This item appears to be accurate and is still within the period it may lawfully be reported. Disputing an accurate item is not appropriate and does not hold up.",
      nextStep: fresh
        ? "Coach on behaviour and time: on-time payments from here, utilisation down, and let the item age. Set a review date."
        : "Coach on behaviour and time, and diary the date this item becomes obsolete so it can be addressed then.",
      ruleId: "accurate-item-coach-not-dispute",
    };
  }

  // 4. Inaccurate, but nobody wrote down what is wrong with it.
  if (cfg.requireFactualBasis && !assessment.basis) {
    return {
      action: "hold",
      rationale:
        "This item is marked inaccurate, but no specific factual reason has been recorded. A dispute without a stated reason is the kind that comes back verified.",
      nextStep:
        "Record the specific problem — wrong balance, wrong dates, never late, not mine, duplicate, and so on — with a note of the supporting evidence.",
      ruleId: "basis-missing",
    };
  }

  // 5. Escalation ceiling — hand to a human rather than grinding on.
  const sent = assessment.roundsSent?.length ?? 0;
  if (sent >= cfg.maxRoundsBeforeReview) {
    return {
      action: "hold",
      basis: assessment.basis,
      rationale: `This item has already been through ${sent} rounds without resolution.`,
      nextStep:
        "A person should review whether to escalate, change the basis, or stop and tell the client honestly that this one is not moving.",
      ruleId: "max-rounds-reached",
    };
  }

  // 6. Cleared to dispute. Skip any round already sent.
  const full = sequenceFor(assessment.basis as FactualBasis, item.itemType, cfg);
  const remaining = full.filter((r) => !(assessment.roundsSent ?? []).includes(r));

  if (remaining.length === 0) {
    return {
      action: "hold",
      basis: assessment.basis,
      rationale: "Every round in the sequence for this basis has already been sent.",
      nextStep: "Review the outcome with a person before going further.",
      ruleId: "sequence-exhausted",
    };
  }

  return {
    action: "dispute",
    basis: assessment.basis,
    sequence: remaining,
    rationale: `Recorded as inaccurate on the basis of "${assessment.basis}". Disputing on that specific factual ground.`,
    ruleId: "cleared-to-dispute",
  };
}

/**
 * Decide across a whole profile. Returns one decision per item, so the desk can
 * see at a glance what is being disputed, what is being coached, and what is
 * waiting on a fact.
 */
export function decideForProfile(
  items: NegativeItem[],
  assessments: Record<string, ItemAssessment>,
  cfg: DisputePolicyConfig = DEFAULT_DISPUTE_POLICY
): Array<{ item: NegativeItem; decision: DisputeDecision }> {
  return items.map((item) => ({
    item,
    decision: decideForItem(item, assessments[item.id] ?? inferAssessment(item), cfg),
  }));
}

/**
 * Fall back to what the item record already carries.
 *
 * `NegativeItem` already has `isInaccurate`, `isOutdated`, `isUnverifiable` and
 * `inaccuracyDetails`, populated by the import and review screens. Reading those
 * means the policy works on data the desk already collects, rather than demanding
 * a parallel assessment that nobody fills in.
 *
 * Note what this deliberately does NOT do: `isInaccurate === false` is treated as
 * "unknown", not "accurate". An unticked box is not a human saying the item is
 * correct, and the coaching path should only be reached by an actual judgement.
 */
export function inferAssessment(item: NegativeItem): ItemAssessment {
  const roundsSent: DisputeRoundType[] = [];

  if (item.isUnverifiable) {
    return { accuracy: "inaccurate", basis: "unverifiable", basisNote: item.inaccuracyDetails, roundsSent };
  }
  if (item.isOutdated) {
    return { accuracy: "inaccurate", basis: "obsolete", basisNote: item.inaccuracyDetails, roundsSent };
  }
  if (item.isInaccurate) {
    // Marked wrong, but the specific ground is not encoded on the record. The
    // gate will hold for a basis rather than guess one.
    return { accuracy: "inaccurate", basisNote: item.inaccuracyDetails, roundsSent };
  }
  return { accuracy: "unknown", roundsSent };
}

/** Counts for the desk header. */
export function summarise(
  results: Array<{ decision: DisputeDecision }>
): Record<DisputeAction, number> {
  const out: Record<DisputeAction, number> = { dispute: 0, coach: 0, hold: 0, refuse: 0 };
  for (const r of results) out[r.decision.action] += 1;
  return out;
}
