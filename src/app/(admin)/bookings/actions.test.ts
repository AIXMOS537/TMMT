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

import { loadBoard, placeHold } from "./actions";

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
