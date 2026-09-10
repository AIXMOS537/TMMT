import { describe, it, expect } from "vitest";
import { crossSellServices, crossSellNameForSlug } from "./cross-sell";
import { offerLabel } from "@/lib/offer-labels";

describe("crossSellServices", () => {
  it("never offers rentals to someone already waiting for a rental", () => {
    expect(crossSellServices().some((s) => s.id === "rentals")).toBe(false);
  });

  it("only offers lines that have a public intake to send them to", () => {
    // A service with no intake form would be a checkbox that leads nowhere.
    for (const s of crossSellServices()) {
      expect(s.slug, s.name).toBeTruthy();
      expect(s.name, s.slug).toBeTruthy();
    }
    expect(crossSellServices().length).toBeGreaterThan(3);
  });
});

describe("crossSellNameForSlug — the consent guard", () => {
  it("resolves a real service", () => {
    expect(crossSellNameForSlug("moving")).toBe("TMMT Home and Commercial Moving Services");
  });

  it("REFUSES anything that is not a real public line", () => {
    // A service row is a consent record. If a forged or stale slug resolved,
    // the row would claim someone opted into something they never saw.
    for (const bad of ["rentals", "management", "", "../admin", "nxt-global", "<script>"]) {
      expect(crossSellNameForSlug(bad), bad).toBeNull();
    }
  });
});

describe("offerLabel", () => {
  it("labels a known offer so the form stops saying 'Vehicle Rental Inquiry'", () => {
    expect(offerLabel("ecosystem")).toContain("Ecosystem");
    expect(offerLabel("carbox")).toContain("15,000");
  });

  it("falls back to null for absent or unknown values, keeping rental wording", () => {
    for (const bad of [null, undefined, "", "not-an-offer", "__proto__", "constructor"]) {
      expect(offerLabel(bad), String(bad)).toBeNull();
    }
  });
});
