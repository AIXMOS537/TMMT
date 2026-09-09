import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The rule these pin: a count that FAILED and a count of ZERO are different
 * facts. The screen shows "—" for the first and "0" for the second, and only
 * the first is reported as degraded. Blurring them is how an empty-looking
 * dashboard gets mistaken for a quiet week.
 */
const h = vi.hoisted(() => ({ resolveVentureDb: vi.fn() }));
vi.mock("@/lib/ventures/client", () => ({
  resolveVentureDb: h.resolveVentureDb,
  isVentureDbConfigured: () => h.resolveVentureDb() !== null,
}));

/** Stands in for the PostgREST head-count builder, per table. */
function dbWithCounts(per: Record<string, { count: number | null; error: { message: string } | null }>) {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(async () => per[table] ?? { count: 0, error: null }),
    })),
  };
}

async function load() {
  vi.resetModules();
  const degraded = await import("@/lib/degraded");
  degraded._resetDegradedForTests();
  const summary = await import("@/lib/ventures/summary");
  return { ...summary, ...degraded };
}

beforeEach(() => void vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => {
  vi.restoreAllMocks();
  h.resolveVentureDb.mockReset();
});

const VENTURE = "00000000-0000-0000-0000-000000000001";

describe("getVentureSummary", () => {
  it("reports the counts the tables actually hold", async () => {
    h.resolveVentureDb.mockReturnValue(
      dbWithCounts({ fleet: { count: 43, error: null }, tickets: { count: 308, error: null } })
    );
    const { getVentureSummary, getDegradedComponents } = await load();
    const rows = await getVentureSummary(VENTURE);

    expect(rows.find(r => r.table === "fleet")?.count).toBe(43);
    expect(rows.find(r => r.table === "tickets")?.count).toBe(308);
    expect(getDegradedComponents()).toEqual([]);
  });

  it("an empty table is 0, and stays quiet", async () => {
    h.resolveVentureDb.mockReturnValue(dbWithCounts({ contracts: { count: 0, error: null } }));
    const { getVentureSummary, getDegradedComponents } = await load();

    expect((await getVentureSummary(VENTURE)).find(r => r.table === "contracts")?.count).toBe(0);
    expect(getDegradedComponents()).toEqual([]);
  });

  it("a failed count is null — never 0 — and is reported", async () => {
    h.resolveVentureDb.mockReturnValue(
      dbWithCounts({ insurance: { count: null, error: { message: "permission denied" } } })
    );
    const { getVentureSummary, getDegradedComponents } = await load();
    const rows = await getVentureSummary(VENTURE);

    expect(rows.find(r => r.table === "insurance")?.count).toBeNull();
    const [rec] = getDegradedComponents();
    expect(rec.component).toBe("venture-registry");
    expect(rec.reason).toContain("insurance");
  });

  it("one broken table does not blank the others", async () => {
    h.resolveVentureDb.mockReturnValue(
      dbWithCounts({
        fleet: { count: 43, error: null },
        insurance: { count: null, error: { message: "permission denied" } },
      })
    );
    const { getVentureSummary } = await load();
    const rows = await getVentureSummary(VENTURE);

    expect(rows.find(r => r.table === "fleet")?.count).toBe(43);
    expect(rows.find(r => r.table === "insurance")?.count).toBeNull();
    expect(rows.every(r => typeof r.label === "string" && r.label.length > 0)).toBe(true);
  });

  it("with no client at all, every figure is unavailable rather than zero", async () => {
    h.resolveVentureDb.mockReturnValue(null);
    const { getVentureSummary, getDegradedComponents } = await load();
    const rows = await getVentureSummary(VENTURE);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.count === null)).toBe(true);
    expect(getDegradedComponents()[0].reason).toContain("no Supabase client");
  });
});
