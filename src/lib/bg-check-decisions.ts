/**
 * The one source for `background_checks.eligibility_status` values.
 *
 * These five strings are a contract with the database, not a UI choice: the
 * `bg_check_decide` RPC rejects anything else (S3-03 decision contract), the
 * live rows already hold exactly these spellings — "out of radius" is
 * lower-case on purpose — and `decision_events` keys off them. Change a
 * string here and every existing row stops matching.
 *
 * This module is deliberately dependency-free so that a server action, a
 * shared schema, or a client component can all import it without pulling in
 * the browser Supabase client that `@/lib/queries` needs. `queries.ts`
 * re-exports everything here, so its existing importers keep working.
 *
 * `src/lib/bg-check-decisions.test.ts` walks the tree and fails if any other
 * file spells these values out again. (Remediation F-16.)
 */

export const BG_CHECK_DECISIONS = [
  "Eligible",
  "Not Eligible",
  "Need Manager's Review",
  "out of radius",
  "Not found",
] as const;

export type BgCheckDecision = (typeof BG_CHECK_DECISIONS)[number];

/**
 * Named handles for the individual decisions, so a call site can say
 * `BG_DECISION.needsReview` instead of retyping the string. `satisfies` pins
 * every value to the tuple above; the test checks the two lists cover each
 * other exactly.
 */
export const BG_DECISION = {
  eligible: "Eligible",
  notEligible: "Not Eligible",
  needsReview: "Need Manager's Review",
  outOfRadius: "out of radius",
  notFound: "Not found",
} as const satisfies Record<string, BgCheckDecision>;

export function isBgCheckDecision(value: unknown): value is BgCheckDecision {
  return typeof value === "string" && (BG_CHECK_DECISIONS as readonly string[]).includes(value);
}

/**
 * A check is still waiting on a human when nobody has decided yet (NULL) or
 * the decision was to escalate. Both the staff queue's pending count and the
 * dashboard stat card count this way — they used to each spell it out.
 */
export function isBgCheckPending(status: string | null | undefined): boolean {
  return !status || status === BG_DECISION.needsReview;
}
