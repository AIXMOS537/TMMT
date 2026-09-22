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
import {
  checkAssertionRequirements,
  missing,
  roundProgress,
  type DecisionContext,
  type MissingFact,
} from "./assertion";

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
  | "reinserted_without_notice" // deleted, then put back without the 5-day notice
  | "dispute_not_notated" // furnisher failed to mark the account as disputed
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
  /**
   * What the importer's heuristics PROPOSE. A suggestion for a person to check,
   * never an assessment: nothing here can unlock a letter.
   */
  suggestion?: { basis?: FactualBasis; note?: string; source: "importer_heuristic" };
}

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

export type DisputeAction =
  /** Generate letters, in this order. */
  | "dispute"
  /** Item is accurate — coach the client on behaviour and time instead. */
  | "coach"
  /** Waiting on the process: a round is in flight, or a person must review. */
  | "hold"
  /** A required fact is missing. Nothing is written until someone records it. */
  | "needs_information"
  /** Do not dispute this, now or later, for the stated reason. */
  | "refuse";

export interface DisputeDecision {
  action: DisputeAction;
  /** Present when action === "needs_information": exactly what to go and get. */
  missing?: MissingFact[];
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
  // C1: the reporting period for delinquent accounts runs from the date of first
  // delinquency. Falling back to `dateReported` (the last-reported date) could call
  // a current item obsolete, or an obsolete one current, and then state it in a
  // letter. Inquiries and bankruptcies are dated by their own reported date.
  const datedByReport = item.itemType === "hard_inquiry" || item.itemType === "bankruptcy";
  const months = monthsSince(datedByReport ? item.dateReported ?? item.dateOfFirstDelinquency : item.dateOfFirstDelinquency);
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
      // Already failed verification once — demand the method. MOV belongs
      // IMMEDIATELY after a verified result, not later in a campaign.
      seq = ["method_of_verification", "factual_confrontation", "cfpb_escalation"];
      break;

    case "reinserted_without_notice":
      // Self-contained violation. One letter, then escalate if ignored.
      seq = ["initial_611", "cfpb_escalation"];
      break;

    case "dispute_not_notated":
      // A furnisher failure — go to the furnisher, not the bureau.
      seq = ["furnisher_623", "cfpb_escalation"];
      break;

    default:
      // Data-accuracy disputes: bureau first, then the furnisher who supplied it.
      seq = ["initial_611", "method_of_verification", "furnisher_623", "cfpb_escalation"];
  }

  // Collections carry an FDCPA validation right that the bureaus do not, and
  // using it first is the cheapest possible win — but only where the argument is
  // actually about the debt.
  //
  // Not for `obsolete`: the ground there is that the item may not be reported at
  // all, which is a bureau matter under 1681c. Asking a collector to validate a
  // debt we are arguing is time-barred from the report concedes the wrong point
  // and delays the right letter.
  //
  // Not for `identity_theft` or `no_permissible_purpose` either: both have their
  // own statutory routes that do not run through debt validation.
  const validationIsBesideThePoint: FactualBasis[] = [
    "obsolete",
    "identity_theft",
    "no_permissible_purpose",
    "reinserted_without_notice",
  ];
  if (
    itemType === "collection" &&
    !validationIsBesideThePoint.includes(basis) &&
    !seq.includes("fdcpa_validation")
  ) {
    seq = ["fdcpa_validation", ...seq];
  }

  if (!cfg.allowAutomaticLitigationThreat) {
    seq = seq.filter((r) => r !== "intent_to_litigate");
  }

  return seq;
}

// ---------------------------------------------------------------------------
// Statutory routes
//
// Recovered from the owner's own letter library (g3 Drive, 2026-09-01) and
// screened: only grounds that rest on a correct reading of the statute are here.
// The theories that did not survive screening are recorded, not deleted, in
// docs/knowledge/QUARANTINE-disputed-legal-theories.md.
//
// A citation is NOT a reason to dispute. It is the route once a factual reason
// exists. The gate below still decides whether a letter should exist at all.
// ---------------------------------------------------------------------------

export interface StatutoryRoute {
  /** The section relied on. */
  citation: string;
  /** Who the letter is aimed at. Getting this wrong invites a one-line dismissal. */
  target: "bureau" | "furnisher" | "collector" | "court";
  /** Plain-English summary, safe to show a client. */
  summary: string;
}

