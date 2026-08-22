import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

export const GHL_REPLAY_WINDOW_MS = 300_000;
const IDEMPOTENCY_MAX = 2_000;
const SIG_HEADERS = ["x-ghl-signature", "x-wh-signature"] as const;

/** In-memory FIFO of recent event ids (Vercel-friendly; last ~2000). */
const seenEventIds = new Map<string, true>();

export type GhlWebhookAuthOk = { ok: true };
export type GhlWebhookAuthFail = { ok: false; status: 401 | 400 };
export type GhlEventConsumeOk = { ok: true; eventId: string };
export type GhlEventConsumeDup = { ok: false; status: 409; duplicate: true };

type HeaderReader = { headers: { get(name: string): string | null } };

function providedSecret(req: HeaderReader): string | null {
  return req.headers.get("x-ghl-webhook-secret") || req.headers.get("x-ghl-secret");
}

function providedSignature(req: HeaderReader): string | null {
  for (const name of SIG_HEADERS) {
    const value = req.headers.get(name);
    if (value) return value;
  }
  return null;
}

/**
 * timingSafeEqual throws on length mismatch. Pad to a shared length first,
 * then require original lengths to match so unequal secrets never throw.
 */
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

function normalizeSignature(value: string): string {
  const trimmed = value.trim();
  const hex = trimmed.startsWith("sha256=") ? trimmed.slice("sha256=".length) : trimmed;
  return hex.toLowerCase();
}

function hmacHex(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function tryParseJson(rawBody: string | undefined): Record<string, unknown> | null {
  if (rawBody == null || rawBody === "") return null;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

/** Unix seconds, unix ms, or ISO-8601 → epoch ms. */
export function parseGhlTimestamp(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      if (!Number.isFinite(n)) return null;
      return n < 1e12 ? n * 1000 : n;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function resolveTimestamp(req: HeaderReader, rawBody?: string): number | null {
  const headerTs = parseGhlTimestamp(req.headers.get("x-ghl-timestamp"));
  if (headerTs != null) return headerTs;
  const body = tryParseJson(rawBody);
  if (!body) return null;
  return parseGhlTimestamp(body.timestamp) ?? parseGhlTimestamp(body.ts);
}

function isReplay(req: HeaderReader, rawBody?: string): boolean {
  const ts = resolveTimestamp(req, rawBody);
  if (ts == null) return false;
  return Date.now() - ts > GHL_REPLAY_WINDOW_MS;
}

/**
 * Validates GHL inbound webhooks.
 *
 * - Fail-closed when GHL_WEBHOOK_SECRET is missing.
 * - If x-ghl-signature or x-wh-signature is present, require HMAC-SHA256(rawBody)
 *   hex digest. Marketplace/app webhooks take this path.
 * - If no signature header, keep the production custom-header shared-secret path
 *   (x-ghl-webhook-secret or x-ghl-secret). GHL workflow webhooks take this path.
 * - Replay: if x-ghl-timestamp or body.timestamp / body.ts exists, reject when
 *   older than 5 minutes. Missing timestamp is allowed (workflows often omit it).
 *
 * `rawBody` is required to verify HMAC and body timestamps. Existing header-only
 * callers may omit it (current tests + workflow secret path).
 */
export function verifyGhlWebhook(
  req: NextRequest | HeaderReader,
  rawBody?: string
): GhlWebhookAuthOk | GhlWebhookAuthFail {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, status: 401 };
  }

  const signature = providedSignature(req);
  if (signature) {
    if (rawBody == null) {
      return { ok: false, status: 401 };
    }
    const expected = hmacHex(rawBody, secret);
    const provided = normalizeSignature(signature);
    if (!timingSafeEqualString(expected, provided)) {
      return { ok: false, status: 401 };
    }
  } else {
    const provided = providedSecret(req);
    if (!provided || !timingSafeEqualString(provided, secret)) {
      return { ok: false, status: 401 };
    }
  }

  if (isReplay(req, rawBody)) {
    return { ok: false, status: 400 };
  }

  return { ok: true };
}

export function deriveGhlEventId(body: Record<string, unknown>): string {
  const explicit =
    asString(body.webhookId) || asString(body.eventId) || asString(body.id);
  if (explicit) return explicit;

  const email = asString(body.email) || asString(body.contact_email) || "";
  const event = asString(body.event) || "";
  const contactId = asString(body.contact_id) || "";
  const timestamp = asString(body.timestamp) || asString(body.ts) || "";
  return createHash("sha256")
    .update(`${email}|${event}|${contactId}|${timestamp}`, "utf8")
    .digest("hex");
}

/**
 * First sight of an event id → ok. Duplicate → 409 / duplicate.
 * Id is webhookId || eventId || id || sha256(email+event+contact_id+timestamp).
 */
export function consumeGhlEventId(
  body: Record<string, unknown>
): GhlEventConsumeOk | GhlEventConsumeDup {
  const eventId = deriveGhlEventId(body);
  if (seenEventIds.has(eventId)) {
    return { ok: false, status: 409, duplicate: true };
  }
  seenEventIds.set(eventId, true);
  if (seenEventIds.size > IDEMPOTENCY_MAX) {
    const oldest = seenEventIds.keys().next().value;
    if (oldest !== undefined) seenEventIds.delete(oldest);
  }
  return { ok: true, eventId };
}

/** Test-only: drop the in-memory idempotency window. */
export function resetGhlEventIdsForTests(): void {
  seenEventIds.clear();
}
