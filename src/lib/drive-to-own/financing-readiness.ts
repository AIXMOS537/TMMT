/**
 * AUTO-financing readiness for the Drive-to-Own ladder.
 *
 * Owner, 2026-09-16: a rental lead who opts in to eventually buying creates a profile,
 * pulls their own credit report through MyFreeScoreNow, and the system tells them how far
 * they are from being able to get approved for financing.
 *
 * ── WHY THIS IS NOT `credit-dispute/engine/funding-readiness.ts` ──────────────────────
 * That engine already exists and is good, but it scores readiness for BUSINESS funding —
 * "funders", LLC credit lines. Auto lending is a different underwrite. It weighs a prior
 * repossession far more heavily, it cares about time-on-file and open auto history, and it
 * is tiered on published subprime/prime bands rather than a funder's cutoff. Reusing the
 * business engine here would give a renter a confident number about the wrong question.
 *
 * ── THE TWO RULES THIS FILE OBEYS ─────────────────────────────────────────────────────
 * 1. READINESS IS NOT APPROVAL. A lender decides, and a renter can do everything right and
 *    still be declined. Nothing here returns "approved", "guaranteed" or a probability of
 *    approval. The highest stage is `ready_to_apply`.
 * 2. THE CONSUMER PULLS THEIR OWN REPORT. MyFreeScoreNow is consumer-initiated, so TMMT
 *    never needs FCRA permissible purpose to obtain a report, and no adverse action is
 *    taken from it here — this module only tells the renter where they stand. If a score
 *    from this path is ever used to decline a rental or set a price, that becomes an
 *    adverse action with notice duties. ⚖️ Do not cross that line without counsel.
 */

import type { CreditProfile, NegativeItem } from "@/lib/credit-dispute/types";

/**
 * Published auto-finance credit tiers. These are the industry's descriptive bands, used
 * here to tell a renter which tier they are in — NOT a claim that any particular lender
 * uses these cutoffs. Every lender sets its own.
 */
export const AUTO_SCORE_BANDS = [
  { band: "deep_subprime", min: 0, label: "Deep subprime" },
  { band: "subprime", min: 501, label: "Subprime" },
  { band: "near_prime", min: 601, label: "Near prime" },
  { band: "prime", min: 661, label: "Prime" },
  { band: "super_prime", min: 781, label: "Super prime" },
] as const;

export type ScoreBand = (typeof AUTO_SCORE_BANDS)[number]["band"] | "unknown";

export type FactorState = "strength" | "blocker" | "watch" | "unknown";

export type ReadinessFactor = {
  key: string;
  label: string;
  state: FactorState;
  /** Customer-safe wording. Never promises an outcome, never says "fix your credit". */
  detail: string;
};

export type ReadinessStage =
  | "no_report"       // nothing pulled yet — we know nothing and say so
  | "building"        // real work still to do
  | "close"           // one or two things left
  | "ready_to_apply"; // strong position — still not an approval

export type FinancingReadiness = {
  stage: ReadinessStage;
  band: ScoreBand;
  bandLabel: string;
  avgScore: number | null;
  minScore: number | null;
  bureausReporting: number;
  factors: ReadinessFactor[];
  blockers: ReadinessFactor[];
  strengths: ReadinessFactor[];
  nextSteps: string[];
  /** Always true. A structural reminder for any UI rendering this. */
  approvalIsLenderDecision: true;
};

export type RentalRecord = {
  /** client_journey.good_standing_days — TMMT's own evidence of on-time payment. */
  goodStandingDays: number | null;
  goodStanding: boolean | null;
  /** Whether TMMT furnishes this renter's payments as a tradeline (Rent-to-Credit). */
  paymentsFurnished: boolean | null;
};

export function bandFor(score: number | null): { band: ScoreBand; label: string } {
  if (score === null) return { band: "unknown", label: "Not known yet" };
  let current: (typeof AUTO_SCORE_BANDS)[number] = AUTO_SCORE_BANDS[0];
  for (const b of AUTO_SCORE_BANDS) if (score >= b.min) current = b;
  return { band: current.band, label: current.label };
}

const ACTIVE = (i: NegativeItem) => i.status !== "removed" && i.status !== "closed";

/**
 * Assess where this renter stands for AUTO financing.
 *
 * `profile` may be null — that is the state of every renter who has not yet pulled a
 * report, and it must produce `no_report`, never a bad score.
 */