export const STATUTORY_ROUTES: Partial<Record<FactualBasis, StatutoryRoute>> = {
  obsolete: {
    citation: "FCRA 15 U.S.C. 1681c",
    target: "bureau",
    summary:
      "Past the period this may lawfully be reported. Accuracy is irrelevant to this ground.",
  },
  identity_theft: {
    citation: "FCRA 15 U.S.C. 1681c-2 (and 605B)",
    target: "bureau",
    summary:
      "Block within 4 business days on receipt of an identity theft report. Requires an actual report, not merely a denial.",
  },
  not_mine: {
    citation: "FCRA 15 U.S.C. 1681e(b), 1681i(5)",
    target: "bureau",
    summary: "Reported against the wrong consumer; maximum possible accuracy not met.",
  },
  never_late: {
    citation: "FCBA 15 U.S.C. 1666b",
    target: "furnisher",
    summary:
      "Billing error: payment was made on time and reported late. Valid ONLY where the payment genuinely was on time.",
  },
  wrong_balance: {
    citation: "FCRA 15 U.S.C. 1681e(b), 1681i(5)",
    target: "bureau",
    summary: "A specific field is wrong. Name the field, not the account generally.",
  },
  wrong_dates: {
    citation: "FCRA 15 U.S.C. 1681e(b), 1681i(5)",
    target: "bureau",
    summary: "Date of first delinquency, open or close date misreported.",
  },
  wrong_status: {
    citation: "FCRA 15 U.S.C. 1681e(b), 1681i(5)",
    target: "bureau",
    summary: "Status misreported, e.g. open when settled or paid.",
  },
  duplicate: {
    citation: "FCRA 15 U.S.C. 1681e(b), 1681s-2",
    target: "furnisher",
    summary: "The same debt appears more than once.",
  },
  paid_in_full_reported_unpaid: {
    citation: "FCRA 15 U.S.C. 1681e(b), 1681s-2",
    target: "furnisher",
    summary: "Paid, still reported as owing.",
  },
  settled_reported_unsettled: {
    citation: "FCRA 15 U.S.C. 1681e(b), 1681s-2",
    target: "furnisher",
    summary: "Settled, still reported as outstanding.",
  },
  included_in_bankruptcy: {
    citation: "FCRA 15 U.S.C. 1681e(b)",
    target: "furnisher",
    summary: "Discharged in bankruptcy but still reported as an active balance.",
  },
  no_permissible_purpose: {
    citation: "FCRA 15 U.S.C. 1681b",
    target: "bureau",
    summary:
      "Inquiry the consumer did not authorise. Scope is INQUIRIES - do not extend this to tradelines the consumer opened.",
  },
  reinserted_without_notice: {
    citation: "FCRA 15 U.S.C. 1681i(5)(B)(ii)-(iii)",
    target: "bureau",
    summary:
      "Deleted, then reinserted without notice to the consumer within 5 business days. Easy to evidence and frequently missed.",
  },
  dispute_not_notated: {
    citation: "FCRA 15 U.S.C. 1681s-2 (collections: FDCPA 15 U.S.C. 1692e(8))",
    target: "furnisher",
    summary:
      "Failed to mark the account as disputed within 30 days. Aim at the furnisher, never the bureau.",
  },
  unverifiable: {
    citation: "FCRA 15 U.S.C. 1681i(7), then 1681i(5)(A)",
    target: "bureau",
    summary:
      "Demand the method of verification: original creditor name, address, phone, WHO verified it, and the documents used. An agency that verified via an automated code match usually cannot answer, which makes the item unverifiable under 1681i(5)(A).",
  },
};

