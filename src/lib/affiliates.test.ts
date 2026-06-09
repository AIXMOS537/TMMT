import { describe, it, expect } from "vitest";
import {
  parseAffiliateCode,
  commissionForPayment,
  rollupAffiliates,
  COMMISSION_PER_SALE,
} from "./affiliates";

describe("parseAffiliateCode", () => {
  it("extracts the code from the ghl-payment-sync notes format", () => {
    expect(parseAffiliateCode("[GHL] order | product | aff: jane99 | [ref:txn_1]")).toBe("jane99");
  });

  it("handles aff at the start or end of notes", () => {
    expect(parseAffiliateCode("aff: bob")).toBe("bob");
    expect(parseAffiliateCode("x | aff: bob")).toBe("bob");
  });

  it("returns null when there's no affiliate segment or notes isn't a string", () => {
    expect(parseAffiliateCode("[GHL] order | product")).toBeNull();
    expect(parseAffiliateCode(null)).toBeNull();
    expect(parseAffiliateCode(undefined)).toBeNull();
  });
});

describe("commissionForPayment", () => {
  it("pays only on collected (Paid) sales", () => {
    expect(commissionForPayment({ payment_status: "Paid" })).toBe(COMMISSION_PER_SALE);
    expect(commissionForPayment({ payment_status: "Pending" })).toBe(0);
    expect(commissionForPayment({ payment_status: "Overdue" })).toBe(0);
  });
});

describe("rollupAffiliates", () => {
  const payments = [
    { payment_status: "Paid", amount: 97, notes: "aff: jane99" },
    { payment_status: "Paid", amount: 97, notes: "x | aff: jane99 | y" },
    { payment_status: "Pending", amount: 7500, notes: "aff: jane99" },
    { payment_status: "Paid", amount: 250, notes: "aff: bob" },
    { payment_status: "Paid", amount: 50, notes: "no affiliate here" }, // ignored
  ];

  it("groups by code with paid/pending counts, gross, and commission", () => {
    const rows = rollupAffiliates(payments);
    expect(rows).toHaveLength(2);

    const jane = rows.find((r) => r.code === "jane99")!;
    expect(jane.paidSales).toBe(2);
    expect(jane.pendingSales).toBe(1);
    expect(jane.grossCollected).toBe(194); // only the two paid rows
    expect(jane.commission).toBe(2 * COMMISSION_PER_SALE);
  });

  it("ignores rows without an affiliate code", () => {
    const codes = rollupAffiliates(payments).map((r) => r.code);
    expect(codes).not.toContain(null);
    expect(codes.sort()).toEqual(["bob", "jane99"]);
  });

  it("sorts by commission owed, highest first", () => {
    const rows = rollupAffiliates(payments);
    expect(rows[0].code).toBe("jane99"); // 2 paid > bob's 1 paid
  });

  it("returns an empty array when nothing is attributed", () => {
    expect(rollupAffiliates([{ payment_status: "Paid", amount: 10, notes: "x" }])).toEqual([]);
  });
});
