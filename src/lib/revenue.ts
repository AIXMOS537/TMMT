/**
 * Revenue metrics derived from the customer_payments ledger. Pure functions so
 * they're unit-testable; the /revenue owner dashboard renders the results.
 *
 * Conventions (matching ghl-payment-sync + the admin Payments page):
 * - A collected sale has payment_status "Paid"; "Pending" = owed (e.g. invoiced
 *   high-ticket balances); "Overdue" = past due.
 * - last_payment_date is an ISO "YYYY-MM-DD" string.
 */

export type PaymentRow = Record<string, unknown>;

export type RevenueSummary = {
  collectedThisMonth: number;
  collectedAllTime: number;
  recurringThisMonth: number;
  outstanding: number;
  overdue: number;
  salesThisMonth: number;
};

export type ProductRevenue = {
  product: string;
  collected: number;
  count: number;
};

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM" of a payment's collected date, or null if unparseable. */
export function paymentMonth(row: PaymentRow): string | null {
  const raw = row.last_payment_date;
  if (typeof raw !== "string" || raw.length < 7) return null;
  return raw.slice(0, 7);
}

function status(row: PaymentRow): string {
  return String(row.payment_status ?? "").toLowerCase();
}

function amountOf(row: PaymentRow): number {
  const n = Number(row.amount);
  return Number.isFinite(n) ? n : 0;
}

/** Recurring (membership-style) revenue vs one-time. */
export function isRecurring(row: PaymentRow): boolean {
  const plan = String(row.payment_plan ?? "").toLowerCase();
  const code = String(row.product_code ?? "").toLowerCase();
  return plan.includes("monthly") || plan.includes("/mo") || code.includes("enrollment");
}

export function revenueSummary(payments: PaymentRow[], now: Date = new Date()): RevenueSummary {
  const thisMonth = monthKey(now);
  const s: RevenueSummary = {
    collectedThisMonth: 0,
    collectedAllTime: 0,
    recurringThisMonth: 0,
    outstanding: 0,
    overdue: 0,
    salesThisMonth: 0,
  };

  for (const row of payments) {
    const st = status(row);
    const amt = amountOf(row);

    if (st === "paid") {
      s.collectedAllTime += amt;
      if (paymentMonth(row) === thisMonth) {
        s.collectedThisMonth += amt;
        s.salesThisMonth += 1;
        if (isRecurring(row)) s.recurringThisMonth += amt;
      }
    } else if (st === "pending") {
      s.outstanding += amt;
    } else if (st === "overdue") {
      s.overdue += amt;
    }
  }

  return s;
}

/** Collected revenue grouped by product, highest first. */
export function revenueByProduct(payments: PaymentRow[]): ProductRevenue[] {
  const byProduct = new Map<string, ProductRevenue>();
  for (const row of payments) {
    if (status(row) !== "paid") continue;
    const product = String(row.product_code ?? "").trim() || "Uncategorized";
    const entry = byProduct.get(product) ?? { product, collected: 0, count: 0 };
    entry.collected += amountOf(row);
    entry.count += 1;
    byProduct.set(product, entry);
  }
  return [...byProduct.values()].sort((a, b) => b.collected - a.collected);
}
