import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetDegradedForTests, clearDegraded, reportDegraded } from "@/lib/degraded";
import { GET } from "./route";

// S-1: the deep probe goes through the one service-role factory; tests hand in
// a double whose HEAD select resolves, errors, throws or never answers.
const probe = vi.hoisted(() => ({
  result: { error: null } as { error: { message: string; code?: string } | null },
  throwOnCreate: false,
  calls: [] as string[],
}));
vi.mock("@/lib/supabase-service", () => ({
  createServiceRoleClient: () => {
    if (probe.throwOnCreate) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return {
      from: (table: string) => {
        probe.calls.push(table);
        const chain = {
          select: () => chain,
          limit: () => chain,
          abortSignal: () => Promise.resolve(probe.result),
        };
        return chain;
      },
    };
  },
}));

/**
 * F-18: /api/health carries a `degraded` array next to `ok: true`. The status
 * code and the fields smoke-prod already reads are unchanged, so an old check
 * keeps passing while a new one can see which fallbacks are engaged.
 */
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  _resetDegradedForTests();
  probe.result = { error: null };
  probe.throwOnCreate = false;
  probe.calls = [];
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

describe("GET /api/health?deep=1 (S-1: prove the database answers)", () => {
  const SECRET = "test-cron-secret";
  const deepReq = (headers: Record<string, string> = {}, qs = "deep=1") =>
    new Request(`https://tmmt-ops.test/api/health?${qs}`, { headers });

  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("the plain probe never touches the database", async () => {
    const res = await GET(new Request("https://tmmt-ops.test/api/health"));
    expect(res.status).toBe(200);
    expect(probe.calls).toEqual([]);
  });

  it("refuses without the secret and does not query", async () => {
    const res = await GET(deepReq());
    expect(res.status).toBe(401);
    expect(probe.calls).toEqual([]);
    const wrong = await GET(deepReq({ authorization: "Bearer nope" }));
    expect(wrong.status).toBe(401);
    expect(probe.calls).toEqual([]);
  });

  it("fails closed when no secret is configured at all", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("OPS_COMMAND_SECRET", "");
    const res = await GET(deepReq({ authorization: "Bearer " }));
    expect(res.status).toBe(401);
    expect(probe.calls).toEqual([]);
  });

  it("is 200 db:ok when the round trip succeeds (Bearer or x-cron-secret)", async () => {
    const variants: Record<string, string>[] = [{ authorization: `Bearer ${SECRET}` }, { "x-cron-secret": SECRET }];
    for (const headers of variants) {
      const res = await GET(deepReq(headers));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ ok: true, service: "tmmt-ops", db: "ok" });
      expect(typeof body.db_ms).toBe("number");
    }
    expect(probe.calls).toEqual(["organizations", "organizations"]);
  });

  it("is 503 db:fail when the database returns an error, without leaking it", async () => {
    probe.result = { error: { message: "Invalid API key", code: "401" } };
    const res = await GET(deepReq({ authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, db: "fail" });
    expect(JSON.stringify(body)).not.toContain("Invalid API key");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("[health] deep probe failed"));
  });

  it("is 503 db:fail when the client cannot even be built (env missing)", async () => {
    probe.throwOnCreate = true;
    const res = await GET(deepReq({ authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, db: "fail" });
    expect(JSON.stringify(body)).not.toContain("SERVICE_ROLE");
  });
});
