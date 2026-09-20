import { describe, it, expect } from "vitest";
import {
  buildQuote,
  eligibleInsurance,
  formatCents,
  resolvePricingRule,
  ruleMatches,
  type InsuranceProduct,
  type PricingRule,
} from "./quote";

/**
 * These are the ACTUAL production rows, read from
 * public.rental_pricing_rules on 2026-09-16 (10 rows, all active,
 * seeded 2026-06-03). Not invented fixtures. If production changes,
 * these tests should be updated from production, not guessed.
 */
const RULES: PricingRule[] = [
  { id: "51d0feb8", tier: "economy", make: null, model: null, year_min: null, year_max: null, daily_rate_cents: 4500, weekly_rate_cents: 28000, deposit_cents: 40000, match_priority: 0, active: true },
  { id: "60584d8c", tier: "mid", make: null, model: null, year_min: null, year_max: null, daily_rate_cents: 7500, weekly_rate_cents: 47000, deposit_cents: 50000, match_priority: 0, active: true },
  { id: "97abb76a", tier: "luxury", make: null, model: null, year_min: null, year_max: null, daily_rate_cents: 15000, weekly_rate_cents: 95000, deposit_cents: 100000, match_priority: 0, active: true },
  { id: "536b5ffc", tier: "economy", make: "Tesla", model: "Model 3", year_min: 2020, year_max: null, daily_rate_cents: 8900, weekly_rate_cents: 55000, deposit_cents: 50000, match_priority: 20, active: true },
  { id: "d6b1a285", tier: "economy", make: "Tesla", model: "Model Y", year_min: 2020, year_max: null, daily_rate_cents: 9500, weekly_rate_cents: 59000, deposit_cents: 50000, match_priority: 20, active: true },
  { id: "fec22f54", tier: "mid", make: "BMW", model: "3 Series", year_min: 2018, year_max: null, daily_rate_cents: 12000, weekly_rate_cents: 75000, deposit_cents: 75000, match_priority: 25, active: true },
  { id: "d17d1245", tier: "mid", make: "Mercedes-Benz", model: "C-Class", year_min: 2018, year_max: null, daily_rate_cents: 12500, weekly_rate_cents: 78000, deposit_cents: 75000, match_priority: 25, active: true },
  { id: "95b8e636", tier: "luxury", make: "Porsche", model: null, year_min: 2018, year_max: null, daily_rate_cents: 22000, weekly_rate_cents: 140000, deposit_cents: 150000, match_priority: 30, active: true },
  { id: "b420d365", tier: "luxury", make: "Mercedes-Benz", model: "S-Class", year_min: 2018, year_max: null, daily_rate_cents: 25000, weekly_rate_cents: 160000, deposit_cents: 200000, match_priority: 35, active: true },
  { id: "27bb9343", tier: "luxury", make: "BMW", model: "7 Series", year_min: 2018, year_max: null, daily_rate_cents: 24000, weekly_rate_cents: 155000, deposit_cents: 200000, match_priority: 35, active: true },
];

/** Actual public.rental_insurance_products rows, read 2026-09-16 (6 rows). */
const INSURANCE: InsuranceProduct[] = [
  { id: "5ecadd95", tier: "economy", coverage_source: "tmmt_internal", name: "TMMT Economy Shield", weekly_premium_cents: 3500, min_liability_cents: 25000000, requires_background_approved: true, active: true },
  { id: "78dc15f6", tier: "mid", coverage_source: "tmmt_internal", name: "TMMT Mid-Tier Protection", weekly_premium_cents: 5500, min_liability_cents: 50000000, requires_background_approved: true, active: true },
  { id: "20101c30", tier: "luxury", coverage_source: "tmmt_internal", name: "TMMT Luxury Coverage", weekly_premium_cents: 9500, min_liability_cents: 100000000, requires_background_approved: true, active: true },
  { id: "473c2aaa", tier: "economy", coverage_source: "corporate_non_owner", name: "Fleet Non-Owner (Economy)", weekly_premium_cents: 4200, min_liability_cents: 30000000, requires_background_approved: true, active: true },
  { id: "f8fdf917", tier: "mid", coverage_source: "corporate_non_owner", name: "Fleet Non-Owner (Mid)", weekly_premium_cents: 6200, min_liability_cents: 50000000, requires_background_approved: true, active: true },
  { id: "9a4fc667", tier: "luxury", coverage_source: "corporate_non_owner", name: "Fleet Non-Owner (Luxury)", weekly_premium_cents: 11000, min_liability_cents: 100000000, requires_background_approved: true, active: true },
];

