/**
 * Rollups, counts and lookups over linked records.
 *
 * Workstream B, P1 (`TMMT-AIRTABLE-CAPABILITY-MATRIX.md` §4.1 — "Rollups / counts", acceptance
 * test: *rollup recomputes, never stale*). Marked in the matrix as requiring **no owner
 * decision**: these are mechanism, not business policy. Nothing here decides anything — it
 * aggregates values that already exist.
 *
 * WHY THIS EXISTS AT ALL
 * The migration rule is explicit (`scripts/parity-check.ts`, plan §3.3): *formula and rollup
 * fields must be RECOMPUTED, never copied as stale values*. Copying a rollup across is how a
 * balance that has since changed becomes a number the business quotes at a customer. So this
 * module offers exactly one way to obtain a rollup — derive it from the linked source records —
 * and a second function to PROVE a stored value still matches (`detectRollupDrift`).
 *
 * There is deliberately no code path that reads a stored rollup as an input to a computation.
 *
 * THE BLANK-VERSUS-ZERO TRAP, WHICH IS THE WHOLE GAME
 * CLAUDE.md: *blank ≠ 0 ≠ false*. A rollup makes this sharp. `SUM` over zero linked records is
 * `0` in Airtable — the same `0` as a customer whose tickets genuinely total zero. "No tickets"
 * and "tickets worth nothing" are different facts about a person, and a bare `0` cannot tell
 * them apart. Every result therefore carries `sourceCount` and `contributingCount` so the
 * caller can distinguish them instead of guessing. `AVERAGE`, `MAX` and `MIN` return `null`
 * (blank) on empty input rather than `0`, matching Airtable.
 *
 * SCOPE — numeric and boolean/array rollups only.
 * DEFERRED, not out of scope (§7 register convention): date rollups (`MAX` of a date field).
 * The one documented rollup in the live base is a numeric Tickets balance, so a date
 * comparator is generic infrastructure nothing currently needs. What would make it a
 * requirement: any entity needing "most recent X" as a stored/derived column. Path kept open —
 * `compare()` below is the single place a date-aware comparator would be added.
 */

import { isBlank, truthy } from "./airtable-semantics";
import type { Maybe } from "./types";

/** The rollup functions Airtable exposes. Only these — no general expression language (§7.1). */
export type RollupFunction =
  | "COUNT"
  | "COUNTA"
  | "COUNTALL"
  | "SUM"
  | "AVERAGE"
  | "MAX"
  | "MIN"
  | "AND"
  | "OR"
  | "XOR"
  | "ARRAYJOIN"
  | "ARRAYUNIQUE"
  | "ARRAYCOMPACT"
  | "CONCATENATE";

export type RollupValue = Maybe<number | boolean | string | unknown[]>;

export type RollupSpec = {
  /** Human-readable name, used in warnings so a drift report names the field. */
  name: string;
  fn: RollupFunction;
  /** Key on each linked record whose value is rolled up. */
  sourceField: string;
  /** ARRAYJOIN separator. Airtable's default is ", ". */
  separator?: string;
};

export type RollupResult = {
  value: RollupValue;
  /** How many linked records were considered. 0 means "no links", which is NOT "zero". */
  sourceCount: number;
  /** How many actually contributed — non-blank, and numeric for the numeric functions. */
  contributingCount: number;
  /**
   * Data-quality findings. Reported, never silently corrected — the house rule from
   * `airtable-semantics.ts`. A non-empty array means the inputs need attention.
   */
  warnings: string[];
};

/**
 * Detects a value that LOOKS numeric but is not a number.
 *
 * This is not hypothetical. PostgREST serialises Postgres `numeric` as a JSON **string** to
 * avoid float precision loss, so a currency column arrives as `"500.00"`, not `500`. A strict
 * `SUM` would count zero numeric values and return `0` — a silent, plausible, wrong answer of
 * exactly the kind the plan's §3.3 precision trap describes.
 *
 * So: never coerce (that would invent data), and never stay quiet. Warn precisely.
 */
function looksNumericButIsNot(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(Number(value))
  );
}

function isRealNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Single place a date-aware comparator would be added. See the SCOPE note above. */
function compare(a: number, b: number): number {
  return a - b;
}

/**
 * Apply a rollup function to raw values.
 *
 * Exported for direct use and for testing the semantics in isolation. Prefer `computeRollup`,
 * which also reports provenance.
 */
