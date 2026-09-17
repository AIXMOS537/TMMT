import { describe, it, expect } from "vitest";
import { tierActionUrl, highTicketTiers, type HighTicketTier, consultUrl } from "./high-ticket";

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

  it("falls back to TMMT's own lead form when no checkout URL is set", () => {
    // A five-figure reserve button that sent the buyer to the partner's
    // homepage was worse than a dead button: it looked like it worked.
    const url = tierActionUrl({ ...base, cta: "reserve", checkoutUrl: "  " });
    expect(url).not.toContain("allinonemanagementsolutions");
    expect(url.startsWith("/forms/lead-intake?")).toBe(true);
  });

  it("routes call tiers to the GHL consult offer", () => {
    expect(tierActionUrl({ ...base, cta: "call", checkoutUrl: "" })).toBe(consultUrl);
    expect(consultUrl).toContain("utm_campaign=strategy-call");
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