/** The citation and target for a ground, if one is defined. */
export function routeFor(basis: FactualBasis): StatutoryRoute | undefined {
  return STATUTORY_ROUTES[basis];
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
  cfg: DisputePolicyConfig = DEFAULT_DISPUTE_POLICY,
  ctx: DecisionContext = {}
): DisputeDecision {
  // 0. Round progression. Nothing new is written while a round is in flight, and a
  //    follow-up needs a recorded response plus a documented reason — never just
  //    "the first letter did not get the result we wanted".
  const progress = roundProgress(ctx.history);
  if (progress.kind === "in_progress") {
    return {
      action: "hold",
      basis: assessment.basis,
      rationale: `Round ${progress.roundNumber} for this item is ${progress.status.replace("_", " ")}. Nothing further is written until it is resolved.`,
      nextStep: "Finish the current round: review it, send it, and record the response when it arrives.",
      ruleId: "round-in-progress",
    };
  }
  if (progress.kind === "resolved") {
    return {
      action: "hold",
      basis: assessment.basis,
      rationale: `The last response recorded for this item was "${progress.outcome}". No further round is needed.`,
      nextStep: "Confirm the change on the next report pull and close the item.",
      ruleId: "resolved-by-response",
    };
  }
  if (progress.kind === "needs_information") {
    return {
      action: "needs_information",
      basis: assessment.basis,
      missing: progress.missing,
      rationale: "A follow-up round needs a recorded response and a documented reason first.",
      nextStep: progress.missing.map((m) => m.message).join(" "),
      ruleId: "follow-up-basis-missing",
    };
  }

  // 1. Obsolete items are disputable regardless of accuracy — an accurate item
  //    reported beyond its lawful period is still a violation. Checked first so
  //    that a truthful old debt is not sent to coaching. The claim is derived from
  //    the report's own dates, so it needs no customer assertion.
  if (isObsolete(item, cfg)) {
    const already = (ctx.history ?? []).map((h) => h.roundType);
    const seq = sequenceFor("obsolete", item.itemType, cfg).filter((r) => !already.includes(r));
    if (seq.length === 0) {
      return {
        action: "hold",
        basis: "obsolete",
        rationale: "Every round in the sequence for an obsolete item has already been sent.",
        nextStep: "Review the outcome with a person before going further.",
        ruleId: "sequence-exhausted",
      };
    }
    return {
      action: "dispute",
      basis: "obsolete",
      sequence: seq,
      rationale:
        "This item is past the reporting period allowed by FCRA §605, so it should no longer appear regardless of whether it is accurate.",
      ruleId: "obsolete-item",
    };
  }

  // 2. No accuracy assessment yet. We are not guessing.
  if (assessment.accuracy === "unknown") {
    return {
      action: "needs_information",
      missing: [missing("accuracy_call")],
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
      action: "needs_information",
      missing: [missing("factual_basis")],
      rationale:
        "This item is marked inaccurate, but no specific factual reason has been recorded. A dispute without a stated reason is the kind that comes back verified.",
      nextStep:
        "Record the specific problem — wrong balance, wrong dates, never late, not mine, duplicate, and so on — with a note of the supporting evidence.",
      ruleId: "basis-missing",
    };
  }

  // 4b. THE GROUNDING RULE. Letters speak in the customer's first person. Every
  //     factual claim must trace to something the customer actually said (and
  //     confirmed), a document on file, or our own recorded round history. A basis
  //     picked by an operator is a judgement, not the customer's claim.
  const gaps = checkAssertionRequirements(assessment.basis as FactualBasis, ctx);
  if (gaps.length > 0) {
    return {
      action: "needs_information",
      basis: assessment.basis,
      missing: gaps,
      rationale:
        "The ground is recorded, but the facts a letter would state in the customer's name are not all on file yet.",
      nextStep: gaps.map((g) => g.message).join(" "),
      ruleId: "grounding-missing",
    };
  }

  // 5. Escalation ceiling — hand to a human rather than grinding on.
  //    Rounds come from the STORED history when we have it (C1): the old
  //    `assessment.roundsSent` was never updated after a round was stored, which is
  //    why the engine kept producing round 1.
  const sentTypes: DisputeRoundType[] = ctx.history
    ? ctx.history.map((h) => h.roundType)
    : assessment.roundsSent ?? [];
  const sent = sentTypes.length;
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
  const remaining = full.filter((r) => !sentTypes.includes(r));

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
  cfg: DisputePolicyConfig = DEFAULT_DISPUTE_POLICY,
  contexts: Record<string, DecisionContext> = {}
): Array<{ item: NegativeItem; decision: DisputeDecision }> {
  return items.map((item) => ({
    item,
    decision: decideForItem(item, assessments[item.id] ?? inferAssessment(item), cfg, contexts[item.id]),
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
 *
 * C1 CHANGE: the flags are importer HEURISTICS (e.g. "closed with a balance"), not
 * anyone's statement. They used to come back as `accuracy: "inaccurate"` with a
 * basis, which let a heuristic unlock a letter nobody asked for. They now come back
 * as `unknown` with a `suggestion` a person can accept or reject. An item past its
 * reporting period is still caught — by `isObsolete()` on the report's own dates,
 * not by this flag.
 */
export function inferAssessment(item: NegativeItem): ItemAssessment {
  const roundsSent: DisputeRoundType[] = [];
  const note = item.inaccuracyDetails;

  if (item.isUnverifiable) {
    return { accuracy: "unknown", roundsSent, suggestion: { basis: "unverifiable", note, source: "importer_heuristic" } };
  }
  if (item.isOutdated) {
    return { accuracy: "unknown", roundsSent, suggestion: { basis: "obsolete", note, source: "importer_heuristic" } };
  }
  if (item.isInaccurate) {
    return { accuracy: "unknown", roundsSent, suggestion: { note, source: "importer_heuristic" } };
  }
  return { accuracy: "unknown", roundsSent };
}

/** Counts for the desk header. */
export function summarise(
  results: Array<{ decision: DisputeDecision }>
): Record<DisputeAction, number> {
  const out: Record<DisputeAction, number> = { dispute: 0, coach: 0, hold: 0, needs_information: 0, refuse: 0 };
  for (const r of results) out[r.decision.action] += 1;
  return out;
}
