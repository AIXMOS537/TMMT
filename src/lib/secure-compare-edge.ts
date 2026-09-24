/**
 * Constant-time secret comparison that runs on the Edge runtime.
 *
 * `src/lib/secure-compare.ts` uses `node:crypto.timingSafeEqual`, which the
 * Edge middleware cannot import. This is the same contract in plain JS:
 * both values are encoded to UTF-8, every byte position up to the longer
 * length is compared (XOR, accumulated with OR, no early exit), and the
 * length difference is folded into the result, so an unequal secret never
 * short-circuits and never throws.
 */
const encoder = new TextEncoder();

export function timingSafeEqualUtf8(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const len = Math.max(aBytes.length, bBytes.length, 1);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

/**
 * True when an `Authorization` header is exactly `Bearer <secret>`.
 * Fails closed on an unset/empty secret or an empty token.
 */
export function bearerMatchesEdge(header: string | null | undefined, secret: string | null | undefined): boolean {
  const prefix = "Bearer ";
  if (!secret || !header || !header.startsWith(prefix)) return false;
  const token = header.slice(prefix.length);
  if (!token) return false;
  return timingSafeEqualUtf8(token, secret);
}
