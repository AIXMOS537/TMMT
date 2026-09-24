import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetDegradedForTests, getDegradedComponents } from "@/lib/degraded";

/**
 * S-6 (finding F-11): the weekly GHL KPI job must fail visibly — non-2xx for
 * the Vercel cron run plus a `[degraded]` log line / health entry — instead
 * of passing silently.
 */
const sync = vi.hoisted(() => ({ impl: null as null | (() => Promise<unknown>) }));
vi.mock("@/lib/marketing-kpi/ghl-sync", () => ({
  syncMarketingKpiWeekFromGhl: () => sync.impl!(),
}));

import { GET, POST } from "./route";

const SECRET = "cron-secret-test";
const req = (headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) =>
  new Request("https://tmmt-ops.test/api/cron/marketing-kpi-ghl?week_start=2026-09-21", { headers });
const auto = (contacts_synced: number) => ({
  new_subscribers: 1, calls_booked: 0, dm_started: 0, email_list_growth: contacts_synced,
  source: "ghl_mirror", details: { contacts_synced },
});

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  _resetDegradedForTests();
  vi.stubEnv("CRON_SECRET", SECRET);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  errorSpy.mockRestore();
});

describe("/api/cron/marketing-kpi-ghl (S-6)", () => {
  it("401s without the secret and never runs the sync", async () => {
    sync.impl = vi.fn();
    const res = await GET(req({}));
    expect(res.status).toBe(401);
    expect(sync.impl).not.toHaveBeenCalled();
  });

  it("is 200 ok and not degraded when the mirror has data", async () => {
    sync.impl = async () => ({ row: { week_start: "2026-09-21" }, auto: auto(42) });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, week_start: "2026-09-21" });
    expect(getDegradedComponents()).toEqual([]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("is 500 + a [degraded] log line when the sync throws", async () => {
    sync.impl = async () => {
      throw new Error("marketing KPI read failed: ghl_contacts (401: Invalid API key)");
    };
    const res = await GET(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: "sync failed" });
    expect(JSON.stringify(body)).not.toContain("Invalid API key");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('"component":"marketing-kpi-ghl"'));
    expect(getDegradedComponents().map((d) => d.component)).toEqual(["marketing-kpi-ghl"]);
  });

  it("is 503 + degraded when zero contacts synced in the week (stale mirror)", async () => {
    sync.impl = async () => ({ row: { week_start: "2026-09-21" }, auto: auto(0) });
    const res = await GET(req());
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, error: "ghl_mirror_stale" });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("GHL mirror looks stale"));
    expect(getDegradedComponents().map((d) => d.component)).toEqual(["marketing-kpi-ghl"]);
  });

  it("clears the degraded flag once a later run is healthy", async () => {
    sync.impl = async () => ({ row: {}, auto: auto(0) });
    await GET(req());
    sync.impl = async () => ({ row: {}, auto: auto(5) });
    expect((await GET(req())).status).toBe(200);
    expect(getDegradedComponents()).toEqual([]);
  });
});
