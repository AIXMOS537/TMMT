import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { Hint, Lane, LedgerEntry, Tier } from "./types";

export function formatLedgerLine(e: LedgerEntry): string {
  return [
    e.ts, e.taskId, e.lane, e.hint, e.tierStarted, e.tierSucceeded, e.result, e.approxCost, e.machine,
  ].join("\t");
}

export function parseLedger(tsv: string): LedgerEntry[] {
  return tsv
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.startsWith("#"))
    .map((line) => {
      const c = line.split("\t");
      return {
        ts: c[0],
        taskId: Number(c[1]),
        lane: c[2] as Lane,
        hint: c[3] as Hint,
        tierStarted: Number(c[4]) as Tier,
        tierSucceeded: Number(c[5]) as Tier | -1,
        result: c[6] as "DONE" | "FAILED",
        approxCost: Number(c[7]),
        machine: c[8],
      };
    });
}

export function appendLedger(path: string, e: LedgerEntry): void {
  appendFileSync(path, `${formatLedgerLine(e)}\n`);
}

export function readLedger(path: string): LedgerEntry[] {
  return existsSync(path) ? parseLedger(readFileSync(path, "utf8")) : [];
}
