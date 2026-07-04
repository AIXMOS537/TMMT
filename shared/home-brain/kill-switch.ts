/**
 * shared/home-brain/kill-switch.ts
 *
 * Phone-reachable, cross-platform (macOS M1 + Windows) HALT for the home brain.
 *
 * Two independent triggers, either one halts:
 *   1. env AIXMOS_HOME_KILL=1            — set by a launch agent / service.
 *   2. a sentinel file (default <home>/HALT) — the owner's phone drops this over
 *      the tailnet (Shortcut → ssh/scp `touch ~/.aixmos/HALT`) to stop both
 *      brains instantly, even with no app running.
 *
 * Fails SAFE: if we cannot determine state, we treat the brain as halted.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface HaltOptions {
  /** Override the sentinel path (defaults to $AIXMOS_KILL_FILE or <home>/HALT). */
  killFile?: string;
  /** Override the env flag (defaults to process.env.AIXMOS_HOME_KILL === "1"). */
  envHalted?: boolean;
}

/** Root for all local home-brain state. $AIXMOS_HOME or ~/.aixmos. */
export function aixmosHome(): string {
  return process.env.AIXMOS_HOME ?? path.join(os.homedir(), ".aixmos");
}

function killFilePath(opts?: HaltOptions): string {
  return (
    opts?.killFile ??
    process.env.AIXMOS_KILL_FILE ??
    path.join(aixmosHome(), "HALT")
  );
}

export class HomeBrainHaltedError extends Error {
  constructor(public reason: string) {
    super(`HOME BRAIN HALTED: ${reason}`);
    this.name = "HomeBrainHaltedError";
  }
}

/** Returns the halt reason, or null if the brain is clear to run. */
export function haltReason(opts?: HaltOptions): string | null {
  const envHalted = opts?.envHalted ?? process.env.AIXMOS_HOME_KILL === "1";
  if (envHalted) return "AIXMOS_HOME_KILL=1";
  const f = killFilePath(opts);
  // Use statSync (which THROWS) rather than existsSync (which swallows every
  // error and returns false). A missing file → ENOENT → clear to run. ANY other
  // error (permissions, I/O, unreadable mount) → fail SAFE: treat as halted.
  try {
    fs.statSync(f);
    return `kill file present at ${f}`;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    return `kill-switch unreadable at ${f} (failing safe → halted)`;
  }
}

export function isHalted(opts?: HaltOptions): boolean {
  return haltReason(opts) !== null;
}

/** Call FIRST in every home-brain action. Throws if halted. */
export function assertNotHalted(opts?: HaltOptions): void {
  const reason = haltReason(opts);
  if (reason) throw new HomeBrainHaltedError(reason);
}

/** Engage the kill switch (the phone Shortcut / any mesh node calls this). */
export function engageHalt(reason: string, opts?: HaltOptions): void {
  const f = killFilePath(opts);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, `${reason}\n`, "utf8");
}

/** Release the kill switch. Owner-only in practice. */
export function releaseHalt(opts?: HaltOptions): void {
  try {
    fs.rmSync(killFilePath(opts));
  } catch {
    /* already clear */
  }
}
