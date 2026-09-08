/**
 * Constant-time comparisons for shared secrets and bearer tokens.
 *
 * `a !== b` on a secret returns as soon as the first byte differs, which lets
 * a remote caller measure how many leading bytes matched. These helpers pad to
 * a common length, compare every byte, and only then check the lengths, so an
 * unequal secret never throws and never short-circuits.
 *
 * The canonical implementation lived in src/lib/ghl/webhook-auth.ts; it is
 * re-exported from there so existing imports keep working.
 */
import { timingSafeEqual } from "node:crypto";

export function timingSafeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  const len = Math.max(aBuf.length, bBuf.length, 1);
  const aPad = Buffer.alloc(len);
  const bPad = Buffer.alloc(len);
  aBuf.copy(aPad);
  bBuf.copy(bPad);
  return timingSafeEqual(aPad, bPad) && aBuf.length === bBuf.length;
}

/** True when `provided` (a header value, possibly null) equals `secret`. Fails closed on an empty secret. */
export function secretMatches(provided: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret || !provided) return false;
  return timingSafeEqualString(provided, secret);
}

/** True when an `Authorization` header carries exactly `Bearer <secret>`. */
export function bearerMatches(header: string | null | undefined, secret: string | null | undefined): boolean {
  const prefix = "Bearer ";
  if (!secret || !header || !header.startsWith(prefix)) return false;
  return timingSafeEqualString(header.slice(prefix.length).trim(), secret);
}
