/**
 * Eligibility & screening — ported from Airtable `Background Checks` (`tbl1OFZh3cMXytNZM`).
 *
 * Source of record: `docs/business-rules/01-eligibility-and-screening.md`.
 *
 * REUSES THE EXISTING DECISION ARCHITECTURE — it does not rebuild it.
 * `@/lib/bg-check-decisions` is the one source for `background_checks.eligibility_status`, and
 * the `bg_check_decide` RPC is the write path. CLAUDE.md is explicit: complete the existing
 * decision architecture, do not rebuild it. This module adds only what was missing — the
 * interpretation of legacy Airtable values, and an explicit refusal where no rule exists.
 *
 * THE CENTRAL FACT ABOUT THIS MODULE
 * There is no decision logic to port, and (VERIFIED 2026-09-22) there is no data to derive one
 * from either. The three screening signals are populated on **ZERO records in both systems**:
 * Background Check Status 0/304 Airtable and 0/299 Supabase, same for Insurance Check and
 * Earnings Verification. Both sides agree at zero, so this is not a migration failure — the
 * three-signal model was designed and never used.
 *
 * Corroborating: Airtable's `Eligibility Status` is a plain `singleSelect` with no formula, and
 * `bg_check_decide` RECORDS a staff decision rather than computing one.
 *
 * So 233 decisions were made entirely outside the system with only the verdict written down.
 * No truth table can be derived from this data even in principle. `decideEligibility()` refuses,
 * and the owner is being asked to DESIGN the policy, not recall it —
 * `docs/decisions/OWNER-DECISION-PACK.md` §1.
 */

import {
  BG_DECISION,
  type BgCheckDecision,
} from "@/lib/bg-check-decisions";
import { isBlank } from "./airtable-semantics";
import { BusinessPolicyRequiredError, type Maybe } from "./types";

const DOC = "docs/business-rules/01-eligibility-and-screening.md";

/** All three screening signals share this vocabulary. */
export type SignalStatus = "Pending" | "Verified" | "Failed";

export type ScreeningSignals = {
  backgroundCheck: Maybe<SignalStatus>;
  insuranceCheck: Maybe<SignalStatus>;
  earningsVerification: Maybe<SignalStatus>;
};

/** Canonical verdict TMMT should use going forward, separate from the reason. */
export type EligibilityVerdict = "eligible" | "not_eligible" | "manager_review";

/**
 * The data-entry artefact on Airtable's `Eligibility Status` (`fld1j6ktvWAjDTy9K`): a truncated
 * "out of radius" that became a permanent select option because Airtable creates a choice on
 * free typing.
 *
 * ⚠️ It is NOT one of the five canonical `BG_CHECK_DECISIONS`, and `bg_check_decide` rejects it
 * outright — VERIFIED against the live function definition.
 *
 * CORRECTION (2026-09-22): an earlier note here called this a migration blocker. It is not.
 * VERIFIED: **zero records** carry `ou` in Airtable (`out of radius` has 49, matching Supabase
 * exactly). The option exists and is selectable, so it remains a forward-looking data-entry
 * hazard, but there is nothing to reclassify.
 */
export const LEGACY_ELIGIBILITY_ARTEFACT = "ou";

export type NormalizedEligibility = {
  verdict: Maybe<EligibilityVerdict>;
  /** Separated from the verdict: the legacy field conflated status with reason. */
  reasonCode: Maybe<"out_of_radius" | "not_found">;
  /** Set when the source value was a data-quality artefact rather than a real state. */
  dataQualityFlag?: string;
};

/**
 * Interpret a legacy `Eligibility Status` value.
 *
 * Does NOT decide eligibility — it reads what an operator recorded and splits the conflated
 * status/reason into two fields.
 *
 * `out of radius` and `Not found` describe WHY a decision was reached, not WHAT it was, so
 * neither yields a verdict. Mapping them to a verdict would be inventing a rule.
 */
