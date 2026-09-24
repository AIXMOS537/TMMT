import { describe, it, expect } from "vitest";
import { checkIntegrationFreshness, problemsOnly, type IntegrationFreshness } from "./integration-freshness";

const NOW = new Date("2026-09-20T12:00:00.000Z").getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const PROBE = [
  {
    name: "test-rail",
    table: "t",
    column: "seen_at",
    thresholdHours: 168,
    neverDetail: "never wired up",
    staleDetail: "stopped firing",
  },
];

function db(rows: unknown[] | null, error?: string) {
  return {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: rows, error: error ? { message: error } : null }),
        }),
      }),
    }),
  } as never;
}

const one = async (rows: unknown[] | null, error?: string): Promise<IntegrationFreshness> =>
  (await checkIntegrationFreshness(db(rows, error), PROBE, NOW))[0];

describe("never fired is NOT the same fault as stopped firing", () => {
  it("an empty table is `never`, and says nobody wired it up", async () => {
    const f = await one([]);
    expect(f.state).toBe("never");
    expect(f.lastSeen).toBeNull();
    expect(f.detail).toMatch(/never wired up/);
  });

  it("a rail that worked and stopped is `stale`, with a different message", async () => {
    const f = await one([{ seen_at: hoursAgo(400) }]);
    expect(f.state).toBe("stale");
    expect(f.detail).toMatch(/stopped firing/);
    expect(f.ageHours).toBe(400);
  });

  it("the two never share a message — that is the whole point", async () => {
    const never = await one([]);
    const stale = await one([{ seen_at: hoursAgo(400) }]);
    expect(never.detail).not.toEqual(stale.detail);
  });
});

describe("thresholds", () => {
  it("inside the window is fresh", async () => {
    expect((await one([{ seen_at: hoursAgo(10) }])).state).toBe("fresh");
  });

  it("exactly at the threshold is still fresh — only PAST it is stale", async () => {
    expect((await one([{ seen_at: hoursAgo(168) }])).state).toBe("fresh");
    expect((await one([{ seen_at: hoursAgo(169) }])).state).toBe("stale");
  });

  it("a future timestamp clamps to 0 rather than reporting negative age", async () => {
    const f = await one([{ seen_at: new Date(NOW + 3_600_000).toISOString() }]);
    expect(f.ageHours).toBe(0);
    expect(f.state).toBe("fresh");
  });
});

describe("an unreadable source is not a quiet one", () => {
  it("a read error is reported as a problem, never as fresh", async () => {
    // Reporting "fresh" here would be the exact silent-green this file exists to prevent.
    const f = await one(null, "permission denied");
    expect(f.state).toBe("stale");
    expect(f.detail).toMatch(/permission denied/);
  });
});

describe("problemsOnly", () => {
  it("keeps never and stale, drops fresh", async () => {
    const all: IntegrationFreshness[] = [
      { name: "a", state: "fresh", lastSeen: null, ageHours: 1, thresholdHours: 5, detail: "" },
      { name: "b", state: "never", lastSeen: null, ageHours: null, thresholdHours: 5, detail: "" },
      { name: "c", state: "stale", lastSeen: null, ageHours: 9, thresholdHours: 5, detail: "" },
    ];
    expect(problemsOnly(all).map(f => f.name)).toEqual(["b", "c"]);
  });
});
