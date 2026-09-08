import { describe, it, expect, vi, beforeEach } from "vitest";
import { isRateLimitedDurable, _resetDurableWarning, type RateLimitBackend } from "./rate-limit-durable";

function backend(result: { data: unknown; error: { message: string; code?: string } | null }, calls: unknown[] = []) {
  const db: RateLimitBackend = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return result;
    }),
  };
  return { db, calls };
}

beforeEach(() => _resetDurableWarning());

describe("isRateLimitedDurable", () => {
  it("asks Postgres with the key, window and cap, and trusts its verdict", async () => {
    const { db, calls } = backend({ data: true, error: null });
    const key = `k-${Math.random()}`;
    expect(await isRateLimitedDurable(key, { windowMs: 60_000, maxHits: 3 }, db)).toBe(true);
    expect(calls).toEqual([{ fn: "rate_limit_hit", args: { p_key: key, p_window_ms: 60_000, p_max_hits: 3 } }]);
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
  });

  it("falls back when the backend throws", async () => {
    const db: RateLimitBackend = { rpc: vi.fn(async () => { throw new Error("network"); }) };
    const key = `k-${Math.random()}`;
    expect(await isRateLimitedDurable(key, { maxHits: 1 }, db)).toBe(false);
    expect(await isRateLimitedDurable(key, { maxHits: 1 }, db)).toBe(true);
  });

  it("without a backend it is exactly the in-memory limiter", async () => {
    const key = `k-${Math.random()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) results.push(await isRateLimitedDurable(key));
    expect(results).toEqual([false, false, false, false, false, true]);
  });
});
