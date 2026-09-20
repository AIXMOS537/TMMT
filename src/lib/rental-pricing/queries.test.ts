import { describe, it, expect } from "vitest";
import { makeFakeSupabase } from "@/lib/testing/fake-supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fleetRowToQuotable, normalizeTier, quoteVehicle } from "./queries";

const RULE = {
  id: "r-econ", tier: "economy", make: null, model: null, year_min: null, year_max: null,
  daily_rate_cents: 4500, weekly_rate_cents: 28000, deposit_cents: 40000,
  match_priority: 0, active: true,
};
const SHIELD = {
  id: "i-econ", tier: "economy", coverage_source: "tmmt_internal", name: "TMMT Economy Shield",
  weekly_premium_cents: 3500, min_liability_cents: 25000000,
  requires_background_approved: true, active: true,
};

function client(rules: unknown[], products: unknown[]) {
  return makeFakeSupabase((call) => {
    if (call.table === "rental_pricing_rules") return { data: rules };
    if (call.table === "rental_insurance_products") return { data: products };
    return { data: [] };
  }) as unknown as SupabaseClient;
}

describe("normalizeTier", () => {
  it("accepts the loose spellings the Airtable-derived fleet rows use", () => {
    expect(normalizeTier("Standard")).toBe("economy");
    expect(normalizeTier(" PREMIUM ")).toBe("mid");
    expect(normalizeTier("Exotic")).toBe("luxury");
  });

  it("returns null for anything it does not recognise, rather than guessing", () => {
    expect(normalizeTier("van")).toBeNull();
    expect(normalizeTier("")).toBeNull();
    expect(normalizeTier(null)).toBeNull();
  });
});

describe("fleetRowToQuotable", () => {
  it("maps a real fleet row, coercing the numeric-as-string year and trimming Airtable whitespace", () => {
    // Shape copied from production, trailing space and all: "Toyota ", "Camry ".
    const v = fleetRowToQuotable(
      { vehicle_make: "Toyota ", vehicle_model: "Camry ", year: "2017" },
      "economy"
    );
    expect(v).toEqual({ tier: "economy", make: "Toyota", model: "Camry", year: 2017 });
  });

  it("takes tier from the caller, never from the row", () => {
    // vehicle_class is unusable (3/43 populated, all 3 wrong in production),
    // so it is not even accepted as an input here.
    const v = fleetRowToQuotable({ vehicle_make: "Tesla", vehicle_model: "Model 3", year: 2019 }, "economy");
    expect(v.tier).toBe("economy");
  });

  it("keeps year null when the fleet row has none", () => {
    expect(fleetRowToQuotable({ vehicle_make: "Kia" }, "economy").year).toBeNull();
  });
});

describe("quoteVehicle — fails closed", () => {
  it("refuses when the rate card reads back empty (RLS shut-out or emptied table)", async () => {
    const r = await quoteVehicle(client([], [SHIELD]), {
      vehicle: { tier: "economy" }, days: 7, backgroundApproved: true,
    });
    expect(r).toEqual({ ok: false, reason: "no_pricing_rules" });
  });

  it("refuses when rules exist but none match the vehicle", async () => {
    const r = await quoteVehicle(client([RULE], [SHIELD]), {
      vehicle: { tier: "luxury" }, days: 7, backgroundApproved: true,
    });
    expect(r).toEqual({ ok: false, reason: "no_matching_rule" });
  });

  it("refuses coverage the renter is not eligible for instead of silently dropping it", async () => {
    const r = await quoteVehicle(client([RULE], [SHIELD]), {
      vehicle: { tier: "economy" }, days: 7,
      backgroundApproved: false, insuranceProductId: "i-econ",
    });
    expect(r).toEqual({ ok: false, reason: "insurance_required_background_not_approved" });
  });

  it("offers no coverage options at all to an unapproved renter", async () => {
    const r = await quoteVehicle(client([RULE], [SHIELD]), {
      vehicle: { tier: "economy" }, days: 7, backgroundApproved: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.insuranceOptions).toEqual([]);
  });

  it("prices a real week with coverage once the background check is approved", async () => {
    const r = await quoteVehicle(client([RULE], [SHIELD]), {
      vehicle: { tier: "economy", make: "Kia", year: 2019 }, days: 7,
      backgroundApproved: true, insuranceProductId: "i-econ",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.quote.subtotal_cents).toBe(28000 + 3500);
    expect(r.quote.due_now_cents).toBe(28000 + 3500 + 40000);
    expect(r.quote.pricing_rule_id).toBe("r-econ");
  });

  it("only ever reads the two rate tables — a quote must not touch anything else", async () => {
    const c = makeFakeSupabase((call) =>
      call.table === "rental_pricing_rules" ? { data: [RULE] } : { data: [SHIELD] }
    );
    await quoteVehicle(c as unknown as SupabaseClient, {
      vehicle: { tier: "economy" }, days: 7, backgroundApproved: true,
    });
    expect([...new Set(c.calls.map((x) => x.table))].sort()).toEqual([
      "rental_insurance_products",
      "rental_pricing_rules",
    ]);
    expect(c.calls.every((x) => x.op === "select")).toBe(true);
  });
});
