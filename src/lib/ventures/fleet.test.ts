import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listVentureFleet, summariseFleet, type VentureFleetRow } from "@/lib/ventures/fleet";
import { _resetDegradedForTests, getDegradedComponents } from "@/lib/degraded";

/**
 * Same rule as the summary counts, one level down: an empty fleet and an
 * unreadable one are different facts, and the screen says so. `failed` is what
 * keeps "no vehicles yet" from being printed over a permission error.
 */
function db(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(async () => result);
  return { from: vi.fn(() => chain) } as never;
}

const ROW: VentureFleetRow = {
  id: "f1",
  vehicle_name: null,
  vehicle_make: "Toyota",
  vehicle_model: "Camry",
  year: 2021,
  vehicle_status: "Available",
  license_plate: "ABC1234",
  color: "Silver",
};

beforeEach(() => {
  _resetDegradedForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("listVentureFleet", () => {
  it("returns the vehicles the client can see", async () => {
    const res = await listVentureFleet(db({ data: [ROW], error: null }));
    expect(res).toEqual({ rows: [ROW], failed: false });
    expect(getDegradedComponents()).toEqual([]);
  });

  it("an empty fleet is empty and quiet", async () => {
    const res = await listVentureFleet(db({ data: [], error: null }));
    expect(res).toEqual({ rows: [], failed: false });
    expect(getDegradedComponents()).toEqual([]);
  });

  it("a failed read is flagged, not printed as an empty fleet", async () => {
    const res = await listVentureFleet(db({ data: null, error: { message: "permission denied" } }));
    expect(res.failed).toBe(true);
    expect(res.rows).toEqual([]);
    expect(getDegradedComponents()[0].reason).toContain("permission denied");
  });
});

describe("summariseFleet", () => {
  it("counts by status, commonest first", () => {
    expect(
      summariseFleet([
        { ...ROW, id: "a", vehicle_status: "Available" },
        { ...ROW, id: "b", vehicle_status: "Rented" },
        { ...ROW, id: "c", vehicle_status: "Rented" },
      ])
    ).toEqual([
      { status: "Rented", count: 2 },
      { status: "Available", count: 1 },
    ]);
  });

  it("a missing or blank status is labelled, not dropped", () => {
    const out = summariseFleet([
      { ...ROW, id: "a", vehicle_status: null },
      { ...ROW, id: "b", vehicle_status: "   " },
    ]);
    expect(out).toEqual([{ status: "Unspecified", count: 2 }]);
  });

  it("no vehicles means no rows, not a zero bucket", () => {
    expect(summariseFleet([])).toEqual([]);
  });
});
