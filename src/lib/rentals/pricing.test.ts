import { describe, it, expect } from "vitest";
import {
  resolveQuote,
  priceStay,
  stayDays,
  type PricingRule,
  type VehicleTier,
} from "@/lib/rentals/pricing";

/**
 * Fixtures mirror the REAL rows in `rental_pricing_rules` (probed 2026-07-16). If these
 * drift from the DB, the tests are lying — re-probe rather than "fixing" the fixture.
 */
const rule = (
  id: string,
  tier: VehicleTier,
  make: string | null,
  model: string | null,
  daily: number,
  weekly: number,
  deposit: number,
  match_priority: number,
  extra: Partial<PricingRule> = {}
): PricingRule => ({
  id,
  tier,
  make,
  model,
  year_min: null,
  year_max: null,
  daily_rate_cents: daily,
  weekly_rate_cents: weekly,
  deposit_cents: deposit,
  match_priority,
  active: true,
  ...extra,
});

const RULES: PricingRule[] = [
  rule("eco-any", "economy", null, null, 4500, 28000, 40000, 0),
  rule("mid-any", "mid", null, null, 7500, 47000, 50000, 0),
  rule("lux-any", "luxury", null, null, 15000, 95000, 100000, 0),
  rule("tesla-3", "economy", "Tesla", "Model 3", 8900, 55000, 50000, 20),
  rule("tesla-y", "economy", "Tesla", "Model Y", 9500, 59000, 50000, 20),
  rule("bmw-3", "mid", "BMW", "3 Series", 12000, 75000, 75000, 25),
  rule("porsche-any", "luxury", "Porsche", null, 22000, 140000, 150000, 30),
  rule("mb-s", "luxury", "Mercedes-Benz", "S-Class", 25000, 160000, 200000, 35),
];

describe("resolveQuote — priority cascade", () => {
  it("specific make/model beats the tier fallback", () => {
    const q = resolveQuote(RULES, { make: "Tesla", model: "Model 3", tier: "economy" });
    expect(q?.rule_id).toBe("tesla-3");
    expect(q?.daily_cents).toBe(8900); // NOT the 4500 economy fallback
    expect(q?.matched_on).toBe("make_model");
  });

  it("highest priority wins when several rules apply", () => {
    // S-Class (35) must beat Porsche/* (30) — and it isn't a Porsche anyway.
    const q = resolveQuote(RULES, { make: "Mercedes-Benz", model: "S-Class", tier: "luxury" });
    expect(q?.rule_id).toBe("mb-s");
    expect(q?.daily_cents).toBe(25000);
  });

  it("make-wildcard rule matches any model of that make", () => {
    const q = resolveQuote(RULES, { make: "Porsche", model: "911", tier: "luxury" });
    expect(q?.rule_id).toBe("porsche-any");
    expect(q?.matched_on).toBe("make");
  });

  it("falls back to the tier rule for an unlisted make", () => {
    const q = resolveQuote(RULES, { make: "Honda", model: "Civic", tier: "economy" });
    expect(q?.rule_id).toBe("eco-any");
    expect(q?.matched_on).toBe("tier_fallback");
  });

  it("is case- and whitespace-insensitive on make/model", () => {
    const q = resolveQuote(RULES, { make: "  tesla ", model: "MODEL 3", tier: "economy" });
    expect(q?.rule_id).toBe("tesla-3");
  });
});

