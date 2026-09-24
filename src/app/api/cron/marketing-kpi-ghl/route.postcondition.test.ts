import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Postcondition test for the weekly GHL KPI job, running the real sync
 * (lib/marketing-kpi/ghl-sync.ts) against a recording DB double: an
 * authorized call upserts the week's row; an unauthorized one touches nothing.
 */
const db = vi.hoisted(() => ({
  upserts: [] as Record<string, unknown>[],
  fromCalls: 0,
}));

vi.mock("@/lib/ghl/client", () => ({ isGhlConfigured: () => true }));
vi.mock("@/lib/supabase-service", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      db.fromCalls += 1;
      const rows = table === "ghl_contacts" ? [{ id: "c1", tags: ["vip"] }, { id: "c2", tags: [] }] : [];
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "gte", "lt", "eq"]) chain[m] = () => chain;
      chain.then = (res: (v: unknown) => unknown) =>
        Promise.resolve({ data: rows, count: 0, error: null }).then(res);
      chain.maybeSingle = async () => ({ data: { followers: 7 }, error: null });
      chain.upsert = (row: Record<string, unknown>) => {
        db.upserts.push(row);
        return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
      };
      return chain;
    },
  }),
}));

import { GET } from "./route";

const SECRET = "cron-secret-test";
const call = (headers: Record<string, string> = {}) =>
  GET(new Request("https://tmmt-ops.test/api/cron/marketing-kpi-ghl?week_start=2026-09-21", { headers }));

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  db.upserts = [];
  db.fromCalls = 0;
});

describe("/api/cron/marketing-kpi-ghl postconditions", () => {
  it("authorized: upserts marketing_kpi_weeks for the week, keeping manual fields", async () => {
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    expect(db.upserts).toHaveLength(1);
    expect(db.upserts[0]).toMatchObject({
      week_start: "2026-09-21",
      followers: 7,
      email_list_growth: 2,
      new_subscribers: 1,
    });
    expect(typeof db.upserts[0].ghl_synced_at).toBe("string");
  });

  it.each([
    ["no header", {}],
    ["wrong bearer", { authorization: "Bearer nope" }],
  ])("unauthorized (%s): 401 and no DB access at all", async (_l, headers) => {
    const res = await call(headers as Record<string, string>);
    expect(res.status).toBe(401);
    expect(db.fromCalls).toBe(0);
    expect(db.upserts).toEqual([]);
  });
});
