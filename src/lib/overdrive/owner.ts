import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Owner control = X's master passphrase. We never store the passphrase, only a
 * salted scrypt hash ("saltHex:hashHex") — safe to commit, useless without the
 * passphrase. Verifying unlocks complete owner control across any device.
 */

export function hashPassphrase(passphrase: string, saltHex: string): string {
  return scryptSync(passphrase, Buffer.from(saltHex, "hex"), 32).toString("hex");
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
