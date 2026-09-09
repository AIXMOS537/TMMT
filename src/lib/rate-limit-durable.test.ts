import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isRateLimitedDurable, _resetDurableWarning, type RateLimitBackend } from "./rate-limit-durable";
import { _resetDegradedForTests, getDegradedComponents } from "@/lib/degraded";

/**
 * F-18: `reportDegraded` is the real implementation wrapped in a spy — the
 * fallback stays observable here while the degraded state behaves as in
 * production.
 */
const h = vi.hoisted(() => ({ reportDegraded: vi.fn() }));
vi.mock("@/lib/degraded", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/degraded")>();
  h.reportDegraded.mockImplementation(mod.reportDegraded);
  return { ...mod, reportDegraded: h.reportDegraded };
});

let errorSpy: ReturnType<typeof vi.spyOn>;

function backend(result: { data: unknown; error: { message: string; code?: string } | null }, calls: unknown[] = []) {
  const db: RateLimitBackend = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return result;
    }),
  };
  return { db, calls };
}

beforeEach(() => {
  _resetDurableWarning();
  _resetDegradedForTests();
  h.reportDegraded.mockClear();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("isRateLimitedDurable", () => {
  it("asks Postgres with the key, window and cap, and trusts its verdict", async () => {
    const { db, calls } = backend({ data: true, error: null });
    const key = `k-${Math.random()}`;
    expect(await isRateLimitedDurable(key, { windowMs: 60_000, maxHits: 3 }, db)).toBe(true);
    expect(calls).toEqual([{ fn: "rate_limit_hit", args: { p_key: key, p_window_ms: 60_000, p_max_hits: 3 } }]);
    expect(h.reportDegraded).not.toHaveBeenCalled();
    expect(getDegradedComponents()).toEqual([]);
  });

  it("a false verdict from Postgres allows the request even if memory would have blocked", async () => {
    const { db } = backend({ data: false, error: null });
    const key = `k-${Math.random()}`;
    for (let i = 0; i < 10; i++) expect(await isRateLimitedDurable(key, { maxHits: 2 }, db)).toBe(false);
  });

  it("falls back to the in-memory limiter when the function does not exist yet", async () => {
    const { db } = backend({ data: null, error: { message: "function rate_limit_hit does not exist", code: "42883" } });
    const key = `k-${Math.random()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 3; i++) results.push(await isRateLimitedDurable(key, { maxHits: 2 }, db));
    expect(results).toEqual([false, false, true]); // memory limiter semantics, unchanged
    // F-18: every engagement is reported, one structured error line is logged.
    expect(h.reportDegraded).toHaveBeenCalledTimes(3);
    expect(h.reportDegraded).toHaveBeenCalledWith(
      "rate-limit",
      "function rate_limit_hit does not exist",
      { code: "42883" }
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/^\[degraded\] \{"component":"rate-limit"/);
    expect(getDegradedComponents()).toMatchObject([{ component: "rate-limit", count: 3 }]);
  });

  it("falls back when the backend throws", async () => {
    const db: RateLimitBackend = { rpc: vi.fn(async () => { throw new Error("network"); }) };
    const key = `k-${Math.random()}`;
    expect(await isRateLimitedDurable(key, { maxHits: 1 }, db)).toBe(false);
    expect(await isRateLimitedDurable(key, { maxHits: 1 }, db)).toBe(true);
    expect(h.reportDegraded).toHaveBeenCalledTimes(2);
    expect(h.reportDegraded).toHaveBeenCalledWith("rate-limit", "network");
  });

  it("falls back, and reports, when the RPC answers with something that is not a boolean", async () => {
    const { db } = backend({ data: null, error: null });
    const key = `k-${Math.random()}`;
    expect(await isRateLimitedDurable(key, { maxHits: 1 }, db)).toBe(false);
    expect(await isRateLimitedDurable(key, { maxHits: 1 }, db)).toBe(true);
    expect(h.reportDegraded).toHaveBeenCalledWith(
      "rate-limit",
      expect.stringContaining("expected boolean"),
      undefined
    );
  });

  it("without a backend it is exactly the in-memory limiter", async () => {
    const key = `k-${Math.random()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) results.push(await isRateLimitedDurable(key));
    expect(results).toEqual([false, false, false, false, false, true]);
  });

  it("without a backend the missing client is reported as a degraded rate-limit (F-18)", async () => {
    await isRateLimitedDurable(`k-${Math.random()}`, {}, null);
    expect(h.reportDegraded).toHaveBeenCalledTimes(1);
    expect(h.reportDegraded).toHaveBeenCalledWith("rate-limit", expect.stringContaining("no service-role client"));
    expect(getDegradedComponents().map((r) => r.component)).toEqual(["rate-limit"]);
  });

  it("recovers: a Postgres verdict after a fallback clears the degraded flag", async () => {
    let answer: { data: unknown; error: { message: string; code?: string } | null } = {
      data: null,
      error: { message: "function rate_limit_hit does not exist", code: "42883" },
    };
    const db: RateLimitBackend = { rpc: vi.fn(async () => answer) };
    await isRateLimitedDurable(`k-${Math.random()}`, {}, db);
    expect(getDegradedComponents()).toHaveLength(1);
    answer = { data: false, error: null };
    expect(await isRateLimitedDurable(`k-${Math.random()}`, {}, db)).toBe(false);
    expect(getDegradedComponents()).toEqual([]);
  });
});
