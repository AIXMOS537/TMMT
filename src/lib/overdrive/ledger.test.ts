import { describe, it, expect } from "vitest";
import { formatLedgerLine, parseLedger } from "./ledger";
import type { LedgerEntry } from "./types";

const e: LedgerEntry = {
  ts: "2026-06-18T01:00:00Z", taskId: 12, lane: "code", hint: "med",
  tierStarted: 1, tierSucceeded: 2, result: "DONE", approxCost: 0.05, machine: "rick",
};

describe("ledger", () => {
  it("round-trips one entry through TSV", () => {
    const line = formatLedgerLine(e);
    expect(line.split("\t")).toHaveLength(9);
    expect(parseLedger(line)).toEqual([e]);
  });

  it("parse skips blank lines and comments", () => {
    const tsv = `# header\n\n${formatLedgerLine(e)}\n`;
    expect(parseLedger(tsv)).toEqual([e]);
  });
});
