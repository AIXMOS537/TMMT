// Pure decision logic — no secrets, no I/O, so no `server-only` (it does not resolve under
// vitest, and an untestable release gate is worse than none). Callers supply the facts.
import type { InsuranceCoverageSource } from "./pricing";

/**
 * THE LOT RELEASE GATE — the last thing between a key and a stranger.
 *
 * The `bookings` table already carries `insurance_verified` and `lot_release_approved`, and
 * every row in `rental_insurance_products` sets `requires_background_approved = true`. The
 * schema encoded this rule; nothing enforced it. This file enforces it.
 *
 * WHY IT EXISTS, CONCRETELY: an operator's Supra went out with no commercial insurance, no
 * rental agreement, and no GPS, to a 19-year-old. That is uninsured liability on a real car
 * with a real driver. If a booking cannot prove coverage and a passed background check, the
 * car does not move. There is no "just this once" branch in this file, and adding one is how
 * someone gets hurt and the LLC eats it.
 *
 * FAILS CLOSED. Unknown state = denied. `pending` is not a coverage source, it is the absence
 * of one. An empty reason list must never read as "no problems" — see `canRelease`, which
 * requires positive proof of every condition rather than the absence of complaints.
 */

export type ReleaseFacts = {
  insurance_coverage_source: InsuranceCoverageSource | null | undefined;
  insurance_verified: boolean | null | undefined;
  /** Proof of a passed background check. Null/undefined = not run = denied. */
  background_approved: boolean | null | undefined;
  /** Signed rental agreement on file. */
  agreement_signed: boolean | null | undefined;
  /** Deposit actually collected, in cents. */
  deposit_collected_cents: number | null | undefined;
  deposit_required_cents: number;
  /** A quote must exist — an unpriced car cannot leave. */
  quoted_daily_cents: number | null | undefined;
};

export type ReleaseDecision =
  | { allowed: true }
  | { allowed: false; blockers: string[] };

/**
 * Decide whether the car may leave the lot.
 *
 * Note the shape: we accumulate BLOCKERS and allow only when the list is empty AND every
 * check ran. Each condition is written as "prove it is true", never "prove it is not false" —
 * a null must land in the blocker list, not slip through a `!== false`.
 */
export function canRelease(f: ReleaseFacts): ReleaseDecision {
  const blockers: string[] = [];

  // 1. Coverage must be an affirmative source. `pending` and null are both "no coverage".
  const src = f.insurance_coverage_source;
  const realSource =
    src === "renter_own" || src === "tmmt_internal" || src === "corporate_non_owner";
  if (!realSource) {
    blockers.push(
      `insurance coverage source is "${src ?? "null"}" — needs renter_own, tmmt_internal, or corporate_non_owner`
    );
  }

  // 2. Coverage must be VERIFIED, not merely claimed. A renter saying they have insurance
  //    is not insurance.
  if (f.insurance_verified !== true) {
    blockers.push("insurance not verified — a claimed policy is not a verified policy");
  }

  // 3. Background check passed. Every insurance product in the DB requires this.
  if (f.background_approved !== true) {
    blockers.push("background check not approved (or never run)");
  }

  // 4. Signed agreement. No paper, no car.
  if (f.agreement_signed !== true) {
    blockers.push("rental agreement not signed");
  }

  // 5. Deposit actually in hand, in full.
  const collected = f.deposit_collected_cents ?? 0;
  if (collected < f.deposit_required_cents) {
    blockers.push(
      `deposit short: ${collected} of ${f.deposit_required_cents} cents collected`
    );
  }

  // 6. The stay is priced. An unpriced rental is an argument waiting to happen.
  if (f.quoted_daily_cents == null || f.quoted_daily_cents <= 0) {
    blockers.push("no quote on the booking — unpriced car cannot be released");
  }

  return blockers.length === 0 ? { allowed: true } : { allowed: false, blockers };
}

/**
 * Discount approval tiers. The bookings table carries manager/supervisor approval columns and
 * `requires_manager_discount_approval`; this decides which signature a discount needs.
 * Percent is of list. Deeper cuts climb the chain — nobody discounts their own deal to zero.
 */
export function discountApprovalTier(
  discountPct: number
): "none" | "manager" | "supervisor" | "owner" {
  if (!(discountPct > 0)) return "none";
  if (discountPct <= 10) return "manager";
  if (discountPct <= 25) return "supervisor";
  return "owner";
}
