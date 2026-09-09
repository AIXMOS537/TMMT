import { describe, it, expect, vi, afterEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fetchWithTimeout, FetchTimeoutError, DEFAULT_OUTBOUND_TIMEOUT_MS } from "./fetch-with-timeout";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** A fetch double that resolves after `delayMs` unless its signal aborts first. */
function slowFetch(delayMs: number) {
  return vi.fn((_input: unknown, init?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      const t = setTimeout(() => resolve(new Response("ok")), delayMs);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(t);
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      });
    });
  });
}

describe("fetchWithTimeout", () => {
  it("passes a fast response straight through and forwards init", async () => {
    const f = slowFetch(0);
    vi.stubGlobal("fetch", f);
    const res = await fetchWithTimeout("https://x.test/a", { method: "POST", headers: { a: "b" }, timeoutMs: 1000 });
    expect(await res.text()).toBe("ok");
    const init = f.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ a: "b" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect("timeoutMs" in init).toBe(false); // not leaked to the real fetch
  });

  it("aborts a slow call and throws FetchTimeoutError with the url minus its query", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", slowFetch(10_000));
    const p = fetchWithTimeout("https://x.test/slow?token=secret", { timeoutMs: 50 });
    const assertion = expect(p).rejects.toMatchObject({ name: "FetchTimeoutError", url: "https://x.test/slow", timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });

  it("uses the 8 s default when no timeout is given", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", slowFetch(60_000));
    const p = fetchWithTimeout("https://x.test/slow");
    const assertion = expect(p).rejects.toBeInstanceOf(FetchTimeoutError);
    await vi.advanceTimersByTimeAsync(DEFAULT_OUTBOUND_TIMEOUT_MS + 10);
    await assertion;
  });

  it("a caller abort is reported as the caller's abort, not a timeout", async () => {
    vi.stubGlobal("fetch", slowFetch(10_000));
    const ctrl = new AbortController();
    const p = fetchWithTimeout("https://x.test/slow", { signal: ctrl.signal, timeoutMs: 5000 });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });

  it("network errors pass through unchanged", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("ECONNREFUSED"); }));
    await expect(fetchWithTimeout("https://x.test/down")).rejects.toThrow("ECONNREFUSED");
  });
});

/**
 * ENFORCEMENT: outbound integration clients under src/lib must not call bare
 * `fetch(`. Use fetchWithTimeout (or the module's own AbortController pattern,
 * which the allowlist below names explicitly).
 */
describe("no bare fetch in outbound integration modules", () => {
  const LIB = join(process.cwd(), "src", "lib");
  // Modules that implement their own deadline and are checked by their own tests.
  const OWN_DEADLINE = new Set([
    "agent/llm-router.ts",
    "pocket-brain.ts",
    "captain-client.ts",
    "notify.ts",
    "fetch-with-timeout.ts",
  ]);
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) out.push(...walk(p));
      else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
    }
    return out;
  }
  it("every fetch( under src/lib is fetchWithTimeout or in a module with its own deadline", () => {
    const offenders = walk(LIB)
      .map((f) => ({ rel: f.slice(LIB.length + 1).replace(/\\/g, "/"), src: readFileSync(f, "utf8") }))
      .filter(({ rel, src }) => !OWN_DEADLINE.has(rel) && /(^|[^A-Za-z_.])fetch\(/.test(src))
      .map(({ rel }) => rel);
    expect(offenders, `bare fetch( in: ${offenders.join(", ")}`).toEqual([]);
  });
});
