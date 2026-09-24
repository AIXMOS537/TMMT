import { beforeEach, expect, it, vi, describe } from "vitest";

const db = vi.hoisted(() => ({ getUser: vi.fn(), select: vi.fn() }));

vi.mock("@/lib/supabase-server", () => ({
  createSSRClient: async () => ({
    auth: { getUser: db.getUser },
    from: (table: string) => ({
      select: () => ({
        eq: async () => db.select(table),
      }),
    }),
  }),
}));

import { POST } from "./route";

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

beforeEach(() => {
  vi.resetAllMocks();
  db.getUser.mockResolvedValue({ data: { user: { app_metadata: { role: "admin" } } } });
  db.select.mockImplementation((table: string) =>
    table === "rental_pricing_rules" ? { data: [RULE] } : { data: [SHIELD] }
  );
});

function request(body: unknown) {
  return new Request("http://localhost/api/rental/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("authz — the rate card is commercially sensitive", () => {
  it("never quotes for an anonymous caller, and never reads the rate card", async () => {
    db.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(request({ tier: "economy", days: 7 }));
    expect(res.status).toBe(401);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("never quotes for a signed-in non-staff user", async () => {
    db.getUser.mockResolvedValue({ data: { user: { app_metadata: { role: "customer" } } } });
    const res = await POST(request({ tier: "economy", days: 7 }));
    expect(res.status).toBe(403);
    expect(db.select).not.toHaveBeenCalled();
  });
});

describe("input validation", () => {
  it("rejects a missing or bogus tier without touching the database", async () => {
    for (const body of [{ days: 7 }, { tier: "platinum", days: 7 }]) {
      const res = await POST(request(body));
      expect(res.status).toBe(400);
    }
    expect(db.select).not.toHaveBeenCalled();
  });

  it("rejects a non-positive term", async () => {
    const res = await POST(request({ tier: "economy", days: 0 }));
    expect(res.status).toBe(400);
  });
});

describe("quoting", () => {
  it("quotes a week off the tier card when the car has no posted price", async () => {
    const res = await POST(request({ tier: "economy", days: 7, backgroundApproved: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.quote.quoted_weekly_cents).toBe(28000);
    expect(body.rateSource).toBe("tier_card");
  });

  it("prefers the car's own posted price over the tier card", async () => {
    const res = await POST(request({
      tier: "economy", days: 7, backgroundApproved: true,
      postedWeeklyPrice: "500", lowestPossiblePrice: "450",
    }));
    const body = await res.json();
    expect(body.quote.quoted_weekly_cents).toBe(50000);
    expect(body.rateSource).toBe("fleet_posted");
  });

  it("REFUSES with 422 when the tier card falls below the car's floor", async () => {
    // The live bug: card says $280/wk, this car's floor is $450/wk.
    const res = await POST(request({
      tier: "economy", days: 7, backgroundApproved: true, lowestPossiblePrice: "450",
    }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, reason: "below_floor", floorWeeklyCents: 45000 });
  });

  it("returns 422, never a fallback price, when the rate card reads back empty", async () => {
    db.select.mockImplementation((table: string) =>
      table === "rental_pricing_rules" ? { data: [] } : { data: [SHIELD] }
    );
    const res = await POST(request({ tier: "economy", days: 7 }));
    expect(res.status).toBe(422);
    expect((await res.json()).reason).toBe("no_pricing_rules");
  });

  it("offers no coverage to an unapproved renter", async () => {
    const res = await POST(request({ tier: "economy", days: 7, backgroundApproved: false }));
    const body = await res.json();
    expect(body.insuranceOptions).toEqual([]);
  });

  it("lists coverage once approved, without leaking internal columns", async () => {
    const res = await POST(request({ tier: "economy", days: 7, backgroundApproved: true }));
    const body = await res.json();
    expect(body.insuranceOptions).toEqual([
      { id: "i-econ", name: "TMMT Economy Shield", coverage_source: "tmmt_internal", weekly_premium_cents: 3500 },
    ]);
    // min_liability_cents / requires_background_approved stay server-side.
    expect(body.insuranceOptions[0]).not.toHaveProperty("min_liability_cents");
  });
});
