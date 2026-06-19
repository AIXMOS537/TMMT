import { describe, it, expect } from "vitest";
import { reclaimStale } from "./reaper";
import type { BoardRow } from "./types";

const row = (over: Partial<BoardRow>): BoardRow => ({
  id: 1, status: "CLAIMED", machine: "rick", branch: "swarm/rick/1",
  lane: "code", tier: 1, lease: "", task: "t", log: "", ...over,
});

describe("reclaimStale", () => {
  const now = "2026-06-18T01:00:00Z";

  it("requeues a CLAIMED task whose lease has expired", () => {
    const out = reclaimStale([row({ lease: "2026-06-18T00:30:00Z" })], now);
    expect(out[0]).toMatchObject({ status: "TODO", machine: "", branch: "", lease: "" });
    expect(out[0].log).toContain("reclaimed");
  });

  it("leaves a task whose lease is still in the future", () => {
    const out = reclaimStale([row({ lease: "2026-06-18T02:00:00Z" })], now);
    expect(out[0].status).toBe("CLAIMED");
  });

  it("never touches DONE/TODO/FAILED rows", () => {
    const rows = [row({ status: "DONE", lease: "2026-06-18T00:00:00Z" })];
    expect(reclaimStale(rows, now)).toEqual(rows);
  });
});
