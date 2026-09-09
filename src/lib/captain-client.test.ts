import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Candidate } from "./dispatch-types";

/**
 * The agent host is optional by design — dispatch falls back to the first
 * candidate when it cannot be reached. What was NOT by design is that the
 * fallback was silent: measured 2026-09-09, the host had served zero requests
 * in three days because production never sets AIXMOS_AGENT_HOST, and nothing
 * anywhere said so.
 *
 * These tests pin the loud half: every miss reports through `degraded.ts`
 * (with whether the host was even configured), and a good answer clears it.
 * `captain-client.ts` reads the env at module load, so each case re-imports.
 */

const CANDIDATES = [
  { unit_id: "unit-a" },
  { unit_id: "unit-b" },
] as unknown as Candidate[];

const INPUT = {
  incident: {
    severity: 3,
    location: [38.9, -77.0] as [number, number],
    required_capabilities: ["tow"],
    description: "flat on the shoulder",
  },
  candidates: CANDIDATES,
};

async function load(host: string | undefined) {
  vi.resetModules();
  if (host === undefined) delete process.env.AIXMOS_AGENT_HOST;
  else process.env.AIXMOS_AGENT_HOST = host;
  const degraded = await import("./degraded");
  degraded._resetDegradedForTests();
  const { askCaptainDispatch } = await import("./captain-client");
  return { askCaptainDispatch, ...degraded };
}

const prevHost = process.env.AIXMOS_AGENT_HOST;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (prevHost === undefined) delete process.env.AIXMOS_AGENT_HOST;
  else process.env.AIXMOS_AGENT_HOST = prevHost;
});

function jsonOnce(body: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({ ok, status, json: async () => body }));
}

describe("askCaptainDispatch", () => {
  it("returns the ranking and clears degraded when the host answers", async () => {
    const { askCaptainDispatch, getDegradedComponents } = await load("http://agent.test:7777");
    vi.stubGlobal("fetch", jsonOnce({ ranked_unit_ids: ["unit-b", "unit-a"], reasoning: "closest" }));

    await expect(askCaptainDispatch(INPUT)).resolves.toEqual({
      ranked_unit_ids: ["unit-b", "unit-a"],
      reasoning: "closest",
    });
    expect(getDegradedComponents()).toEqual([]);
  });

  it("reports degraded when the host is unreachable, and says it was unconfigured", async () => {
    const { askCaptainDispatch, getDegradedComponents } = await load(undefined);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("ECONNREFUSED"); }));

    await expect(askCaptainDispatch(INPUT)).resolves.toBeNull();

    const [rec] = getDegradedComponents();
    expect(rec.component).toBe("captain-dispatch");
    expect(rec.reason).toContain("unreachable");
    expect(rec.meta).toMatchObject({
      host: "http://127.0.0.1:7777",
      host_configured: false,
    });
  });

  it("records host_configured when AIXMOS_AGENT_HOST is set", async () => {
    const { askCaptainDispatch, getDegradedComponents } = await load("http://agent.test:7777");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("ECONNREFUSED"); }));

    await askCaptainDispatch(INPUT);
    expect(getDegradedComponents()[0].meta).toMatchObject({
      host: "http://agent.test:7777",
      host_configured: true,
    });
  });

  it("reports the status code on a non-2xx", async () => {
    const { askCaptainDispatch, getDegradedComponents } = await load("http://agent.test:7777");
    vi.stubGlobal("fetch", jsonOnce({}, false, 503));

    await expect(askCaptainDispatch(INPUT)).resolves.toBeNull();
    const [rec] = getDegradedComponents();
    expect(rec.reason).toContain("503");
    expect(rec.meta).toMatchObject({ status: 503 });
  });

  it("reports degraded when the host ranks a unit that was never a candidate", async () => {
    const { askCaptainDispatch, getDegradedComponents } = await load("http://agent.test:7777");
    vi.stubGlobal("fetch", jsonOnce({ ranked_unit_ids: ["unit-z"], reasoning: "hallucinated" }));

    await expect(askCaptainDispatch(INPUT)).resolves.toBeNull();
    expect(getDegradedComponents()[0].reason).toContain("unknown unit_id");
  });

  it("reports degraded on an empty ranking", async () => {
    const { askCaptainDispatch, getDegradedComponents } = await load("http://agent.test:7777");
    vi.stubGlobal("fetch", jsonOnce({ ranked_unit_ids: [], reasoning: "" }));

    await expect(askCaptainDispatch(INPUT)).resolves.toBeNull();
    expect(getDegradedComponents()[0].reason).toContain("no ranking");
  });

  it("names the deadline when the host does not answer in time", async () => {
    const { askCaptainDispatch, getDegradedComponents } = await load("http://agent.test:7777");
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { signal: AbortSignal }) =>
      new Promise((_res, rej) => {
        init.signal.addEventListener("abort", () => {
          const e = new Error("aborted");
          e.name = "AbortError";
          rej(e);
        });
      })
    ));

    await expect(askCaptainDispatch(INPUT)).resolves.toBeNull();
    expect(getDegradedComponents()[0].reason).toContain("1500ms");
  });

  it("a good answer after a miss clears the degraded entry", async () => {
    const { askCaptainDispatch, getDegradedComponents } = await load("http://agent.test:7777");

    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("ECONNREFUSED"); }));
    await askCaptainDispatch(INPUT);
    expect(getDegradedComponents()).toHaveLength(1);

    vi.stubGlobal("fetch", jsonOnce({ ranked_unit_ids: ["unit-a"], reasoning: "back" }));
    await askCaptainDispatch(INPUT);
    expect(getDegradedComponents()).toEqual([]);
  });
});
