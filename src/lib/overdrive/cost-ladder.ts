import type { Hint, Lane, LedgerEntry, Tier } from "./types";
import { tierForHint } from "./board";

const MIN_SAMPLES = 3;
const BUMP_RATIO = 0.6;

export function pickStartTier(hint: Hint, ledger: LedgerEntry[], lane: Lane): Tier {
  const base = tierForHint(hint);
  const relevant = ledger.filter(
    (e) => e.lane === lane && e.hint === hint && e.result === "DONE" && e.tierSucceeded >= 0,
  );
  if (relevant.length < MIN_SAMPLES) return base;
  // If a strong majority needed a higher tier than `base`, start there.
  const higher = relevant.filter((e) => e.tierSucceeded > base);
  if (higher.length / relevant.length >= BUMP_RATIO) {
    const want = Math.max(...higher.map((e) => e.tierSucceeded)) as Tier;
    return Math.min(want, 2) as Tier;
  }
  return base;
}

export function escalate(tier: Tier): Tier | null {
  return tier < 2 ? ((tier + 1) as Tier) : null;
}
