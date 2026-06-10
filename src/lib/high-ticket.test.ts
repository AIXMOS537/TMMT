import { describe, it, expect } from "vitest";
import { tierActionUrl, highTicketTiers, type HighTicketTier } from "./high-ticket";

// consultUrl is read from env at import; it's unset under test, so reserve tiers
// with no checkout URL fall back to the "#reserve-pending" sentinel (no dead/live
// button) and call tiers fall back to "#book-a-call".
const base: HighTicketTier = {
  id: "x", name: "X", tagline: "", audience: "", priceLabel: "", depositAmount: 0,
  depositLabel: "", balanceNote: "", bullets: [], outcome: "", cta: "reserve",
  checkoutUrl: "", revenueTag: "t",
};

describe("tierActionUrl", () => {
  it("uses the checkout URL when a reserve tier has one", () => {
    expect(tierActionUrl({ ...base, cta: "reserve", checkoutUrl: "https://pay.example/x" }))
      .toBe("https://pay.example/x");
  });

  it("falls back to the reserve-pending sentinel when no checkout URL is set", () => {
    expect(tierActionUrl({ ...base, cta: "reserve", checkoutUrl: "  " }))
      .toBe("#reserve-pending");
  });

  it("routes call tiers to the book-a-call fallback", () => {
    expect(tierActionUrl({ ...base, cta: "call", checkoutUrl: "" }))
      .toBe("#book-a-call");
  });
});

describe("highTicketTiers catalog", () => {
  it("has 5 tiers, the top one is consult-first, and exactly one is featured", () => {
    expect(highTicketTiers).toHaveLength(5);
    expect(highTicketTiers.at(-1)!.cta).toBe("call");
    expect(highTicketTiers.filter((t) => t.featured)).toHaveLength(1);
  });

  it("every reserve tier carries a revenue tag for payment recording", () => {
    for (const t of highTicketTiers) {
      expect(t.revenueTag).toMatch(/^build-/);
    }
  });
});
