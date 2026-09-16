/**
 * Partner economics — ported from Airtable `Partner Acquisition` (`tblDL6VOeRmjddRNX`).
 *
 * Source of record: `docs/business-rules/04-partner-economics.md`.
 * Formulas read verbatim from the live field configs on 2026-09-15.
 *
 * WHY THIS MODULE REFUSES RATHER THAN DEFAULTS
 * 36 of 43 fleet vehicles have NO partner percentage recorded (VERIFIED). Partner churn was the
 * mechanism by which the original business failed, and opacity was the cause. A payout function
 * that quietly treats a missing split as 0 — or as "probably 70%" — misstates what a partner is
 * owed. Every entry point here throws instead.
 */

import {
  WEEKS_PER_MONTH,
  and,
  concatenate,
  eq,
  ifThen,
  isBlank,
  neq,
  not,
  truthy,
} from "./airtable-semantics";
import { MissingInputError, type Maybe } from "./types";

/** Verified values on file: 0.60, 0.65, 0.70. Stored as a decimal, never an integer percent. */
export type PartnerPercentage = number;

/** `Commercial Use Cleared` (`fldw3r8slJLYtKd9B`). Note the EN DASH in "Yes – Verified". */
export type CommercialUseCleared = "Yes – Verified" | "In Review" | "No" | "Unknown";

/** `Finance Status` on Partner Acquisition (`fld6E019PPJLBOoyx`). */
export type PartnerFinanceStatus = "Paid Off" | "Financed" | "Leased" | "Unknown";

/**
 * Validate a partner split before it is used in any money calculation.
 *
 * Guards the integer-percent mistake (70 instead of 0.70) — `docs/business-rules/04` records
 * that the value is a decimal, and a silent 100x error here is a payout catastrophe.
 */
function assertPartnerPercentage(pct: Maybe<PartnerPercentage>, context: string): PartnerPercentage {
  if (isBlank(pct) || pct === null) {
    throw new MissingInputError(
      "partner_percentage",
      `${context} requires an explicit partner split. 36 of 43 fleet vehicles have none recorded; ` +
        `the owner must supply the real split per vehicle or mark the vehicle explicitly as ` +
        `"no partner". Defaulting a missing split would misstate what a partner is owed. ` +
        `See docs/business-rules/04-partner-economics.md §4.1.`,
    );
  }
  if (!Number.isFinite(pct)) {
    throw new MissingInputError("partner_percentage", `${context} received a non-finite split.`);
  }
  if (pct > 1) {
    throw new MissingInputError(
      "partner_percentage",
      `${context} received ${pct}. Partner Percentage is a DECIMAL (0.70), not an integer percent ` +
        `(70). See docs/business-rules/04 and the plan's §3.3 precision note.`,
    );
  }
  if (pct < 0) {
    throw new MissingInputError("partner_percentage", `${context} received a negative split (${pct}).`);
  }
  return pct;
}

function assertWeeklyRate(rate: Maybe<number>, context: string): number {
  if (isBlank(rate) || rate === null) {
    throw new MissingInputError("target_weekly_rate", `${context} requires a target weekly rate.`);
  }
  if (!Number.isFinite(rate) || rate < 0) {
    throw new MissingInputError("target_weekly_rate", `${context} received an invalid rate (${rate}).`);
  }
  return rate;
}

/**
 * `Owner Payout / Week` — `fldWGmP5UZjvjyUtB`
 * Legacy formula: `{Target Weekly Rate} * {Proposed Partner %}`
 *
 * "What the owner earns per week at full occupancy. This is the number you say out loud in
 * the pitch."
 *
 * ASSUMES FULL OCCUPANCY. See `expectedPartnerPayoutCaveat`.
 */
export function ownerPayoutPerWeek(
  targetWeeklyRate: Maybe<number>,
  partnerPercentage: Maybe<PartnerPercentage>,
): number {
  const rate = assertWeeklyRate(targetWeeklyRate, "ownerPayoutPerWeek");
  const pct = assertPartnerPercentage(partnerPercentage, "ownerPayoutPerWeek");
  return rate * pct;
}

/**
 * `TMMT Gross / Week` — `fldQMrTrL4q8WIf9s`
 * Legacy formula: `{Target Weekly Rate} * (1 - {Proposed Partner %})`
 *
 * The legacy field description is worth preserving verbatim, because it is the honest part:
 * "Before insurance, maintenance, claims, downtime and ops cost — this is NOT profit."
 */
export function tmmtGrossPerWeek(
  targetWeeklyRate: Maybe<number>,
  partnerPercentage: Maybe<PartnerPercentage>,
): number {
  const rate = assertWeeklyRate(targetWeeklyRate, "tmmtGrossPerWeek");
  const pct = assertPartnerPercentage(partnerPercentage, "tmmtGrossPerWeek");
  return rate * (1 - pct);
}

/**
 * `Owner Net After Note / Month` — `fldeXzDb1UK5D443W`
 * Legacy formula:
 *   `IF({rate}, ({rate} * {pct} * 4.33) - IF({note}, {note}, 0))`
 *
 * Returns **null** when the rate is blank — the legacy IF has no else branch, so it yields
 * BLANK, and blank must not surface as a payout of 0.
 *
 * "If this is near zero or negative, the partner quits in month 2 — do not onboard on those
 * terms." That is the churn rule the business already knew. It is ADVISORY in the legacy
 * system — nothing blocked onboarding. See `partnerChurnRisk`.
 */
