import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The registry this replaces answered a dead Supabase project by returning a
 * hard-coded "TMMT Rentals" venture, so nobody could tell a one-venture
 * business from a broken connection. These tests pin the distinction: real rows
 * come back as rows, an empty table comes back empty, and a failure is loud and
 * returns nothing rather than inventing a venture.
 */

const h = vi.hoisted(() => ({ resolveVentureDb: vi.fn() }));
vi.mock("@/lib/ventures/client", () => ({
  resolveVentureDb: h.resolveVentureDb,
  isVentureDbConfigured: () => h.resolveVentureDb() !== null,
}));

const ROW = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "tmmt-rentals",
  name: "TMMT Rentals",
  description: "Vehicle rental operations",
  color: "#2563eb",
  logo_url: null,
  status: "active" as const,
  pinned_widgets: [],
};

/** Minimal stand-in for the PostgREST builder chain the registry uses. */
function dbReturning(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => result);
  // getActiveVentures awaits the builder itself after .order()
  (chain as { then?: unknown }).then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
  return { from: vi.fn(() => chain) };
}

async function load() {
  vi.resetModules();
  const degraded = await import("@/lib/degraded");
  degraded._resetDegradedForTests();
  const registry = await import("@/lib/ventures/registry");
  return { ...registry, ...degraded };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  h.resolveVentureDb.mockReset();
});

describe("venture registry", () => {
  it("returns the ventures the database actually holds", async () => {
    h.resolveVentureDb.mockReturnValue(dbReturning({ data: [ROW], error: null }));
    const { getActiveVentures, getDegradedComponents } = await load();

    await expect(getActiveVentures()).resolves.toEqual([ROW]);
    expect(getDegradedComponents()).toEqual([]);
  });

  it("an empty registry is empty — it does not invent TMMT Rentals", async () => {
    h.resolveVentureDb.mockReturnValue(dbReturning({ data: [], error: null }));
    const { getActiveVentures, getDegradedComponents } = await load();

    await expect(getActiveVentures()).resolves.toEqual([]);
    expect(getDegradedComponents()).toEqual([]);
  });

  it("a failed query is loud and returns nothing", async () => {
    h.resolveVentureDb.mockReturnValue(dbReturning({ data: null, error: { message: "relation missing" } }));
    const { getActiveVentures, getDegradedComponents } = await load();

    await expect(getActiveVentures()).resolves.toEqual([]);
    const [rec] = getDegradedComponents();
    expect(rec.component).toBe("venture-registry");
    expect(rec.reason).toContain("relation missing");
  });

  it("no database client at all is reported, not silently empty", async () => {
    h.resolveVentureDb.mockReturnValue(null);
    const { getActiveVentures, getDegradedComponents } = await load();

    await expect(getActiveVentures()).resolves.toEqual([]);
    expect(getDegradedComponents()[0].reason).toContain("no Supabase client");
  });

  it("looks a venture up by slug", async () => {
    h.resolveVentureDb.mockReturnValue(dbReturning({ data: ROW, error: null }));
    const { getVentureBySlug } = await load();

    await expect(getVentureBySlug("tmmt-rentals")).resolves.toEqual(ROW);
  });

  it("an unknown slug is a 404, not a degraded component", async () => {
    h.resolveVentureDb.mockReturnValue(dbReturning({ data: null, error: null }));
    const { getVentureBySlug, getDegradedComponents } = await load();

    await expect(getVentureBySlug("chauffeur")).resolves.toBeNull();
    expect(getDegradedComponents()).toEqual([]);
  });

  it("an empty slug never reaches the database", async () => {
    const db = dbReturning({ data: ROW, error: null });
    h.resolveVentureDb.mockReturnValue(db);
    const { getVentureBySlug } = await load();

    await expect(getVentureBySlug("   ")).resolves.toBeNull();
    expect(db.from).not.toHaveBeenCalled();
  });
});

describe("ventureHref", () => {
  it("builds venture-scoped URLs", async () => {
    const { ventureHref } = await import("@/lib/ventures/paths");
    expect(ventureHref("tmmt-rentals")).toBe("/v/tmmt-rentals");
    expect(ventureHref("tmmt-rentals", "/")).toBe("/v/tmmt-rentals");
    expect(ventureHref("detailing", "fleet")).toBe("/v/detailing/fleet");
    expect(ventureHref("chauffeur", "/tickets")).toBe("/v/chauffeur/tickets");
  });
});
