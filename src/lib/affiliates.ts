/**
 * Affiliate payout reporting — rolls up the `aff: <code>` attribution that
 * ghl-payment-sync stamps onto customer_payments into per-affiliate totals.
 *
 * Commission policy is intentionally centralized here. Default is the documented
 * program ($35 per collected/paid sale); change COMMISSION_PER_SALE or
 * commissionForPayment() to adjust. Commission accrues only on PAID rows — never
 * on pending balances — so you never owe a payout on money you haven't collected.
 */

export const COMMISSION_PER_SALE = 35; // dollars per collected sale (documented program)

export type PaymentRow = Record<string, unknown>;

export type AffiliateRollup = {
  code: string;
  paidSales: number;
  pendingSales: number;
  grossCollected: number;
  commission: number;
};

/** Extract the affiliate code from a payment's notes (`… | aff: CODE | …`). */
export function parseAffiliateCode(notes: unknown): string | null {
  if (typeof notes !== "string") return null;
  const m = notes.match(/(?:^|\|)\s*aff:\s*([^|]+?)\s*(?:\||$)/i);
  return m ? m[1].trim() || null : null;
}

function isPaid(row: PaymentRow): boolean {
  return String(row.payment_status ?? "").toLowerCase() === "paid";
}

function amountOf(row: PaymentRow): number {
  const n = Number(row.amount);
  return Number.isFinite(n) ? n : 0;
}

/** Commission earned on a single payment row (0 unless it's a paid sale). */
export function commissionForPayment(row: PaymentRow): number {
  return isPaid(row) ? COMMISSION_PER_SALE : 0;
}

/**
 * Group attributed payments by affiliate code. Rows without an `aff:` code are
 * ignored. Sorted by commission owed, highest first.
 */
export function rollupAffiliates(payments: PaymentRow[]): AffiliateRollup[] {
  const byCode = new Map<string, AffiliateRollup>();

  for (const row of payments) {
    const code = parseAffiliateCode(row.notes);
    if (!code) continue;

    const entry =
      byCode.get(code) ??
      { code, paidSales: 0, pendingSales: 0, grossCollected: 0, commission: 0 };

    if (isPaid(row)) {
      entry.paidSales += 1;
      entry.grossCollected += amountOf(row);
      entry.commission += commissionForPayment(row);
    } else {
      entry.pendingSales += 1;
    }

    byCode.set(code, entry);
  }

  return [...byCode.values()].sort((a, b) => b.commission - a.commission);
}
