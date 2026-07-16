import { describe, it, expect } from "vitest";
import {
  requireFundingProductAllowed,
  isFundingProductAllowed,
  isSalesBasedFinancing,
  availableFundingProducts,
  goalNeedsSbfWarning,
} from "@/lib/funding/product-gate";

/**
 * These tests assert the CURRENT legal posture: sbf_broker_registered === false.
 * If someone flips that gate without SCC registration + the 9-item disclosure workflow,
 * the MCA tests below go red. That is the point — they are the alarm, not decoration.
 */

describe("the carve-out stays open (do not break the live money door)", () => {
  it("allows every carve-out product with the gate CLOSED", () => {
    for (const p of [
      "business_credit_card",
      "line_of_credit",
      "sba_loan",
      "equipment_financing",
      "term_loan",
      "real_estate_loan",
    ]) {
      expect(() => requireFundingProductAllowed(p)).not.toThrow();
      expect(isFundingProductAllowed(p)).toBe(true);
    }
  });

  it("lists exactly the carve-out products as available while the gate is closed", () => {
    const avail = availableFundingProducts();
    expect(avail).toContain("sba_loan");
    expect(avail).toContain("line_of_credit");
    expect(avail).not.toContain("mca");
    expect(avail).not.toContain("revenue_based_financing");
  });
});

describe("sales-based financing is BLOCKED (Va. Code 6.2-2228, unregistered)", () => {
  it("throws on every MCA/RBF product", () => {
    for (const p of [
      "mca",
      "merchant_cash_advance",
      "revenue_based_financing",
      "rbf",
      "split_funding",
      "ach_advance",
    ]) {
      expect(() => requireFundingProductAllowed(p)).toThrow(/sbf_broker_registered/i);
      expect(isFundingProductAllowed(p)).toBe(false);
    }
  });

  it("the error explains what clears it, not just that it failed", () => {
    expect(() => requireFundingProductAllowed("mca")).toThrow(/SCC|registration|Clears when/i);
  });

  it("classifies SBF products correctly regardless of case/whitespace", () => {
    expect(isSalesBasedFinancing("  MCA ")).toBe(true);
    expect(isSalesBasedFinancing("Revenue_Based_Financing")).toBe(true);
    expect(isSalesBasedFinancing("sba_loan")).toBe(false);
  });
});

describe("fails CLOSED on the unknown (the world_check lesson)", () => {
  it("denies an unclassified product rather than assuming it is safe", () => {
    expect(() => requireFundingProductAllowed("crypto_bridge_loan")).toThrow(/Unknown funding product/i);
    expect(isFundingProductAllowed("factoring")).toBe(false);
  });

  it("denies empty/garbage input", () => {
    expect(() => requireFundingProductAllowed("")).toThrow();
    expect(() => requireFundingProductAllowed("   ")).toThrow();
  });
});

describe("goal warnings — asking is not brokering", () => {
  it("flags working_capital and refinance as SBF-risky handoffs", () => {
    expect(goalNeedsSbfWarning("working_capital")).toBe(true);
    expect(goalNeedsSbfWarning("refinance")).toBe(true);
  });

  it("does NOT flag the plainly safe goals the form collects", () => {
    for (const g of ["growth", "equipment", "real_estate", "other", "", null, undefined]) {
      expect(goalNeedsSbfWarning(g)).toBe(false);
    }
  });
});