export function normalizeEligibilityStatus(
  value: Maybe<BgCheckDecision | string>,
): NormalizedEligibility {
  if (isBlank(value) || value === null) {
    return { verdict: null, reasonCode: null };
  }

  switch (value) {
    case BG_DECISION.eligible:
      return { verdict: "eligible", reasonCode: null };
    case BG_DECISION.notEligible:
      return { verdict: "not_eligible", reasonCode: null };
    case BG_DECISION.needsReview:
      return { verdict: "manager_review", reasonCode: null };

    case BG_DECISION.outOfRadius:
      return { verdict: null, reasonCode: "out_of_radius" };

    case LEGACY_ELIGIBILITY_ARTEFACT:
      return {
        verdict: null,
        reasonCode: "out_of_radius",
        dataQualityFlag:
          `Source value was "${LEGACY_ELIGIBILITY_ARTEFACT}", a truncated "${BG_DECISION.outOfRadius}" ` +
          `that became a permanent select option, and bg_check_decide REJECTS it — it is not one ` +
          `of the five canonical decisions. VERIFIED 2026-09-22: zero records currently carry it, ` +
          `so this is a forward-looking entry hazard, not a backlog to reclassify. See ${DOC} §1.2.`,
      };

    case BG_DECISION.notFound:
      return {
        verdict: null,
        reasonCode: "not_found",
        dataQualityFlag:
          `"${BG_DECISION.notFound}" is ambiguous — record not found, or person not found? ` +
          `Meaning must be established with the owner before this maps to anything. See ${DOC} §1.2.`,
      };

    default:
      return {
        verdict: null,
        reasonCode: null,
        dataQualityFlag: `Unrecognised legacy eligibility value: ${JSON.stringify(value)}.`,
      };
  }
}

/**
 * Interpret the legacy `Own Insurance?` field (`fld6ATelA6miatxNr`).
 *
 * VERIFIED: five options exist for a yes/no question — `Yes`, `No`, `Y`, `N`, `lno`
 * (a slipped keystroke). Any logic reading `= "Yes"` missed every `Y`.
 *
 * Interpretation only. Rewriting the stored values is a data change and needs a change request.
 */
export function normalizeOwnInsurance(value: Maybe<string>): Maybe<boolean> {
  if (isBlank(value) || value === null) return null;
  switch (value) {
    case "Yes":
    case "Y":
      return true;
    case "No":
    case "N":
    case "lno":
      return false;
    default:
      return null;
  }
}

/**
 * Decide eligibility from the three screening signals.
 *
 * ALWAYS THROWS. The truth table does not exist anywhere in the system — not in Airtable, and
 * not in `bg_check_decide`, which records a human's decision rather than computing one.
 *
 * To make this function work, the owner must state — in writing — what combination of
 * Background Check / Insurance Check / Earnings Verification produces each of the canonical
 * decisions, including the combinations that were treated as borderline. Until then every
 * caller is refused, loudly, at the point of use.
 *
 * Do not "temporarily" implement a plausible default here. A guessed threshold silently changes
 * who is allowed to rent a car.
 */
export function decideEligibility(_signals: ScreeningSignals): BgCheckDecision {
  throw new BusinessPolicyRequiredError(
    "eligibility_truth_table",
    DOC,
    "Eligibility was set by a human and no rule connects the three screening signals " +
      "(Background Check / Insurance Check / Earnings Verification) to a decision. " +
      "Those three signals are populated on ZERO records in both Airtable and Supabase, so no " +
      "rule can be derived from the history even in principle. bg_check_decide records a staff " +
      "decision; it does not compute one. See docs/decisions/OWNER-DECISION-PACK.md section 1.",
  );
}

/**
 * Which documents screening collected. Whether any are MANDATORY to reach a positive decision
 * is unestablished: 283 of 304 records carry a licence and 269 carry a paystub, so records were
 * advanced without a complete set.
 */
export function requiredScreeningDocuments(): never {
  throw new BusinessPolicyRequiredError(
    "mandatory_screening_documents",
    DOC,
    "The legacy system collected driver's licence, paystub, proof of insurance and a " +
      "background-check screenshot, but never enforced which are mandatory — records were " +
      "advanced with incomplete sets. This also scopes the Phase 2 retention question.",
  );
}
