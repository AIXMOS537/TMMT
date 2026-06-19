import { describe, it, expect } from "vitest";
import { pickStartTier, escalate } from "./cost-ladder";
import type { LedgerEntry } from "./types";

const ledgerFor = (lane: "code" | "general", hint: "easy" | "med" | "hard", tier: 0 | 1 | 2, n: number): LedgerEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    ts: "t", taskId: i, lane, hint, tierStarted: 0, tierSucceeded: tier,
    result: "DONE" as const, approxCost: 0, machine: "rick",
  }));

describe("cost ladder", () => {
  it("starts at the hint's tier with no history", () => {
    expect(pickStartTier("easy", [], "general")).toBe(0);
    expect(pickStartTier("med", [], "code")).toBe(1);
    expect(pickStartTier("hard", [], "code")).toBe(2);
  });

  it("bumps the start tier when history shows the cheap tier usually fails", () => {
    // 4 of 5 'code/med' jobs only succeeded at tier 2 -> start at 2
    const ledger = [...ledgerFor("code", "med", 2, 4), ...ledgerFor("code", "med", 1, 1)];
    expect(pickStartTier("med", ledger, "code")).toBe(2);
  });

  it("ignores history for a different lane/hint", () => {
    const ledger = ledgerFor("general", "easy", 2, 5);
    expect(pickStartTier("med", ledger, "code")).toBe(1);
  });

  it("needs at least 3 samples before learning kicks in", () => {
    const ledger = ledgerFor("code", "med", 2, 2);
    expect(pickStartTier("med", ledger, "code")).toBe(1);
  });

  it("escalate goes up one tier, null at the top", () => {
    expect(escalate(0)).toBe(1);
    expect(escalate(1)).toBe(2);
    expect(escalate(2)).toBeNull();
  });
});
