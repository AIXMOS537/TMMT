import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Postcondition test for the nightly journey recompute. An authorized call
 * must run the real job (lib/client-journey/recompute.ts) and leave its
 * writes behind; an unauthorized call must run nothing. The DB is a double
 * that records every call.
 */
const db = vi.hoisted(() => ({
  journeys: [] as { customer_email: string }[],
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  inserts: [] as { table: string; row: Record<string, unknown> }[],
  upserts: [] as { table: string; row: Record<string, unknown> }[],
  fromCalls: 0,
}));

vi.mock("@/lib/supabase-service", () => ({
  createServiceRoleClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      db.rpcCalls.push({ fn, args });
      return { data: "journey-1", error: null };
    },
    from: (table: string) => {
      db.fromCalls += 1;
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "order", "ilike", "eq", "in", "is", "delete"]) chain[m] = () => chain;
      chain.limit = async () => ({ data: table === "client_journey" ? db.journeys : [], error: null });
      chain.maybeSingle = async () => ({ data: { id: "profile-1" }, error: null });
      chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(res);
      chain.insert = async (row: Record<string, unknown>) => {
        db.inserts.push({ table, row });
        return { error: null };
      };
      chain.upsert = async (row: Record<string, unknown>) => {
        db.upserts.push({ table, row });
        return { error: null };
      };
      return chain;
    },
  }),
}));

vi.mock("@/lib/client-journey/queries", () => ({
  getJourneyHub: async (email: string) => ({
    journey: { id: "journey-1", customer_email: email },
    education: { allAcknowledged: false },
    training: { coreComplete: false, coreDone: 0 },
    gates: { basePathSatisfied: false },
    lto: { eligible: true },
  }),
}));
vi.mock("@/lib/client-journey/journey-alerts", () => ({
  journeyAlertTemplates: () => [
    { alert_type: "lto_ready", title: "t", message: "m", priority: "high", dueInDays: 0 },
  ],
}));

import { GET } from "./route";

const SECRET = "cron-secret-test";
const call = (headers: Record<string, string> = {}, qs = "") =>
  GET(new Request(`https://tmmt-ops.test/api/cron/journey-recompute${qs}`, { headers }));

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  db.journeys = [{ customer_email: "A@example.test" }, { customer_email: "b@example.test" }];
  db.rpcCalls = [];
  db.inserts = [];
  db.upserts = [];
  db.fromCalls = 0;
});

describe("/api/cron/journey-recompute postconditions", () => {
  it("authorized: recomputes every journey and writes alerts + checkpoints", async () => {
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, processed: 2 });
    expect(db.rpcCalls.map((c) => c.args.p_email)).toEqual(["a@example.test", "b@example.test"]);
    expect(db.inserts.filter((i) => i.table === "client_alerts")).toHaveLength(2);
    expect(db.upserts.filter((u) => u.row.checkpoint_slug === "lto_eligible")).toHaveLength(2);
  });

  it.each([
    ["no header", {}],
    ["wrong bearer", { authorization: "Bearer nope" }],
    ["empty bearer", { authorization: "Bearer " }],
  ])("unauthorized (%s): 401 and nothing runs", async (_l, headers) => {
    const res = await call(headers as Record<string, string>);
    expect(res.status).toBe(401);
    expect(db.fromCalls).toBe(0);
    expect(db.rpcCalls).toEqual([]);
    expect(db.inserts).toEqual([]);
  });

  it("unauthorized when no secret is configured, even with a Bearer", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("OPS_COMMAND_SECRET", "");
    const res = await call({ authorization: "Bearer " });
    expect(res.status).toBe(401);
    expect(db.fromCalls).toBe(0);
  });
});
