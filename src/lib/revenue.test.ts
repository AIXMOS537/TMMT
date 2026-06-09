import { describe, it, expect } from "vitest";
import { revenueSummary, revenueByProduct, isRecurring, paymentMonth, monthKey } from "./revenue";

const NOW = new Date("2026-06-15T12:00:00Z");

const payments = [
  // collected this month
  { payment_status: "Paid", amount: 97, last_payment_date: "2026-06-03", payment_plan: "Monthly $97", product_code: "97_rental_enrollment" },
  { payment_status: "Paid", amount: 7500, last_payment_date: "2026-06-10", payment_plan: "Deposit", product_code: "build_carbox" },
  // collected a prior month (counts to all-time, not this month)
  { payment_status: "Paid", amount: 500, last_payment_date: "2026-05-20", product_code: "credit_guidance" },
  // outstanding + overdue
  { payment_status: "Pending", amount: 7500, last_payment_date: null, product_code: "build_carbox" },
  { payment_status: "Overdue", amount: 250, last_payment_date: "2026-06-01", product_code: "97_rental_enrollment" },
];

describe("monthKey / paymentMonth", () => {
  it("formats year-month", () => {
    expect(monthKey(NOW)).toBe("2026-06");
    expect(paymentMonth({ last_payment_date: "2026-06-03" })).toBe("2026-06");
    expect(paymentMonth({ last_payment_date: null })).toBeNull();
  });
});

describe("isRecurring", () => {
  it("flags membership/monthly plans, not one-time deposits", () => {
    expect(isRecurring({ payment_plan: "Monthly $97" })).toBe(true);
    expect(isRecurring({ product_code: "97_rental_enrollment" })).toBe(true);
    expect(isRecurring({ payment_plan: "Deposit", product_code: "build_carbox" })).toBe(false);
  });
});

describe("revenueSummary", () => {
  const s = revenueSummary(payments, NOW);

  it("sums collected this month (paid, current month only)", () => {
    expect(s.collectedThisMonth).toBe(97 + 7500);
    expect(s.salesThisMonth).toBe(2);
  });

  it("counts recurring revenue separately", () => {
    expect(s.recurringThisMonth).toBe(97); // membership only, not the deposit
  });

  it("sums all-time collected across months", () => {
    expect(s.collectedAllTime).toBe(97 + 7500 + 500);
  });

  it("tracks outstanding (pending) and overdue separately", () => {
    expect(s.outstanding).toBe(7500);
    expect(s.overdue).toBe(250);
  });
});

describe("revenueByProduct", () => {
  it("groups paid revenue by product, highest first, ignoring non-paid", () => {
    const rows = revenueByProduct(payments);
    expect(rows[0]).toEqual({ product: "build_carbox", collected: 7500, count: 1 });
    const membership = rows.find((r) => r.product === "97_rental_enrollment")!;
    expect(membership.collected).toBe(97); // the overdue 250 is excluded
    expect(rows.some((r) => r.product === "build_carbox" && r.count === 2)).toBe(false); // pending excluded
  });
});
