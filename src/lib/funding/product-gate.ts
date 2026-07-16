import { requireGate, isGateOpen, ComplianceGateError } from "../../../shared/compliance-gates/gate";

/**
 * FUNDING PRODUCT GATE — the first real call site `requireGate()` has ever had.
 *
 * Audited 2026-07-16: `requireGate()`, `isGateOpen()`, and `assertNoCpnOrRentedTradelines()`
 * had ZERO call sites across the whole repo. `gates.config.json` says the gates "physically
 * block features"; the root CLAUDE.md says "every gated feature is wrapped so that it
 * physically cannot run while its gate is false." Neither was true — nothing imported the
 * module. The gates were a JSON file nobody read.
 *
 * WHAT IS ACTUALLY GATED (read `sbf_broker_registered` in gates.config.json, it is explicit):
 *   "funding desk can launch with cards/LOC/SBA/equipment WITHOUT this gate;
 *    only MCA/RBF is blocked."
 *
 * So this is deliberately NARROW. It does not touch the live `/forms/credit-funding-intake`
 * flow, which is inside the carve-out and currently earning. Gating that would take a working,
 * legal, marketed money door offline for no legal reason — the opposite of protection.
 *
 * THE REAL RISK IT CLOSES: the form collects `funding_goal_type: "working_capital"` and sets
 * `operator_handoff_requested`, which pages a human. Working capital is the request most often
 * FULFILLED as an MCA. Off-platform, the carve-out constrains nothing and no code runs. This
 * module makes the boundary explicit and callable, so routing someone to an MCA/RBF product
 * throws instead of quietly happening in a DM.
 *
 * Va. Code 6.2-2228 et seq. (HB1027, 2022): brokering sales-based financing in Virginia
 * requires SCC registration ($1,000 initial / $500 annual) AND a 9-item disclosure workflow.
 * Neither is done. `sbf_broker_registered` is false and should stay false until both are.
 */

/** Products the funding desk may broker TODAY, under the gate config's own carve-out. */
export const CARVE_OUT_PRODUCTS = [
  "business_credit_card",
  "line_of_credit",
  "sba_loan",
  "equipment_financing",
  "term_loan",
  "real_estate_loan",
] as const;

/** Sales-based financing. Blocked until `sbf_broker_registered` clears. */
export const SBF_PRODUCTS = [
  "mca",
  "merchant_cash_advance",
  "revenue_based_financing",
  "rbf",
  "split_funding",
  "ach_advance",
] as const;

export type FundingProduct =
  | (typeof CARVE_OUT_PRODUCTS)[number]
  | (typeof SBF_PRODUCTS)[number];

const SBF_SET: ReadonlySet<string> = new Set(SBF_PRODUCTS);
const CARVE_SET: ReadonlySet<string> = new Set(CARVE_OUT_PRODUCTS);

export function isSalesBasedFinancing(product: string): boolean {
  return SBF_SET.has(product.trim().toLowerCase());
}

/**
 * Call before routing, quoting, referring, or recommending a funding product.
 *
 * FAILS CLOSED on an unknown product. A product nobody classified is not automatically safe —
 * that assumption is exactly how `world_check` handed out sovereign access to any typo'd seat
 * (fixed the same day). If you add a product, classify it in one of the two lists above.
 */
export function requireFundingProductAllowed(product: string): void {
  const p = product.trim().toLowerCase();

  if (SBF_SET.has(p)) {
    // Throws ComplianceGateError while sbf_broker_registered is false.
    requireGate("sbf_broker_registered");
    return;
  }

  if (CARVE_SET.has(p)) return; // explicit carve-out — legal today, no gate needed

  throw new ComplianceGateError(
    "sbf_broker_registered",
    `Unknown funding product "${product}" — classify it in CARVE_OUT_PRODUCTS or SBF_PRODUCTS ` +
      `before routing it. Unclassified products are denied, not assumed safe.`
  );
}

/** Non-throwing variant for UI (e.g. hiding an option) — the throwing one still guards the action. */
export function isFundingProductAllowed(product: string): boolean {
  try {
    requireFundingProductAllowed(product);
    return true;
  } catch {
    return false;
  }
}

/**
 * Which products may be offered right now. Use to build menus so a blocked product is never
 * shown, rather than shown and then rejected.
 */
export function availableFundingProducts(): FundingProduct[] {
  const out: FundingProduct[] = [...CARVE_OUT_PRODUCTS];
  if (isGateOpen("sbf_broker_registered")) out.push(...SBF_PRODUCTS);
  return out;
}

/**
 * Goal types the intake form actually collects, mapped to whether fulfilling them RISKS
 * landing on a sales-based product. `working_capital` is the live example: it is inside the
 * carve-out to ASK about, but it is the request most often fulfilled as an MCA.
 *
 * This does not block intake — asking is not brokering. It flags the handoff so a human sees
 * the boundary before making a referral off-platform.
 */
export function goalNeedsSbfWarning(goalType: string | null | undefined): boolean {
  const g = (goalType ?? "").trim().toLowerCase();
  return g === "working_capital" || g === "refinance";
}
