/**
 * Rules engine — shared types.
 *
 * Workstream B, P0 #1. Ports the business logic recovered from Airtable formula fields
 * (`docs/business-rules/`) into native, tested TMMT code.
 *
 * DESIGN DECISION — no formula-string interpreter.
 * The legacy base contains a small, known set of formulas (5 on Partner Acquisition, 1 on
 * Incoming Leads). Building a general Airtable-formula parser would be exactly the
 * "generic platform infrastructure nothing currently needs" that the capability matrix §7.1
 * defers. Instead these are typed functions over a small set of primitives that reproduce
 * Airtable's evaluation semantics (`airtable-semantics.ts`). If a tenant-authored formula
 * facility is ever required, §7.1's field-registry path applies.
 */

/**
 * Thrown when a caller asks for a decision the business never encoded.
 *
 * Prime Directive 5: do not invent business rules. A missing rule is NOT permission to pick a
 * sensible default — a guessed eligibility threshold or partner split silently changes what a
 * customer is told or what a partner is paid. The engine refuses instead.
 *
 * This is the "compliance gates are code, not comments" pattern from CLAUDE.md applied to
 * business policy.
 */
export class BusinessPolicyRequiredError extends Error {
  readonly policyKey: string;
  /** Where the gap is documented, so the caller can find the open question. */
  readonly docRef: string;

  constructor(policyKey: string, docRef: string, detail: string) {
    super(
      `BUSINESS POLICY REQUIRED — ${policyKey}. ${detail} ` +
        `This was never encoded in the legacy system and must not be inferred. See ${docRef}.`,
    );
    this.name = "BusinessPolicyRequiredError";
    this.policyKey = policyKey;
    this.docRef = docRef;
  }
}

/**
 * Thrown when input data is missing a value the rule genuinely needs.
 *
 * Distinct from `BusinessPolicyRequiredError`: there the *rule* is unknown; here the rule is
 * known but this record lacks an input. Both refuse rather than default.
 */
export class MissingInputError extends Error {
  readonly field: string;

  constructor(field: string, detail: string) {
    super(`MISSING INPUT — ${field}. ${detail}`);
    this.name = "MissingInputError";
    this.field = field;
  }
}

/** Airtable-style blank: null, undefined, or empty string. NOT 0 and NOT false. */
export type Blank = null | undefined | "";

/** A value that may legitimately be absent. UNKNOWN is never silently coerced. */
export type Maybe<T> = T | null;
