import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { isRateLimited } from "@/lib/rate-limit";

/**
 * Validates `X-GHL-Secret` with timing-safe comparison + per-IP rate limit.
 *
 * Fails CLOSED: if `GHL_WEBHOOK_SECRET` is not set, the request is rejected
 * (an unset secret must never mean "allow anyone").
 *
 * Hardening over the prior `!==` compare:
 * 1. `timingSafeEqual` defeats per-byte timing attacks on the shared secret
 * 2. Per-IP rate limit (300/min) so a leaked secret + spray attack still
 *    runs into a backstop before saturating Supabase / Vercel quota
 * 3. Length-checks before timingSafeEqual (length mismatch is a hint but not
 *    the same kind of leak as per-byte timing)
 *
 * Open hardening: HMAC + timestamp window once GHL's outbound webhooks
 * support signing on their end. Tracked as MEDIUM in the Layer-4 audit.
 */
export function verifyGhlWebhook(
  req: NextRequest,
): { ok: true } | { ok: false; status: 401 | 429 } {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`ghl-webhook:${ip}`, { windowMs: 60_000, maxHits: 300 })) {
    return { ok: false, status: 429 };
  }

  const secret = process.env.GHL_WEBHOOK_SECRET;
  const provided = req.headers.get("x-ghl-secret") ?? "";
  if (!secret || !provided) return { ok: false, status: 401 };
  if (secret.length !== provided.length) return { ok: false, status: 401 };
  try {
    if (!timingSafeEqual(Buffer.from(secret, "utf8"), Buffer.from(provided, "utf8"))) {
      return { ok: false, status: 401 };
    }
  } catch {
    return { ok: false, status: 401 };
  }
  return { ok: true };
}