describe("resolveQuote — refuses to guess (the money-safety half)", () => {
  it("REFUSES to quote an unknown make when tier is unknown — 93% of the fleet has no vehicle_class", () => {
    // This is the real-world case: fleet.vehicle_class is null on 40 of 43 cars.
    // A guessed tier silently misprices a real car. Null is the correct answer.
    expect(resolveQuote(RULES, { make: "Honda", model: "Civic", tier: null })).toBeNull();
  });

  it("still prices a known make/model even when tier is unknown", () => {
    // The make/model rule carries its own tier — it does not need vehicle_class.
    const q = resolveQuote(RULES, { make: "Tesla", model: "Model 3", tier: null });
    expect(q?.rule_id).toBe("tesla-3");
    expect(q?.tier).toBe("economy");
  });

  it("returns null when there are no rules at all (never a free car)", () => {
    expect(resolveQuote([], { make: "Tesla", model: "Model 3", tier: "economy" })).toBeNull();
  });

  it("ignores inactive rules", () => {
    const off = RULES.map((r) => (r.id === "tesla-3" ? { ...r, active: false } : r));
    const q = resolveQuote(off, { make: "Tesla", model: "Model 3", tier: "economy" });
    expect(q?.rule_id).toBe("eco-any"); // falls back, does not use the disabled rate
  });

  it("a year-bounded rule does NOT match a vehicle of unknown year", () => {
    const bounded = [rule("bmw-new", "mid", "BMW", "3 Series", 13000, 80000, 75000, 40, { year_min: 2020 })];
    expect(resolveQuote(bounded, { make: "BMW", model: "3 Series", year: null })).toBeNull();
    expect(resolveQuote(bounded, { make: "BMW", model: "3 Series", year: 2019 })).toBeNull();
    expect(resolveQuote(bounded, { make: "BMW", model: "3 Series", year: 2021 })?.rule_id).toBe("bmw-new");
  });
});

describe("priceStay", () => {
  it("prices a single day at the daily rate", () => {
    const q = resolveQuote(RULES, { make: "Tesla", model: "Model 3", tier: "economy" })!;
    const p = priceStay(q, 1);
    expect(p.rental_cents).toBe(8900);
    expect(p.due_at_signing_cents).toBe(8900 + 50000);
  });

  it("uses the weekly rate for exactly 7 days", () => {
    const q = resolveQuote(RULES, { make: "Tesla", model: "Model 3", tier: "economy" })!;
    expect(priceStay(q, 7).rental_cents).toBe(55000); // not 7 * 8900 = 62300
  });

  it("caps a remainder so 6 days never costs more than a full week", () => {
    // 6 * 8900 = 53400 which is under 55000, so it bills raw...
    expect(priceStay(resolveQuote(RULES, { make: "Tesla", model: "Model 3" })!, 6).rental_cents).toBe(53400);
    // ...but for the economy fallback, 6 * 4500 = 27000 < 28000 weekly — also raw.
    // The cap bites where daily*remainder exceeds weekly:
    const steep = rule("steep", "mid", "X", "Y", 10000, 20000, 0, 50);
    expect(priceStay(resolveQuote([steep], { make: "X", model: "Y" })!, 6).rental_cents).toBe(20000);
  });

  it("prices 10 days as one week plus 3 days", () => {
    const q = resolveQuote(RULES, { make: "Tesla", model: "Model 3" })!;
    const p = priceStay(q, 10);
    expect(p.weeks).toBe(1);
    expect(p.remainder_days).toBe(3);
    expect(p.rental_cents).toBe(55000 + 3 * 8900);
  });

  it("rejects a zero or negative stay rather than quoting $0", () => {
    const q = resolveQuote(RULES, { make: "Tesla", model: "Model 3" })!;
    expect(() => priceStay(q, 0)).toThrow();
    expect(() => priceStay(q, -3)).toThrow();
  });
});

describe("stayDays", () => {
  it("rounds a partial day up — 25 hours is 2 days", () => {
    expect(stayDays(new Date("2026-07-16T10:00:00Z"), new Date("2026-07-17T11:00:00Z"))).toBe(2);
  });
  it("counts an exact 7-day stay as 7", () => {
    expect(stayDays(new Date("2026-07-16T10:00:00Z"), new Date("2026-07-23T10:00:00Z"))).toBe(7);
  });
  it("throws when the end is not after the start", () => {
    const t = new Date("2026-07-16T10:00:00Z");
    expect(() => stayDays(t, t)).toThrow();
  });
});
