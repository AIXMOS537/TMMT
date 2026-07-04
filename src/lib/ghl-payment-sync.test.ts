import { describe, it, expect } from "vitest";
import { extractPaymentRef, extractAffiliateRef, shouldRecordPayment, depositBalanceForTag, isCollectedPayment } from "./ghl-payment-sync";

describe("isCollectedPayment — only pay/count on money that actually landed", () => {
  it("is collected on a real payment event (even without an explicit amount)", () => {
    expect(isCollectedPayment("payment.received", undefined)).toBe(true);
    expect(isCollectedPayment("invoice.paid", undefined)).toBe(true);
    expect(isCollectedPayment("subscription.charged", undefined)).toBe(true);
    expect(isCollectedPayment("order.completed", undefined)).toBe(true);
    expect(isCollectedPayment("checkout.completed", undefined)).toBe(true);
  });
  it("is collected when the webhook carries an explicit charged amount", () => {
    expect(isCollectedPayment("contact.tagged", 750)).toBe(true);
  });
  it("is NOT collected for a tag-only enrollment (no payment event, no explicit amount)", () => {
    // e.g. an operator applies `credit-guidance-active` before Stripe confirms —
    // records as Pending, pays NO commission until money actually lands.
    expect(isCollectedPayment("contact.tagged", undefined)).toBe(false);
    expect(isCollectedPayment("contact.created", undefined)).toBe(false);
    expect(isCollectedPayment("contact.tagged", 0)).toBe(false);
  });
});

describe("extractPaymentRef", () => {
  it("prefers transaction-level ids", () => {
    expect(extractPaymentRef({ transaction_id: "txn_123" })).toBe("txn_123");
    expect(extractPaymentRef({ order_id: "ord_9" })).toBe("ord_9");
    expect(extractPaymentRef({ charge_id: 42 })).toBe("42");
  });

  it("ignores generic id / contact_id so repeat charges aren't deduped away", () => {
    // A monthly membership fires repeatedly from the same contact — must NOT match.
    expect(extractPaymentRef({ id: "contact_1", contact_id: "contact_1" })).toBeNull();
  });

  it("returns null when no transaction id is present", () => {
    expect(extractPaymentRef({ email: "a@b.com" })).toBeNull();
  });
});

describe("extractAffiliateRef", () => {
  it("reads an explicit affiliate field", () => {
    expect(extractAffiliateRef({ affiliate: "jane99" }, [])).toBe("jane99");
    expect(extractAffiliateRef({ rewardful_referral: "rw_abc" }, [])).toBe("rw_abc");
  });

  it("parses aff-/ref-/via- tags", () => {
    expect(extractAffiliateRef({}, ["aff-jane99"])).toBe("jane99");
    expect(extractAffiliateRef({}, ["ref:bob"])).toBe("bob");
    expect(extractAffiliateRef({}, ["via-podcast"])).toBe("podcast");
  });

  it("does NOT mistake program lifecycle tags for a referral code", () => {
    expect(extractAffiliateRef({}, ["affiliate-applied"])).toBeNull();
    expect(extractAffiliateRef({}, ["affiliate-approved"])).toBeNull();
  });

  it("returns null when there's no attribution", () => {
    expect(extractAffiliateRef({}, ["member-97"])).toBeNull();
  });
});

describe("shouldRecordPayment", () => {
  it("records on payment-like events", () => {
    expect(shouldRecordPayment({ event: "order.completed" }, [])).toBe(true);
    expect(shouldRecordPayment({ event: "invoice.paid" }, [])).toBe(true);
  });

  it("records when a known revenue tag is present", () => {
    expect(shouldRecordPayment({ event: "contact.tagged" }, ["build-carbox-deposit"])).toBe(true);
  });

  it("skips non-payment events without a revenue tag", () => {
    expect(shouldRecordPayment({ event: "contact.created" }, ["some-tag"])).toBe(false);
  });
});

describe("depositBalanceForTag", () => {
  it("returns the invoiced balance for high-ticket deposit tags", () => {
    expect(depositBalanceForTag("build-enterprise-deposit")).toBe(3750);
    expect(depositBalanceForTag("build-carbox-deposit")).toBe(7500);
    expect(depositBalanceForTag("build-ecom-deposit")).toBe(12500);
  });

  it("returns 0 for tags without a known balance (base down payment, membership, unknown)", () => {
    expect(depositBalanceForTag("build-base-deposit")).toBe(0);
    expect(depositBalanceForTag("member-97")).toBe(0);
    expect(depositBalanceForTag("nope")).toBe(0);
  });
});