export function assessFinancingReadiness(
  profile: CreditProfile | null,
  items: NegativeItem[] | null,
  rental: RentalRecord,
): FinancingReadiness {
  const factors: ReadinessFactor[] = [];

  const scores = profile
    ? [profile.scoreExperian, profile.scoreEquifax, profile.scoreTransunion].filter(
        (s): s is number => typeof s === "number" && s > 0,
      )
    : [];

  const avgScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const minScore = scores.length > 0 ? Math.min(...scores) : null;
  const { band, label } = bandFor(minScore);

  // ── 1. The report itself ───────────────────────────────────────────────────────────
  if (scores.length === 0) {
    factors.push({
      key: "report",
      label: "Credit report",
      state: "unknown",
      detail: "No report on file yet. Pull yours through MyFreeScoreNow to get started.",
    });
  } else {
    factors.push({
      key: "report",
      label: "Credit report",
      state: scores.length >= 3 ? "strength" : "watch",
      detail:
        scores.length >= 3
          ? "All three bureaus reporting."
          : `${scores.length} of 3 bureaus reporting — lenders usually look at all three.`,
    });
  }

  // ── 2. Score band ──────────────────────────────────────────────────────────────────
  if (minScore === null) {
    factors.push({
      key: "score_band",
      label: "Score tier",
      state: "unknown",
      detail: "Not known until a report is on file.",
    });
  } else {
    const weak = band === "deep_subprime" || band === "subprime";
    factors.push({
      key: "score_band",
      label: "Score tier",
      state: weak ? "blocker" : band === "near_prime" ? "watch" : "strength",
      // Lenders look at the LOWEST of the three far more often than the average.
      detail: `Lowest bureau score ${minScore} — ${label.toLowerCase()} tier.`,
    });
  }

  // ── 3. Prior repossession — the single heaviest factor in auto lending ─────────────
  const list = items ?? [];
  if (items === null) {
    factors.push({
      key: "repossession",
      label: "Prior repossession",
      state: "unknown",
      detail: "Not known until a report is on file.",
    });
  } else {
    const repos = list.filter(i => ACTIVE(i) && i.itemType === "repossession");
    factors.push({
      key: "repossession",
      label: "Prior repossession",
      state: repos.length > 0 ? "blocker" : "strength",
      detail:
        repos.length > 0
          ? `${repos.length} repossession on file. Auto lenders weigh this heavily — time and a steady payment record are what move it.`
          : "No repossession on file.",
    });
  }

  // ── 4. Public records ──────────────────────────────────────────────────────────────
  if (items === null) {
    factors.push({
      key: "public_records",
      label: "Public records",
      state: "unknown",
      detail: "Not known until a report is on file.",
    });
  } else {
    const publicTypes = new Set(["bankruptcy", "foreclosure", "tax_lien", "judgment"]);
    const found = list.filter(i => ACTIVE(i) && publicTypes.has(i.itemType));
    factors.push({
      key: "public_records",
      label: "Public records",
      state: found.length > 0 ? "blocker" : "strength",
      detail:
        found.length > 0
          ? `${found.length} public record still showing as active.`
          : "No active public records.",
    });
  }

  // ── 5. Collections and charge-offs ─────────────────────────────────────────────────
  if (items === null) {
    factors.push({
      key: "derogatories",
      label: "Collections & charge-offs",
      state: "unknown",
      detail: "Not known until a report is on file.",
    });
  } else {
    const derogs = list.filter(
      i => ACTIVE(i) && (i.itemType === "collection" || i.itemType === "charge_off"),
    );
    factors.push({
      key: "derogatories",
      label: "Collections & charge-offs",
      state: derogs.length === 0 ? "strength" : derogs.length <= 2 ? "watch" : "blocker",
      detail:
        derogs.length === 0
          ? "None showing as active."
          : `${derogs.length} active.`,
    });
  }

  // ── 6. THE TMMT RECORD — the part no competitor can produce ────────────────────────
  // A renter's on-time weekly payments to TMMT are real, documented payment behaviour.
  // Once furnished as a tradeline they appear on the report itself; until then they are
  // still evidence the renter can put in front of a lender.
  if (rental.goodStandingDays === null) {
    factors.push({
      key: "rental_record",
      label: "Your rental payment record",
      state: "unknown",
      detail: "Not tracked yet.",
    });
  } else if (rental.goodStanding === false) {
    factors.push({
      key: "rental_record",
      label: "Your rental payment record",
      state: "blocker",
      detail: "Payments are behind. Getting current is the fastest thing on this list.",
    });
  } else {
    const d = rental.goodStandingDays;
    const furnished = rental.paymentsFurnished === true;
    factors.push({
      key: "rental_record",
      label: "Your rental payment record",
      state: d >= 90 ? "strength" : "watch",
      detail:
        (d >= 90
          ? `${d} days of on-time payments with us.`
          : `${d} days of on-time payments so far.`) +
        (furnished
          ? " These are reported to the bureaus, so they build your file."
          : " Not yet reported to the bureaus."),
    });
  }

  const blockers = factors.filter(f => f.state === "blocker");
  const watches = factors.filter(f => f.state === "watch");
  const strengths = factors.filter(f => f.state === "strength");
  const unknowns = factors.filter(f => f.state === "unknown");

  // ── Stage ──────────────────────────────────────────────────────────────────────────
  // No report is its own stage: we genuinely do not know, and saying "building" would
  // imply a judgement we have not earned.
  let stage: ReadinessStage;
  if (scores.length === 0) {
    stage = "no_report";
  } else if (blockers.length > 0) {
    stage = "building";
  } else if (watches.length > 0 || unknowns.length > 0) {
    stage = "close";
  } else {
    stage = "ready_to_apply";
  }

  const nextSteps: string[] = [];
  if (stage === "no_report") {
    nextSteps.push("Pull your credit report through MyFreeScoreNow so we can see where you stand.");
  }
  for (const b of blockers) nextSteps.push(b.detail);
  if (rental.goodStandingDays !== null && rental.goodStanding !== false && rental.goodStandingDays < 90) {
    nextSteps.push("Keep your rental payments on time — the record builds as you go.");
  }
  if (stage === "ready_to_apply") {
    // Deliberately NOT a restatement of the headline — this is the one piece of advice
    // TMMT can give that no credit app can: the renter is carrying documented, on-time
    // payment history that most applicants in their tier cannot produce.
    nextSteps.push(
      "When you apply, bring your payment record with you — it's documented, on-time history. The lender makes the final decision.",
    );
  }

  return {
    stage,
    band,
    bandLabel: label,
    avgScore,
    minScore,
    bureausReporting: scores.length,
    factors,
    blockers,
    strengths,
    nextSteps,
    approvalIsLenderDecision: true,
  };
}
