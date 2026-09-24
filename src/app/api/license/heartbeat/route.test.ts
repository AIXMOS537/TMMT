import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetDegradedForTests } from "@/lib/degraded";

/**
 * S-2 (production finding F-10): the heartbeat is unauthenticated, so it must
 * not (a) tell a provisioned org from an unprovisioned one, (b) write an audit
 * row per request, or (c) accept unbounded bursts.
 *
 * The limiter RPC is reported missing (as in prod until the staged migration
 * lands), so these run on the in-memory fallback. Each test uses its own IP
 * and org id so the per-process counters never bleed between tests.
 */
const state = vi.hoisted(() => ({
  license: null as null | Record<string, unknown>,
  audits: [] as { action: string; organizationId: string | null }[],
  updates: 0,
}));

vi.mock("@/lib/agent/audit", () => ({
  emitAudit: async (evt: { action: string; organizationId: string | null }) => {
    state.audits.push({ action: evt.action, organizationId: evt.organizationId });
  },
}));

vi.mock("@/lib/supabase-service", () => ({
  createServiceRoleClient: () => ({
    rpc: async () => ({ data: null, error: { message: "function rate_limit_hit does not exist", code: "42883" } }),
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: async () => ({ data: state.license, error: state.license ? null : { code: "PGRST116" } }),
        update: () => {
          state.updates += 1;
          return { eq: async () => ({ error: null }) };
        },
      };
      return chain;
    },
  }),
}));

import { POST } from "./route";

let seq = 0;
function fresh() {
  seq += 1;
  return {
    ip: `203.0.113.${seq}`,
    org: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
  };
}
function hb(ip: string, body: unknown) {
  return POST(
    new Request("https://tmmt-ops.test/api/license/heartbeat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}
const HW = "HW-REAL-0001";
const provisioned = (extra: Record<string, unknown> = {}) => ({
  active: true, kill_command: null, hardware_uuid: HW, install_token_used: true, ...extra,
});

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  _resetDegradedForTests();
  state.license = null;
  state.audits = [];
  state.updates = 0;
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe("POST /api/license/heartbeat (S-2)", () => {
  it("still 400s on missing fields and bad JSON", async () => {
    const { ip } = fresh();
    expect((await hb(ip, { organization_id: "x" })).status).toBe(400);
    const bad = await POST(new Request("https://t/api/license/heartbeat", { method: "POST", body: "{" }));
    expect(bad.status).toBe(400);
  });

  it("answers unknown org, unprovisioned org, hardware mismatch and junk ids with the SAME 404", async () => {
    const bodies: string[] = [];

    let { ip, org } = fresh();
    state.license = null; // unknown org
    let res = await hb(ip, { organization_id: org, hardware_uuid: HW });
    expect(res.status).toBe(404);
    bodies.push(await res.text());

    ({ ip, org } = fresh());
    state.license = provisioned({ install_token_used: false }); // never provisioned
    res = await hb(ip, { organization_id: org, hardware_uuid: HW });
    expect(res.status).toBe(404);
    bodies.push(await res.text());

    ({ ip, org } = fresh());
    state.license = provisioned(); // provisioned, wrong hardware
    res = await hb(ip, { organization_id: org, hardware_uuid: "HW-ATTACKER" });
    expect(res.status).toBe(404);
    bodies.push(await res.text());

    ({ ip } = fresh());
    res = await hb(ip, { organization_id: "x".repeat(500), hardware_uuid: HW }); // junk id
    expect(res.status).toBe(404);
    bodies.push(await res.text());

    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0])).toEqual({ error: "not found" });
  });

  it("writes at most one hardware-mismatch audit per org per window", async () => {
    const { org } = fresh();
    state.license = provisioned();
    for (let i = 0; i < 6; i++) {
      // Different IPs so the per-IP limit is not what stops the flood.
      const res = await hb(`198.51.100.${seq * 10 + i}`, { organization_id: org, hardware_uuid: `HW-FAKE-${i}` });
      expect([404, 429]).toContain(res.status);
    }
    expect(state.audits.filter((a) => a.action === "license.hardware_mismatch")).toHaveLength(1);
  });

  it("a healthy heartbeat is 200, stamps last_heartbeat_at, and audits once per window", async () => {
    const { ip, org } = fresh();
    state.license = provisioned();
    for (let i = 0; i < 3; i++) {
      const res = await hb(ip, { organization_id: org, hardware_uuid: HW });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, kill_command: null, cache_ttl_seconds: 86400 });
    }
    expect(state.updates).toBe(3);
    expect(state.audits.filter((a) => a.action === "license.heartbeat")).toHaveLength(1);
  });

  it("still returns 410 + kill_command for a disabled licence", async () => {
    const { ip, org } = fresh();
    state.license = provisioned({ active: false, kill_command: "wipe" });
    const res = await hb(ip, { organization_id: org, hardware_uuid: HW });
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: "license_disabled", kill_command: "wipe" });
  });

  it("rate-limits a burst from one IP with 429", async () => {
    const { ip } = fresh();
    state.license = null;
    const statuses: number[] = [];
    for (let i = 0; i < 35; i++) {
      const org = `00000000-0000-4000-9000-${String(seq * 100 + i).padStart(12, "0")}`;
      statuses.push((await hb(ip, { organization_id: org, hardware_uuid: HW })).status);
    }
    expect(statuses.slice(0, 30).every((s) => s === 404)).toBe(true);
    expect(statuses.slice(30).every((s) => s === 429)).toBe(true);
  });

  it("rate-limits one org hammered from many IPs with 429", async () => {
    const { org } = fresh();
    state.license = provisioned();
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await hb(`192.0.2.${i + 1}`, { organization_id: org, hardware_uuid: HW })).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(10).every((s) => s === 429)).toBe(true);
  });
});
