/**
 * Every price the application code carries as a constant, in one file (F-13).
 *
 * THIS IS NOT A PRICE BOOK. It moves numbers that already lived in four
 * separate files into one place so they can be seen together; it changes
 * none of them. The authoritative price list is an open owner decision
 * (docs/commercialization/OWNER_DECISIONS.md D-1, and D-2 for the operator
 * seat). Until those are answered:
 *
 *   - do not add a price here
 *   - do not "fix" the disagreements below
 *   - src/lib/pricing/catalog.test.ts pins every value to today's number so a
 *     change is a deliberate, reviewed act, not a drive-by
 *
 * Known disagreements, recorded rather than resolved:
 *   - The operator seat is $297 here (form intake) and $97 on /kits, /upgrade,
 *     the token ledger and the academy — the D-2 contradiction.
 *   - The public lead webhook prices `training` and `rental-in-a-box`; the form
 *     intake does not know them, and knows `operator-seat` instead.
 *   - $97 (9700 cents) is also the agent's human-handoff threshold and the
 *     credit journey's Path A monthly cap; the two used to be separate
 *     literals with no link to the membership price. MEMBER_97_CENTS is now the
 *     single source, and both callers say which meaning they intend.
 *
 * Amounts are integer cents. The /build high-ticket tiers stay in
 * src/lib/high-ticket.ts (they are display strings with deposits, not SKUs).
 */

/** The $97/month membership — the one number three subsystems key on. */
export const MEMBER_97_CENTS = 9700;

/**
 * Public lead-magnet webhook (POST /api/leads/webhook): sku → price stamped on
 * the incoming lead. Unknown skus price as 0 at the caller.
 */
export const LEAD_WEBHOOK_SKU_PRICE_CENTS: Readonly<Record<string, number>> = {
  "lead-magnet": 0,
  "intro-97": MEMBER_97_CENTS,
  training: 700_000,
  "rental-in-a-box": 1_500_000,
  flagship: 5_000_000,
};

export type ProgramFormSku = { sku: string; priceCents: number; title: string };

/**
 * Program intake forms (src/app/forms/actions.ts): form slug → sku, price and
 * the title written into the lead's notes.
 */
export const PROGRAM_FORM_SKUS: Readonly<Record<string, ProgramFormSku>> = {
  apply: { sku: "lead-magnet", priceCents: 0, title: "AIXMOS CHUMMO intake" },
  "academy-join": { sku: "intro-97", priceCents: MEMBER_97_CENTS, title: "Academy $97" },
  "operator-apply": { sku: "operator-seat", priceCents: 29_700, title: "Operator seat $297" },
  sovereign: { sku: "flagship", priceCents: 5_000_000, title: "Sovereign $50K" },
};

/**
 * SMS agent (src/lib/agent/state-machine.ts): at or below this price the agent
 * closes by itself; above it, it books a human call. Tied to the membership
 * price on purpose — the $97 product is the one the agent may close alone.
 */
export const AGENT_HUMAN_HANDOFF_THRESHOLD_CENTS = MEMBER_97_CENTS;

/**
 * Credit journey (src/lib/client-journey/credit-paths.ts): Path A is the
 * monthly enrollment; its cap is the membership price.
 */
export const CREDIT_PATH_A_MONTHLY_MAX_CENTS = MEMBER_97_CENTS;