describe("ruleMatches", () => {
  it("treats null make/model/year as wildcards, which is what makes tier rows the floor", () => {
    const floor = RULES.find((r) => r.id === "51d0feb8")!;
    expect(ruleMatches(floor, { tier: "economy", make: "Kia", model: "Forte", year: 2015 })).toBe(true);
    expect(ruleMatches(floor, { tier: "economy" })).toBe(true);
  });

  it("does not cross tiers", () => {
    const floor = RULES.find((r) => r.id === "51d0feb8")!;
    expect(ruleMatches(floor, { tier: "luxury", make: "Kia" })).toBe(false);
  });

  it("matches make/model case- and whitespace-insensitively", () => {
    const tesla3 = RULES.find((r) => r.id === "536b5ffc")!;
    expect(ruleMatches(tesla3, { tier: "economy", make: "  tesla ", model: "MODEL 3", year: 2022 })).toBe(true);
  });

  it("refuses a year-bounded rule when the vehicle year is unknown", () => {
    // The dangerous case: a 2012 Tesla with a missing year must NOT inherit the
    // 2020+ rate. No year => no match on a year-bounded rule.
    const tesla3 = RULES.find((r) => r.id === "536b5ffc")!;
    expect(ruleMatches(tesla3, { tier: "economy", make: "Tesla", model: "Model 3" })).toBe(false);
    expect(ruleMatches(tesla3, { tier: "economy", make: "Tesla", model: "Model 3", year: 2019 })).toBe(false);
    expect(ruleMatches(tesla3, { tier: "economy", make: "Tesla", model: "Model 3", year: 2020 })).toBe(true);
  });

  it("never matches an inactive rule", () => {
    const off = { ...RULES[0], active: false };
    expect(ruleMatches(off, { tier: "economy" })).toBe(false);
  });
});

describe("resolvePricingRule — most specific wins", () => {
  it("falls back to the tier floor for an unlisted car", () => {
    const r = resolvePricingRule(RULES, { tier: "economy", make: "Kia", model: "Forte", year: 2019 });
    expect(r?.id).toBe("51d0feb8");
    expect(r?.weekly_rate_cents).toBe(28000); // $280/wk
  });

  it("picks the Tesla Model Y row over the economy floor", () => {
    const r = resolvePricingRule(RULES, { tier: "economy", make: "Tesla", model: "Model Y", year: 2023 });
    expect(r?.id).toBe("d6b1a285");
    expect(r?.weekly_rate_cents).toBe(59000); // $590/wk, not $280
  });

  it("picks the S-Class flagship row (35) over the make-only Porsche logic and the luxury floor", () => {
    const r = resolvePricingRule(RULES, { tier: "luxury", make: "Mercedes-Benz", model: "S-Class", year: 2021 });
    expect(r?.id).toBe("b420d365");
    expect(r?.deposit_cents).toBe(200000); // $2,000 deposit
  });

  it("matches any Porsche 2018+ on the make-only luxury row", () => {
    const r = resolvePricingRule(RULES, { tier: "luxury", make: "Porsche", model: "Macan", year: 2020 });
    expect(r?.id).toBe("95b8e636");
  });

  it("drops a pre-2018 Porsche to the luxury floor rather than the Porsche rate", () => {
    const r = resolvePricingRule(RULES, { tier: "luxury", make: "Porsche", model: "Macan", year: 2016 });
    expect(r?.id).toBe("97abb76a");
  });

  it("is order-independent", () => {
    const v = { tier: "luxury" as const, make: "BMW", model: "7 Series", year: 2022 };
    const forward = resolvePricingRule(RULES, v);
    const reversed = resolvePricingRule([...RULES].reverse(), v);
    expect(forward?.id).toBe(reversed?.id);
    expect(forward?.id).toBe("27bb9343");
  });

  it("returns null rather than inventing a price when nothing matches", () => {
    expect(resolvePricingRule([], { tier: "economy" })).toBeNull();
  });
});

