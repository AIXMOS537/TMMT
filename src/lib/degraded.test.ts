import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEGRADED_LOG_INTERVAL_MS,
  _flushDegradedForTests,
  _resetDegradedForTests,
  clearDegraded,
  getDegradedComponents,
  reportDegraded,
} from "./degraded";

/**
 * F-18: the degraded-mode signal. Sentry is a double so the "forwarded when a
 * DSN is set / silent without one / never throws" contract is testable
 * without the SDK loading anything.
 */
const h = vi.hoisted(() => ({ captureMessage: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: h.captureMessage }));

const prevDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
let errorSpy: ReturnType<typeof vi.spyOn>;

function loggedPayloads(): Array<Record<string, unknown>> {
  return errorSpy.mock.calls.map(([line]: unknown[]) => {
    expect(String(line).startsWith("[degraded] ")).toBe(true);
    return JSON.parse(String(line).slice("[degraded] ".length)) as Record<string, unknown>;
  });
}

beforeEach(() => {
  _resetDegradedForTests();
  h.captureMessage.mockReset();
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  vi.useRealTimers();
  if (prevDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  else process.env.NEXT_PUBLIC_SENTRY_DSN = prevDsn;
});

describe("reportDegraded — one structured line per component per process", () => {
  it("logs a single JSON line the first time a component degrades", () => {
    reportDegraded("rate-limit", "function rate_limit_hit does not exist", { code: "42883" });
    const lines = loggedPayloads();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      component: "rate-limit",
      reason: "function rate_limit_hit does not exist",
      count: 1,
      code: "42883",
    });
    expect(typeof lines[0].since).toBe("string");
    expect(Number.isNaN(Date.parse(String(lines[0].since)))).toBe(false);
  });

  it("a hot path does not flood: repeated reports inside the interval add to the count without logging", () => {
    for (let i = 0; i < 500; i++) reportDegraded("rate-limit", "still missing");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(getDegradedComponents()[0].count).toBe(500);
  });

  it("logs again once the interval has elapsed, carrying the running count", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));
    reportDegraded("ghl-event-dedupe", 'relation "ghl_webhook_events" does not exist');
    reportDegraded("ghl-event-dedupe", 'relation "ghl_webhook_events" does not exist');
    expect(errorSpy).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date(Date.now() + DEGRADED_LOG_INTERVAL_MS - 1));
    reportDegraded("ghl-event-dedupe", "still missing");
    expect(errorSpy).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date(Date.now() + 1));
    reportDegraded("ghl-event-dedupe", "still missing");
    const lines = loggedPayloads();
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({ component: "ghl-event-dedupe", count: 4, since: "2026-09-08T12:00:00.000Z" });
  });

  it("components are independent: each gets its own first line", () => {
    reportDegraded("rate-limit", "a");
    reportDegraded("ghl-event-dedupe", "b");
    reportDegraded("rate-limit", "a");
    const lines = loggedPayloads();
    expect(lines.map((l) => l.component)).toEqual(["rate-limit", "ghl-event-dedupe"]);
  });

  it("never throws, even when the console itself does", () => {
    errorSpy.mockImplementation(() => {
      throw new Error("stdout closed");
    });
    expect(() => reportDegraded("rate-limit", "x")).not.toThrow();
  });
});

describe("getDegradedComponents / clearDegraded", () => {
  it("is empty when nothing has degraded", () => {
    expect(getDegradedComponents()).toEqual([]);
  });

  it("lists the active components with reason, since and count, sorted by name", () => {
    reportDegraded("rate-limit", "no fn");
    reportDegraded("rate-limit", "no fn");
    reportDegraded("ghl-event-dedupe", "no table", { code: "42P01" });
    const out = getDegradedComponents();
    expect(out.map((r) => r.component)).toEqual(["ghl-event-dedupe", "rate-limit"]);
    expect(out[0]).toMatchObject({ reason: "no table", count: 1, meta: { code: "42P01" } });
    expect(out[1]).toMatchObject({ reason: "no fn", count: 2 });
    expect(out[1].meta).toBeUndefined();
  });

  it("recovery drops the component from the list; clearing an unknown one is a no-op", () => {
    reportDegraded("rate-limit", "no fn");
    clearDegraded("ghl-event-dedupe");
    expect(getDegradedComponents().map((r) => r.component)).toEqual(["rate-limit"]);
    clearDegraded("rate-limit");
    expect(getDegradedComponents()).toEqual([]);
  });

  it("a flapping backend cannot flood: the log throttle survives recovery, the count keeps running, since resets", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));
    reportDegraded("rate-limit", "blip");
    for (let i = 0; i < 20; i++) {
      clearDegraded("rate-limit");
      vi.setSystemTime(new Date(Date.now() + 1000));
      reportDegraded("rate-limit", "blip");
    }
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [rec] = getDegradedComponents();
    expect(rec.count).toBe(21);
    expect(rec.since).toBe("2026-09-08T12:00:20.000Z");
  });
});

describe("Sentry forward", () => {
  it("captures a warning with the component tag when a DSN is configured", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@o0.ingest.sentry.io/0";
    reportDegraded("rate-limit", "function rate_limit_hit does not exist", { code: "42883" });
    reportDegraded("rate-limit", "function rate_limit_hit does not exist");
    await _flushDegradedForTests();
    expect(h.captureMessage).toHaveBeenCalledTimes(1);
    expect(h.captureMessage).toHaveBeenCalledWith(
      "degraded: rate-limit — function rate_limit_hit does not exist",
      expect.objectContaining({
        level: "warning",
        tags: { component: "rate-limit" },
        extra: expect.objectContaining({ component: "rate-limit", count: 1, code: "42883" }),
      })
    );
  });

  it("stays silent without a DSN (tests, local dev, preview without Sentry)", async () => {
    reportDegraded("rate-limit", "x");
    await _flushDegradedForTests();
    expect(h.captureMessage).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("a failing SDK never surfaces: the console line still lands and nothing rejects", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@o0.ingest.sentry.io/0";
    h.captureMessage.mockImplementation(() => {
      throw new Error("sdk not initialised");
    });
    expect(() => reportDegraded("ghl-event-dedupe", "x")).not.toThrow();
    await expect(_flushDegradedForTests()).resolves.toBeUndefined();
    expect(h.captureMessage).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
