import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Authz on the rental board.
 *
 * The question this file answers is the T-02 question: did a rejected request
 * reach the database? `touched` records every table the action asked for, so an
 * empty list is the proof.
 */

const db = vi.hoisted(() => ({
  getUser: vi.fn(),
  touched: [] as string[],
  rows: {} as Record<string, unknown[]>,
}));

vi.mock("@/lib/supabase-server", () => ({
  createSSRClient: async () => ({
    auth: { getUser: db.getUser },
    from: (table: string) => {
      db.touched.push(table);
      const builder: Record<string, unknown> = {};
      const result = { data: db.rows[table] ?? [], error: null };
      for (const m of ["select", "eq", "in"]) {
        builder[m] = () => builder;
      }
      builder.maybeSingle = async () => ({ data: (db.rows[table] ?? [])[0] ?? null, error: null });
      builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(result));
      return builder;
    },
  }),
}));

import { addVehicleToBoard, loadBoard, placeHold } from "./actions";

const WINDOW = ["2026-10-01T10:00:00.000Z", "2026-10-08T10:00:00.000Z"] as const;

beforeEach(() => {
  vi.resetAllMocks();
  db.touched = [];
  db.rows = {};
  db.getUser.mockResolvedValue({ data: { user: { app_metadata: { role: "admin" } } } });
});

describe("loadBoard authz", () => {
  it("refuses an anonymous caller without reading a single table", async () => {
    db.getUser.mockResolvedValue({ data: { user: null } });
    const res = await loadBoard(...WINDOW);
    expect(res).toEqual({ ok: false, error: "Sign in first." });
    expect(db.touched).toEqual([]);
  });

  it("refuses a signed-in non-staff user without reading a single table", async () => {
    db.getUser.mockResolvedValue({ data: { user: { app_metadata: { role: "customer" } } } });
    const res = await loadBoard(...WINDOW);
    expect(res).toEqual({ ok: false, error: "Staff only." });
    expect(db.touched).toEqual([]);
  });

  it("refuses a backwards window before touching the database", async () => {
    const res = await loadBoard(WINDOW[1], WINDOW[0]);
    expect(res.ok).toBe(false);
    expect(db.touched).toEqual([]);
  });

  it("reads vehicles for a staff caller", async () => {
    const res = await loadBoard(...WINDOW);
    expect(res.ok).toBe(true);
    expect(db.touched).toContain("vehicles");
  });
});

describe("placeHold authz — nothing is written by a rejected caller", () => {
  const input = {
    vehicleId: "veh-1",
    startsAtISO: WINDOW[0],
    endsAtISO: WINDOW[1],
    customerName: "Test Renter",
    customerEmail: "renter@example.com",
  };

  it("refuses an anonymous caller and writes nothing", async () => {
    db.getUser.mockResolvedValue({ data: { user: null } });
    const res = await placeHold(input);
    expect(res).toEqual({ ok: false, error: "Sign in first." });
    expect(db.touched).toEqual([]);
  });

  it("refuses a non-staff caller and writes nothing", async () => {
    db.getUser.mockResolvedValue({ data: { user: { app_metadata: { role: "operator" } } } });
    const res = await placeHold(input);
    expect(res).toEqual({ ok: false, error: "Staff only." });
    expect(db.touched).toEqual([]);
  });

  it("requires a renter name and email before touching the database", async () => {
    expect((await placeHold({ ...input, customerName: "  " })).ok).toBe(false);
    expect((await placeHold({ ...input, customerEmail: "" })).ok).toBe(false);
    expect(db.touched).toEqual([]);
  });

  it("refuses a vehicle with no tier rather than guessing one", async () => {
    db.rows.vehicles = [{ id: "veh-1", tier: null, org_id: "org-1" }];
    const res = await placeHold(input);
    expect(res).toEqual({
      ok: false,
      error: "This vehicle has no tier set, so it cannot be priced.",
    });
    expect(db.touched).not.toContain("bookings");
  });

  it("refuses a vehicle with no organisation", async () => {
    db.rows.vehicles = [{ id: "veh-1", tier: "economy", org_id: null }];
    const res = await placeHold(input);
    expect(res.ok).toBe(false);
    expect(db.touched).not.toContain("bookings");
  });
});

describe("addVehicleToBoard — the tier decision, guarded", () => {
  const ok = { fleetId: "f-1", tier: "economy" };

  it("refuses an anonymous caller without touching the database", async () => {
    db.getUser.mockResolvedValue({ data: { user: null } });
    expect(await addVehicleToBoard(ok)).toEqual({ ok: false, error: "Sign in first." });
    expect(db.touched).toEqual([]);
  });

  it("refuses a non-staff caller without touching the database", async () => {
    db.getUser.mockResolvedValue({ data: { user: { app_metadata: { role: "customer" } } } });
    expect(await addVehicleToBoard(ok)).toEqual({ ok: false, error: "Staff only." });
    expect(db.touched).toEqual([]);
  });

  it("refuses a bogus tier rather than defaulting to economy", async () => {
    const res = await addVehicleToBoard({ fleetId: "f-1", tier: "sport_bike" });
    expect(res.ok).toBe(false);
    expect(db.touched).toEqual([]);
  });

  it("REFUSES a car with no posted price instead of letting the rate card guess", async () => {
    // The card prices a 7 Series at $1,550/wk against a $300-550 gig fleet.
    // Falling back to it is the money bug, so an unpriced car is refused.
    db.rows.fleet = [{ id: "f-1", vehicle_make: "Toyota", org_id: "org-1", weekly_prices: null }];
    const res = await addVehicleToBoard(ok);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no posted weekly price/);
  });

  it("refuses a car with no organisation", async () => {
    db.rows.fleet = [{ id: "f-1", vehicle_make: "Toyota", org_id: null, weekly_prices: ["400"] }];
    const res = await addVehicleToBoard(ok);
    expect(res.ok).toBe(false);
  });

  it("refuses a car that is already on the board", async () => {
    db.rows.fleet = [{ id: "f-1", vehicle_make: "Toyota", org_id: "org-1", weekly_prices: ["400"] }];
    db.rows.vehicles = [{ id: "veh-existing" }];
    const res = await addVehicleToBoard(ok);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/already on the board/);
  });
});
