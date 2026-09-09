import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetDegradedForTests, clearDegraded, reportDegraded } from "@/lib/degraded";
import { GET } from "./route";

/**
 * F-18: /api/health carries a `degraded` array next to `ok: true`. The status
 * code and the fields smoke-prod already reads are unchanged, so an old check
 * keeps passing while a new one can see which fallbacks are engaged.
 */
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  _resetDegradedForTests();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("GET /api/health", () => {
  it("is 200 ok with an empty degraded list when every durable path is answering", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, service: "tmmt-ops", degraded: [] });
    expect(Number.isNaN(Date.parse(body.ts))).toBe(false);
  });

  it("lists engaged fallbacks without changing ok or the status code", async () => {
    reportDegraded("rate-limit", "function rate_limit_hit does not exist", { code: "42883" });
    reportDegraded("ghl-event-dedupe", 'relation "ghl_webhook_events" does not exist');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.degraded).toHaveLength(2);
    expect(body.degraded[0]).toMatchObject({ component: "ghl-event-dedupe", count: 1 });
    expect(body.degraded[1]).toMatchObject({
      component: "rate-limit",
      reason: "function rate_limit_hit does not exist",
      count: 1,
      meta: { code: "42883" },
    });
    expect(typeof body.degraded[1].since).toBe("string");
  });

  it("drops a component once it has recovered", async () => {
    reportDegraded("rate-limit", "blip");
    clearDegraded("rate-limit");
    const body = await (await GET()).json();
    expect(body.degraded).toEqual([]);
  });
});