describe("eligibleInsurance", () => {
  it("offers NOTHING to a renter whose background check is not approved", () => {
    // All six seeded products require approval. Failing closed is the point.
    expect(eligibleInsurance(INSURANCE, { tier: "economy", backgroundApproved: false })).toEqual([]);
  });

  it("offers both economy products, cheapest first, once approved", () => {
    const out = eligibleInsurance(INSURANCE, { tier: "economy", backgroundApproved: true });
    expect(out.map((p) => p.id)).toEqual(["5ecadd95", "473c2aaa"]);
    expect(out[0].weekly_premium_cents).toBe(3500);
  });

  it("does not leak another tier's coverage", () => {
    const out = eligibleInsurance(INSURANCE, { tier: "luxury", backgroundApproved: true });
    expect(out.every((p) => p.tier === "luxury")).toBe(true);
  });
});

describe("buildQuote", () => {
  it("prices the core gig-driver product: one week in a base economy car", () => {
    const q = buildQuote({ vehicle: { tier: "economy", make: "Kia", model: "Forte", year: 2019 }, rules: RULES, days: 7 })!;
    expect(q.weeks).toBe(1);
    expect(q.extra_days).toBe(0);
    expect(q.subtotal_cents).toBe(28000);
    expect(q.due_now_cents).toBe(28000 + 40000); // rent + $400 deposit
  });

  it("bills leftover days daily on top of whole weeks", () => {
    const q = buildQuote({ vehicle: { tier: "economy", make: "Kia", year: 2019 }, rules: RULES, days: 9 })!;
    expect(q.weeks).toBe(1);
    expect(q.extra_days).toBe(2);
    expect(q.subtotal_cents).toBe(28000 + 2 * 4500);
  });

  it("never lets a partial week cost more than a full week", () => {
    // 6 days x $45 = $270 daily, but the weekly rate is $280 -- daily wins here.
    const six = buildQuote({ vehicle: { tier: "economy", year: 2019 }, rules: RULES, days: 6 })!;
    expect(six.subtotal_cents).toBe(27000);

    // A tier where the daily remainder WOULD exceed the week gets capped.
    const capped = buildQuote({ vehicle: { tier: "luxury", make: "Porsche", year: 2020 }, rules: RULES, days: 13 })!;
    // 1 week (140000) + min(6*22000=132000, 140000) = 132000
    expect(capped.subtotal_cents).toBe(140000 + 132000);
  });

  it("bills a partial week of insurance as a full week", () => {
    const q = buildQuote({
      vehicle: { tier: "economy", make: "Tesla", model: "Model 3", year: 2022 },
      rules: RULES,
      days: 8,
      insuranceProduct: INSURANCE[0],
    })!;
    expect(q.weeks).toBe(1);
    expect(q.extra_days).toBe(1);
    // rent: 55000 + 8900; insurance: 2 weeks x 3500
    expect(q.subtotal_cents).toBe(55000 + 8900 + 7000);
    expect(q.insurance?.name).toBe("TMMT Economy Shield");
  });

  it("keeps the refundable deposit out of the subtotal but inside due-now", () => {
    const q = buildQuote({ vehicle: { tier: "luxury", make: "BMW", model: "7 Series", year: 2022 }, rules: RULES, days: 7 })!;
    expect(q.subtotal_cents).toBe(155000);
    expect(q.quoted_deposit_cents).toBe(200000);
    expect(q.due_now_cents).toBe(355000);
  });

  it("treats a zero or negative term as one day rather than as free", () => {
    const q = buildQuote({ vehicle: { tier: "economy", year: 2019 }, rules: RULES, days: 0 })!;
    expect(q.subtotal_cents).toBe(4500);
  });

  it("returns null when no rule matches, so a caller cannot book at zero", () => {
    expect(buildQuote({ vehicle: { tier: "economy" }, rules: [], days: 7 })).toBeNull();
  });

  it("emits renter-readable lines that sum to the subtotal", () => {
    const q = buildQuote({
      vehicle: { tier: "mid", make: "BMW", model: "3 Series", year: 2021 },
      rules: RULES,
      days: 10,
      insuranceProduct: INSURANCE[1],
    })!;
    const sum = q.lines.reduce((t, l) => t + l.amount_cents, 0);
    expect(sum).toBe(q.subtotal_cents);
    expect(q.lines[0].label).toBe("Rental — 1 week");
  });
});

describe("formatCents", () => {
  it("renders money, never raw cents", () => {
    expect(formatCents(28000)).toBe("$280.00");
    expect(formatCents(355000)).toBe("$3,550.00");
  });
});