export function ownerNetAfterNotePerMonth(
  targetWeeklyRate: Maybe<number>,
  partnerPercentage: Maybe<PartnerPercentage>,
  monthlyNotePayment: Maybe<number>,
): number | null {
  // Faithful to the legacy IF: blank rate yields blank, not zero.
  if (!truthy(targetWeeklyRate)) return null;

  const rate = assertWeeklyRate(targetWeeklyRate, "ownerNetAfterNotePerMonth");
  const pct = assertPartnerPercentage(partnerPercentage, "ownerNetAfterNotePerMonth");
  const note = ifThen(truthy(monthlyNotePayment), monthlyNotePayment as number, 0);

  return rate * pct * WEEKS_PER_MONTH - note;
}

/**
 * The churn rule, made explicit.
 *
 * BUSINESS POLICY NOTE: the legacy system states the rule qualitatively ("near zero or
 * negative") but never encodes a threshold. `nearZeroThreshold` therefore has NO default — the
 * caller must supply the owner's number. Passing one is a business decision, not a code default.
 */
export function partnerChurnRisk(
  ownerNetPerMonth: number | null,
  nearZeroThreshold: number,
): "unknown" | "negative" | "near_zero" | "acceptable" {
  if (ownerNetPerMonth === null) return "unknown";
  if (ownerNetPerMonth < 0) return "negative";
  if (ownerNetPerMonth <= nearZeroThreshold) return "near_zero";
  return "acceptable";
}

/**
 * All three payout formulas assume 100% occupancy and model no downtime.
 *
 * A partner-facing earnings view built on them WILL overstate expected income, which is
 * precisely the expectation gap that produces churn. Phase 6's partner earnings view must use
 * actual collected revenue, not these projections.
 */
export const expectedPartnerPayoutCaveat =
  "Projection at full occupancy. Excludes downtime, claims, maintenance and ops cost. " +
  "Not a statement of actual earnings.";

// ---------------------------------------------------------------------------------
// Onboarding gate
// ---------------------------------------------------------------------------------

export type GateCheckInput = {
  commercialUseCleared: Maybe<CommercialUseCleared>;
  titleInOwnersName: Maybe<boolean>;
  financeStatus: Maybe<PartnerFinanceStatus>;
};

export type GateCheckResult = {
  /** Exactly what the legacy formula rendered: "CLEAR", or blocker flags with trailing spaces. */
  legacyValue: string;
  clear: boolean;
  /** The structured form TMMT should actually use. */
  blockers: Array<"INSURANCE" | "TITLE" | "FINANCE">;
  /** Set when the port reproduced a latent defect in the legacy rule. See below. */
  fidelityWarning?: string;
};

/**
 * `⚠️ Gate Check` — `fldTvOKWnkeYtUwja`
 * "Hard stops before a car can go live. Must read CLEAR."
 *
 * Legacy formula, verbatim:
 * ```
 * IF(AND({Commercial Use Cleared} = "Yes – Verified",
 *        {Title in Owner's Name},
 *        {Finance Status} != "Leased",
 *        {Finance Status} != "Unknown"),
 *    "CLEAR",
 *    CONCATENATE(IF({Commercial Use Cleared} != "Yes – Verified", "INSURANCE ", ""),
 *                IF(NOT({Title in Owner's Name}), "TITLE ", ""),
 *                IF(OR({Finance Status} = "Leased", {Finance Status} = "Unknown"), "FINANCE ", "")))
 * ```
 *
 * ⚠️ FIDELITY FINDING — reproduced deliberately, not fixed.
 * A **blank** Finance Status passes the finance test: `blank != "Leased"` is TRUE and
 * `blank != "Unknown"` is TRUE. So a vehicle with no Finance Status recorded reads CLEAR on a
 * gate whose stated purpose is a hard stop, and the CONCATENATE branch never flags it either.
 *
 * The business's own note on `Commercial Use Cleared` explains the stakes: "A personal auto
 * policy generally voids the moment the car is rented for money."
 *
 * This is documented rather than silently corrected (`docs/business-rules/` README). Whether a
 * blank Finance Status should block is a BUSINESS POLICY decision — surfaced via
 * `fidelityWarning` so a caller cannot miss it.
 */
export function gateCheck(input: GateCheckInput): GateCheckResult {
  const { commercialUseCleared, titleInOwnersName, financeStatus } = input;

  const clear = and(
    eq(commercialUseCleared, "Yes – Verified"),
    titleInOwnersName,
    neq(financeStatus, "Leased"),
    neq(financeStatus, "Unknown"),
  );

  const legacyValue = clear
    ? "CLEAR"
    : concatenate(
        ifThen(neq(commercialUseCleared, "Yes – Verified"), "INSURANCE ", ""),
        ifThen(not(titleInOwnersName), "TITLE ", ""),
        ifThen(
          eq(financeStatus, "Leased") || eq(financeStatus, "Unknown"),
          "FINANCE ",
          "",
        ),
      );

  const blockers: GateCheckResult["blockers"] = [];
  if (neq(commercialUseCleared, "Yes – Verified")) blockers.push("INSURANCE");
  if (not(titleInOwnersName)) blockers.push("TITLE");
  if (eq(financeStatus, "Leased") || eq(financeStatus, "Unknown")) blockers.push("FINANCE");

  const result: GateCheckResult = { legacyValue, clear, blockers };

  if (isBlank(financeStatus)) {
    result.fidelityWarning =
      "Finance Status is blank. The legacy gate treats blank as passing the finance check " +
      "(blank != 'Leased' and blank != 'Unknown' are both true), so this reads CLEAR without " +
      "the finance status ever having been established. Reproduced for fidelity. Whether blank " +
      "should block is BUSINESS POLICY REQUIRED — see docs/business-rules/04 §4.4.";
  }

  return result;
}
