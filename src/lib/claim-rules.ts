/**
 * The claim types that draw CROA / FTC / A2P 10DLC attention, as one set of
 * rules instead of one copy per test file.
 *
 * Extracted from src/app/lp/[org]/[sku]/copy-compliance.test.ts, which was the
 * only place they existed. That file guards paid-ad landing copy; the public
 * front door at /welcome is customer-facing copy too and needs the same bar, and
 * a second hand-copied set of regexes is how the two drift until one of them
 * stops catching the thing it was written for.
 *
 * Background, kept from the original: the live intro-97 page once shipped
 * "Average client adds 47 points in 90 days" next to a $97 advance fee and an
 * SMS capture — a quantified score promise, an unsubstantiated volume claim and
 * a price anchor on one page. These rules fail if any of that returns.
 *
 * Deliberately NOT lib/compliance's enforceCompliance(): that rewrites
 * "credit repair" -> "credit guidance", which would invert the disclosure
 * "not credit repair" into a false statement.
 */

/** One customer-visible string, labelled so a failure says where it lives. */
export interface Claim {
  where: string;
  text: string;
}

/** "adds 47 points", "47 point jump", "+47 pts", "raise your score 100". */
export const SCORE_CLAIM = /\d+\s*(?:\+\s*)?(?:point|pt)s?\b|\bscore\b[^.]{0,20}\b\d{2,3}\b/i;

/** "12,000+ downloaded", "5000+ clients", "join 900 members". */
export const VOLUME_CLAIM =
  /\b\d[\d,]{2,}\s*\+?\s*(?:client|customer|member|student|operator|download|playbook|user|people|driver)/i;

/** "$7K+ elsewhere", "others charge $5,000" — anchors invite substantiation demands. */
export const PRICE_ANCHOR = /\$\s?\d[\d,]*\s?[Kk]?\s?\+/;

export const OUTCOME_PROMISE =
  /\b(guarantee\w*|promise\w*|assured|certain to|will (?:get|receive|be approved|raise|boost))\b/i;

/** "No score change is promised or guaranteed" — the one legitimate use. */
export const PROMISE_NEGATED = /\b(no|not|never|without)\b[^.]{0,60}\b(guarantee|promise)/i;

export const MENTIONS_CREDIT_REPAIR = /\bcredit repair\b|\b(?:fix|repair)(?:ing)? your credit\b/i;

export const CREDIT_REPAIR_DISCLAIMED = /\b(?:not|no|never|isn't|is not)\b[^.]{0,40}\bcredit repair\b/i;

export interface ClaimViolation {
  where: string;
  text: string;
  rule: string;
}

/**
 * Every rule, applied to every string. Returns what is wrong rather than
 * throwing, so each caller can assert in its own style and print all of it.
 */
export function findClaimViolations(claims: readonly Claim[]): ClaimViolation[] {
  const out: ClaimViolation[] = [];
  const fail = (c: Claim, rule: string) => out.push({ where: c.where, text: c.text, rule });

  for (const c of claims) {
    if (SCORE_CLAIM.test(c.text)) fail(c, "quantified score claim");
    if (VOLUME_CLAIM.test(c.text)) fail(c, "unsubstantiated volume claim");
    if (PRICE_ANCHOR.test(c.text)) fail(c, "price anchor claim");
    if (OUTCOME_PROMISE.test(c.text) && !PROMISE_NEGATED.test(c.text)) {
      fail(c, "outcome promise");
    }
    if (MENTIONS_CREDIT_REPAIR.test(c.text) && !CREDIT_REPAIR_DISCLAIMED.test(c.text)) {
      fail(c, "offers credit repair without disclaiming");
    }
  }
  return out;
}

/** Renders violations one per line, for an assertion message. */
export function formatClaimViolations(violations: readonly ClaimViolation[]): string {
  return violations.map((v) => `  ${v.where}: ${v.rule} -> "${v.text}"`).join("\n");
}
