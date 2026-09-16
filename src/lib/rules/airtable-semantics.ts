/**
 * Airtable evaluation semantics.
 *
 * The ported rules must reproduce what the legacy system ACTUALLY did, including where that
 * differs from what a TypeScript author would write naturally. Fidelity first; findings are
 * reported, not silently corrected (`docs/business-rules/` README).
 *
 * Only the operators observed in the live base are implemented:
 *   arithmetic (* -) · comparison (= !=) · boolean (AND OR NOT) · IF · CONCATENATE ·
 *   blank handling · a weeks-per-month constant
 *
 * Verified against the field configs read from base `appcenWUju039rD7b` on 2026-09-15.
 */

import type { Blank } from "./types";

/**
 * Weeks per month, as the legacy `Owner Net After Note / Month` formula uses it.
 * VERBATIM from `fldeXzDb1UK5D443W`. Do not "improve" this to 52/12 (4.3333…) — the ported
 * rule must produce the same number the business quoted to partners.
 */
export const WEEKS_PER_MONTH = 4.33;

/** Airtable blank: null, undefined or empty string. Zero and false are NOT blank. */
export function isBlank(value: unknown): value is Blank {
  return value === null || value === undefined || value === "";
}

/**
 * Airtable truthiness, as used by IF() and AND()/OR().
 *
 * Blank, 0 and false are falsy. Every other value — including a non-empty string and a
 * negative number — is truthy.
 */
export function truthy(value: unknown): boolean {
  if (isBlank(value)) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
  return true;
}

/** AND(...) — every operand truthy. Empty AND() is true, matching Airtable. */
export function and(...operands: unknown[]): boolean {
  return operands.every(truthy);
}

/** OR(...) — any operand truthy. */
export function or(...operands: unknown[]): boolean {
  return operands.some(truthy);
}

export function not(value: unknown): boolean {
  return !truthy(value);
}

/**
 * Airtable `!=` comparison.
 *
 * IMPORTANT AND LOAD-BEARING: a blank field compared against a string literal is **not equal**,
 * so `{Blank Field} != "Leased"` evaluates TRUE.
 *
 * This is not a quirk we can normalise away — it changes the outcome of the live
 * `⚠️ Gate Check` formula for any vehicle whose Finance Status was never filled in.
 * See `partner-economics.ts` and `docs/business-rules/04` §4.4.
 */
export function neq(left: unknown, right: unknown): boolean {
  return !eq(left, right);
}

/** Airtable `=` comparison. Blank equals blank; otherwise strict value comparison. */
export function eq(left: unknown, right: unknown): boolean {
  if (isBlank(left) && isBlank(right)) return true;
  if (isBlank(left) || isBlank(right)) return false;
  return left === right;
}

/**
 * IF(condition, then, otherwise).
 *
 * When `otherwise` is omitted, Airtable returns BLANK — not 0 and not "". The legacy
 * `Owner Net After Note / Month` formula relies on this: with no target rate it yields blank,
 * which must surface as `null`, never as a payout of 0.
 */
export function ifThen<T>(condition: unknown, then: T): T | null;
export function ifThen<T, U>(condition: unknown, then: T, otherwise: U): T | U;
export function ifThen<T, U>(condition: unknown, then: T, otherwise?: U): T | U | null {
  if (truthy(condition)) return then;
  return otherwise === undefined ? null : otherwise;
}

/** CONCATENATE(...) — blanks render as empty string. */
export function concatenate(...parts: unknown[]): string {
  return parts.map((p) => (isBlank(p) ? "" : String(p))).join("");
}
