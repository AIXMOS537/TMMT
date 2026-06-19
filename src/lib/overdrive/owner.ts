import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Owner control = X's master passphrase. We never store the passphrase, only a
 * salted SHA-256 hash ("saltHex:hashHex") — safe to commit, useless without the
 * passphrase. This MATCHES scripts/owner-seal.sh exactly, so a single master
 * passphrase (one auth/OWNER.seal) unlocks both `ship` and Operation Overdrive.
 */

export function hashPassphrase(passphrase: string, saltHex: string): string {
  return createHash("sha256").update(`${saltHex}:${passphrase}`).digest("hex");
}

export function makeSeal(passphrase: string, saltHex: string = randomBytes(16).toString("hex")): string {
  return `${saltHex}:${hashPassphrase(passphrase, saltHex)}`;
}

export function verifyPassphrase(passphrase: string, seal: string): boolean {
  const [saltHex, hash] = seal.split(":");
  if (!saltHex || !hash) return false;
  const actual = Buffer.from(hashPassphrase(passphrase, saltHex), "hex");
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
