import { existsSync, readFileSync, writeFileSync, rmSync, chmodSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

/** Owner session = proof X unlocked this device with the master passphrase. */
export const SESSION_PATH = join(homedir(), ".tmmt/owner.session");

export function grantOwner(hours = 12): void {
  mkdirSync(dirname(SESSION_PATH), { recursive: true });
  writeFileSync(SESSION_PATH, String(Date.now() + hours * 3_600_000));
  chmodSync(SESSION_PATH, 0o600);
}

export function revokeOwner(): void {
  if (existsSync(SESSION_PATH)) rmSync(SESSION_PATH);
}

export function isOwnerUnlocked(): boolean {
  if (!existsSync(SESSION_PATH)) return false;
  const expiry = Number(readFileSync(SESSION_PATH, "utf8").trim());
  return Number.isFinite(expiry) && Date.now() < expiry;
}