export function rollup(
  fn: RollupFunction,
  values: readonly unknown[],
  separator = ", ",
): RollupValue {
  const nonBlank = values.filter((v) => !isBlank(v));
  const numbers = values.filter(isRealNumber);

  switch (fn) {
    // --- counts: three functions, three different questions ---
    case "COUNTALL":
      // Every linked value, blanks included.
      return values.length;
    case "COUNTA":
      // Non-empty values.
      return nonBlank.length;
    case "COUNT":
      // NUMERIC values only. Airtable's COUNT ignores text — a frequent source of surprise.
      return numbers.length;

    // --- numeric aggregates ---
    case "SUM":
      // Airtable returns 0 for an empty SUM. Preserved deliberately; `sourceCount` on the
      // result is what distinguishes "no links" from "sums to zero".
      return numbers.reduce((acc, n) => acc + n, 0);
    case "AVERAGE":
      // BLANK, not 0, when nothing numeric contributed. Dividing by zero would yield NaN and
      // defaulting to 0 would assert an average that was never measured.
      return numbers.length === 0
        ? null
        : numbers.reduce((acc, n) => acc + n, 0) / numbers.length;
    case "MAX":
      return numbers.length === 0 ? null : numbers.reduce((a, b) => (compare(a, b) >= 0 ? a : b));
    case "MIN":
      return numbers.length === 0 ? null : numbers.reduce((a, b) => (compare(a, b) <= 0 ? a : b));

    // --- boolean aggregates ---
    case "AND":
      // Vacuously true on empty input, matching Airtable's AND().
      return values.every(truthy);
    case "OR":
      return values.some(truthy);
    case "XOR":
      // Airtable's XOR is "an ODD number of truthy operands", not "exactly one".
      return values.filter(truthy).length % 2 === 1;

    // --- array / text aggregates ---
    case "ARRAYCOMPACT":
      return nonBlank;
    case "ARRAYUNIQUE":
      // Order-preserving. Airtable keeps first-seen order.
      return [...new Set(values)];
    case "ARRAYJOIN":
      return nonBlank.map(String).join(separator);
    case "CONCATENATE":
      return nonBlank.map(String).join("");
  }
}

/** Functions whose contribution is limited to genuinely numeric values. */
const NUMERIC_FUNCTIONS: ReadonlySet<RollupFunction> = new Set<RollupFunction>([
  "COUNT",
  "SUM",
  "AVERAGE",
  "MAX",
  "MIN",
]);

/**
 * Compute a rollup from the linked source records — the only supported way to obtain one.
 *
 * Takes records, not a precomputed number, so a stale value cannot be laundered through this
 * function. The result reports how many records were seen and how many contributed, so callers
 * can tell "no linked records" from "linked records summing to zero".
 */
export function computeRollup(
  spec: RollupSpec,
  linkedRecords: ReadonlyArray<Record<string, unknown>>,
): RollupResult {
  const values = linkedRecords.map((r) => r[spec.sourceField]);
  const warnings: string[] = [];

  if (NUMERIC_FUNCTIONS.has(spec.fn)) {
    const stringy = values.filter(looksNumericButIsNot);
    if (stringy.length > 0) {
      warnings.push(
        `${spec.name}: ${stringy.length} of ${values.length} value(s) in "${spec.sourceField}" ` +
          `are numeric-looking STRINGS (e.g. ${JSON.stringify(stringy[0])}) and were excluded ` +
          `from ${spec.fn}. Postgres numeric is serialised as a JSON string by PostgREST — ` +
          `cast at the query boundary. Coercing here would invent data; the value below is ` +
          `computed from the ${values.filter(isRealNumber).length} genuinely numeric value(s).`,
      );
    }
  }

  const missingField = linkedRecords.filter((r) => !(spec.sourceField in r)).length;
  if (missingField > 0) {
    warnings.push(
      `${spec.name}: "${spec.sourceField}" is absent from ${missingField} of ` +
        `${linkedRecords.length} linked record(s) — a missing column reads as blank here, ` +
        `which is not the same as a recorded blank. Check the select list.`,
    );
  }

  const contributing = NUMERIC_FUNCTIONS.has(spec.fn)
    ? values.filter(isRealNumber).length
    : values.filter((v) => !isBlank(v)).length;

  return {
    value: rollup(spec.fn, values, spec.separator),
    sourceCount: linkedRecords.length,
    contributingCount: contributing,
    warnings,
  };
}

export type RollupDrift = {
  stale: boolean;
  stored: RollupValue;
  recomputed: RollupValue;
  detail: string;
};

/**
 * Compare a stored rollup against a freshly computed one.
 *
 * The migration-verification half of "recompute, never copy". Run this against any column that
 * held an Airtable rollup: a mismatch means the stored number is a snapshot of a fact that has
 * since moved, and quoting it to a customer or partner would be quoting history.
 *
 * `0` versus blank is reported as drift, not smoothed over — that is the distinction the whole
 * module exists to protect.
 */
export function detectRollupDrift(
  spec: RollupSpec,
  stored: RollupValue,
  linkedRecords: ReadonlyArray<Record<string, unknown>>,
): RollupDrift {
  const fresh = computeRollup(spec, linkedRecords);
  const recomputed = fresh.value;

  const same = Array.isArray(stored) && Array.isArray(recomputed)
    ? stored.length === recomputed.length && stored.every((v, i) => v === recomputed[i])
    : stored === recomputed;

  if (same) {
    return {
      stale: false,
      stored,
      recomputed,
      detail: `${spec.name}: stored value matches recomputation over ${fresh.sourceCount} linked record(s).`,
    };
  }

  const blankVsZero =
    (isBlank(stored) && recomputed === 0) || (stored === 0 && isBlank(recomputed));

  return {
    stale: true,
    stored,
    recomputed,
    detail:
      `${spec.name}: STALE — stored ${JSON.stringify(stored)} but recomputation over ` +
      `${fresh.sourceCount} linked record(s) gives ${JSON.stringify(recomputed)}.` +
      (blankVsZero
        ? ` This is a BLANK-versus-ZERO difference: one of these says "never recorded" and the ` +
          `other says "measured, and it is zero". They are not interchangeable.`
        : "") +
      (fresh.warnings.length > 0 ? ` Also: ${fresh.warnings.join(" ")}` : ""),
  };
}
