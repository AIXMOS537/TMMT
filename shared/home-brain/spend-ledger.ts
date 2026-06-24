/**
 * shared/home-brain/spend-ledger.ts
 *
 * Local, offline-first daily spend cap for the home brain. A runaway loop on
 * either brain (M1 or Windows) cannot burn more than the owner's daily cap.
 * Persisted as a small JSON file (default <home>/spend-ledger.json) keyed by
 * UTC day — no network, no DB, works on the mesh with the cloud unreachable.
 */
import fs from "node:fs";
import path from "node:path";
import { aixmosHome } from "./kill-switch";

export interface LedgerOptions {
  ledgerFile?: string;
  /** Injectable clock for tests. */
  now?: Date;
}

function ledgerPath(opts?: LedgerOptions): string {
  return (
    opts?.ledgerFile ??
    process.env.AIXMOS_SPEND_LEDGER ??
    path.join(aixmosHome(), "spend-ledger.json")
  );
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function read(opts?: LedgerOptions): Record<string, number> {
  try {
    const parsed = JSON.parse(fs.readFileSync(ledgerPath(opts), "utf8"));
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}

function write(data: Record<string, number>, opts?: LedgerOptions): void {
  const f = ledgerPath(opts);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(data, null, 2), "utf8");
}

export function spentToday(opts?: LedgerOptions): number {
  const now = opts?.now ?? new Date();
  return read(opts)[utcDay(now)] ?? 0;
}

export function recordSpend(usd: number, opts?: LedgerOptions): number {
  if (!Number.isFinite(usd) || usd <= 0) return spentToday(opts);
  const now = opts?.now ?? new Date();
  const data = read(opts);
  const day = utcDay(now);
  data[day] = (data[day] ?? 0) + usd;
  write(data, opts);
  return data[day];
}

export class SpendCapExceededError extends Error {
  constructor(
    public spentUsd: number,
    public capUsd: number,
    public wouldSpendUsd: number,
  ) {
    super(
      `HOME BRAIN SPEND CAP: $${(spentUsd + wouldSpendUsd).toFixed(4)} would exceed the daily cap of $${capUsd.toFixed(2)}`,
    );
    this.name = "SpendCapExceededError";
  }
}

/**
 * Throw if today's spend + this step would reach/exceed the cap.
 * A cap <= 0 (or unset) means "no local cap" — the cloud-side guard still applies.
 */
export function assertUnderCap(
  capUsd: number,
  wouldSpendUsd = 0,
  opts?: LedgerOptions,
): void {
  if (!Number.isFinite(capUsd) || capUsd <= 0) return;
  const spent = spentToday(opts);
  const pending = Math.max(0, wouldSpendUsd);
  if (spent + pending >= capUsd) {
    throw new SpendCapExceededError(spent, capUsd, pending);
  }
}
