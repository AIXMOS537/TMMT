/**
 * TMMT native rules engine.
 *
 * Workstream B, P0 #1 (`TMMT-AIRTABLE-CAPABILITY-MATRIX.md` §5, §6).
 * Ports the business logic recovered from Airtable formula fields into tested TMMT code.
 *
 * Two invariants hold across every module here:
 *
 *  1. **Fidelity over tidiness.** Where the legacy system encoded a rule, this reproduces what
 *     it ACTUALLY did — including its defects, which are reported via warnings rather than
 *     silently corrected.
 *  2. **Refuse rather than guess.** Where the legacy system never encoded a rule, the function
 *     throws `BusinessPolicyRequiredError`. A missing rule is not permission to default.
 *
 * Coverage status against `docs/business-rules/`:
 *
 * | Doc | Domain                    | Status                                              |
 * |-----|---------------------------|-----------------------------------------------------|
 * | 01  | Eligibility & screening   | REFUSES — truth table never encoded; reuses bg-check-decisions |
 * | 02  | Do-not-rent criteria      | not yet ported — governance is BUSINESS POLICY REQUIRED |
 * | 03  | Pricing bands             | not yet ported — band rule was never encoded        |
 * | 04  | Partner economics         | **PORTED** — 3 payout formulas + onboarding gate    |
 * | 05  | Vehicle status lifecycle  | not yet ported — transitions were never encoded     |
 * | 06  | Customer lifecycle        | not yet ported — vocabularies need canonicalising   |
 * | 07  | Handover requirements     | not yet ported — the gate was never enforced        |
 *
 * Five of seven domains cannot be ported until the owner supplies policy. That is the finding,
 * not a gap in this module.
 *
 * Beyond the ported formulas, two P1 capabilities from the matrix (§4.1) are covered here.
 * Both are mechanism rather than business policy, which is why they could be built without an
 * owner decision:
 *
 * | Capability              | Module            | Acceptance test (matrix §4.1)          |
 * |-------------------------|-------------------|----------------------------------------|
 * | Rollups / counts        | `rollups.ts`      | Rollup recomputes, never stale         |
 * | Validation / required   | `field-types.ts`  | Invalid write rejected (app boundary)  |
 *
 * They share one invariant, enforced at two layers: a derived value is COMPUTED, never stored.
 * `field-types.ts` rejects a write to a rollup/formula/lookup field; `rollups.ts` recomputes
 * from the linked records and can prove a stored value has drifted.
 */

export {
  BusinessPolicyRequiredError,
  MissingInputError,
  type Blank,
  type Maybe,
} from "./types";

export {
  WEEKS_PER_MONTH,
  and,
  concatenate,
  eq,
  ifThen,
  isBlank,
  neq,
  not,
  or,
  truthy,
} from "./airtable-semantics";

export {
  expectedPartnerPayoutCaveat,
  gateCheck,
  ownerNetAfterNotePerMonth,
  ownerPayoutPerWeek,
  partnerChurnRisk,
  tmmtGrossPerWeek,
  type CommercialUseCleared,
  type GateCheckInput,
  type GateCheckResult,
  type PartnerFinanceStatus,
  type PartnerPercentage,
} from "./partner-economics";

export {
  LEGACY_ELIGIBILITY_ARTEFACT,
  decideEligibility,
  normalizeEligibilityStatus,
  normalizeOwnInsurance,
  requiredScreeningDocuments,
  type EligibilityVerdict,
  type NormalizedEligibility,
  type ScreeningSignals,
  type SignalStatus,
} from "./eligibility";

/**
 * Re-exported for convenience so a rules caller does not import from two places. The canonical
 * definition lives in `@/lib/bg-check-decisions` and must not be duplicated — a guard test
 * (F-16) walks the tree and fails the build if any file re-spells these values.
 */
export {
  BG_CHECK_DECISIONS,
  BG_DECISION,
  isBgCheckDecision,
  isBgCheckPending,
  type BgCheckDecision,
} from "@/lib/bg-check-decisions";

export {
  computeRollup,
  detectRollupDrift,
  rollup,
  type RollupDrift,
  type RollupFunction,
  type RollupResult,
  type RollupSpec,
  type RollupValue,
} from "./rollups";

export {
  DERIVED_FIELD_TYPES,
  isDerivedField,
  validateField,
  validateRecord,
  type FieldIssue,
  type FieldSpec,
  type FieldType,
  type IssueCode,
  type ValidationResult,
} from "./field-types";
