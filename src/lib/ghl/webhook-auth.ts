import { NextRequest } from "next/server";

/**
 * Validates `X-GHL-Secret`. Fails CLOSED: if `GHL_WEBHOOK_SECRET` is not set,
 * the request is rejected (an unset secret must never mean "allow anyone").
 */
export function verifyGhlWebhook(req: NextRequest): { ok: true } | { ok: false; status: 401 } {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-ghl-secret") !== secret) {
    return { ok: false, status: 401 };
  }
  return { ok: true };
}
