import { describe, it, expect } from "vitest";
import {
  dollarsToCents,
  enforceFloor,
  readFleetRate,
  resolveWeeklyCents,
} from "./fleet-rate";

describe("dollarsToCents", () => {
  it("parses the dollars-as-text shape the fleet table actually stores", () => {
    expect(dollarsToCents("450")).toBe(45000);
    expect(dollarsToCents("$1,250")).toBe(125000);
    expect(dollarsToCents(300)).toBe(30000);
  });

  it("returns null on junk instead of NaN or zero", () => {
    expect(dollarsToCents(null)).toBeNull();
    expect(dollarsToCents("")).toBeNull();
    expect(dollarsToCents("n/a")).toBeNull();
    expect(dollarsToCents("-50")).toBeNull();
  });
});

describe("readFleetRate", () => {
  it("reads a real row: weekly_prices is an array of dollar strings", () => {
    // Shape copied from production: Honda CRV 2024, $500 posted, $450 floor.
    expect(readFleetRate({ weekly_prices: ["500"], lowest_possible_price: "450" })).toEqual({
      listWeeklyCents: 50000,
      floorWeeklyCents: 45000,
    });
  });

  it("handles the 10 of 43 cars with no posted price", () => {
    expect(readFleetRate({ weekly_prices: null, lowest_possible_price: null })).toEqual({
      listWeeklyCents: null,
      floorWeeklyCents: null,
    });
  });

  it("handles the 27 of 43 cars with a price but no floor", () => {
    expect(readFleetRate({ weekly_prices: ["350"] })).toEqual({
      listWeeklyCents: 35000,
      floorWeeklyCents: null,
    });
  });
});

describe("enforceFloor — the money guard", () => {
  it("REFUSES the exact bug this module exists to stop: the seeded $280 economy card under a $300 floor", () => {
    // rental_pricing_rules economy = $280/wk. The cheapest real car floors at
    // $300/wk. Wiring the card straight through would have shipped this.
    const v = enforceFloor(28000, { listWeeklyCents: null, floorWeeklyCents: 30000 });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.reason).toBe("below_floor");
      expect(v.floorWeeklyCents).toBe(30000);
    }
  });

  it("refuses rather than clamping upward, so the attempt stays visible", () => {
    const v = enforceFloor(20000, { listWeeklyCents: null, floorWeeklyCents: 45000 });
    expect(v.ok).toBe(false);
    // Critically: it does NOT come back as {ok:true, weeklyCents:45000}.
    expect(v).not.toHaveProperty("weeklyCents", 45000);
  });

  it("allows a rate exactly at the floor", () => {
    expect(enforceFloor(45000, { listWeeklyCents: null, floorWeeklyCents: 45000 })).toEqual({
      ok: true,
      weeklyCents: 45000,
    });
  });

  it("treats no recorded floor as no floor, not as a zero floor", () => {
    expect(enforceFloor(1, { listWeeklyCents: null, floorWeeklyCents: null })).toEqual({
      ok: true,
      weeklyCents: 1,
    });
  });
});

describe("resolveWeeklyCents — the car's own price beats the tier card", () => {
  it("prefers the posted fleet price over the tier card", () => {
    const r = resolveWeeklyCents({
      rate: { listWeeklyCents: 45000, floorWeeklyCents: 40000 },
      tierCardWeeklyCents: 28000,
    });
    expect(r).toEqual({ weeklyCents: 45000, source: "fleet_posted" });
  });

  it("falls back to the tier card only when the car has no price of its own", () => {
    const r = resolveWeeklyCents({
      rate: { listWeeklyCents: null, floorWeeklyCents: null },
      tierCardWeeklyCents: 28000,
    });
    expect(r).toEqual({ weeklyCents: 28000, source: "tier_card" });
  });

  it("returns null for an unpriced car in an unknown tier rather than inventing a rate", () => {
    expect(
      resolveWeeklyCents({ rate: { listWeeklyCents: null, floorWeeklyCents: null } })
    ).toBeNull();
  });
});
