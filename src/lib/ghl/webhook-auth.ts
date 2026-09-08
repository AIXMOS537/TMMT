import { createHash, createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { timingSafeEqualString } from "@/lib/secure-compare";

// Re-exported for existing importers; the implementation now lives in secure-compare.
export { timingSafeEqualString };

export const GHL_REPLAY_WINDOW_MS = 300_000;
const IDEMPOTENCY_MAX = 2_000;
const SIG_HEADERS = ["x-ghl-signature", "x-wh-signature"] as const;

/**
 * In-memory FIFO of recent event ids. This is the fallback path only -- it
 * does not survive a Vercel cold start and is not shared across instances,
 * so it cannot dedupe a retry that lands on a different instance. It stays
 * as a safety net for when the ghl_webhook_events table (migration
 * 20260825120000) hasn't been applied yet, so shipping this code ahead of
 * running that migration is not a regression from today's behavior.
 */
const seenEventIds = new Map<string, true>();
let warnedNoDbTable = false;

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

function consumeGhlEventIdInMemory(eventId: string): GhlEventConsumeOk | GhlEventConsumeDup {
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

/**
 * First sight of an event id → ok. Duplicate → 409 / duplicate.
 * Id is webhookId || eventId || id || sha256(email+event+contact_id+timestamp).
 *
 * Backed by the ghl_webhook_events table (see migration 20260825120000) so
 * dedup survives cold starts and is shared across instances -- the in-memory
 * Map alone can't do either on Vercel. Falls back to the old in-memory-only
 * check if the table doesn't exist yet (migration not applied) or the DB is
 * unreachable, so this never makes webhook delivery worse than it is today.
 */
export async function consumeGhlEventId(
  body: Record<string, unknown>,
  supabase?: SupabaseClient
): Promise<GhlEventConsumeOk | GhlEventConsumeDup> {
  const eventId = deriveGhlEventId(body);

  if (!supabase) {
    return consumeGhlEventIdInMemory(eventId);
  }

  const { error } = await supabase
    .from("ghl_webhook_events")
    .insert({ event_id: eventId });

  if (!error) {
    return { ok: true, eventId };
  }

  // Postgres unique_violation on the event_id primary key = genuine duplicate.
  if (error.code === "23505") {
    return { ok: false, status: 409, duplicate: true };
  }

  // Any other error (table doesn't exist yet, network blip, etc.) -- fall
  // back rather than fail the webhook. Warn once per instance so this isn't
  // silent, but don't spam logs on every request.
  if (!warnedNoDbTable) {
    warnedNoDbTable = true;
    console.warn(
      "[ghl.webhook-auth] ghl_webhook_events insert failed, falling back to in-memory idempotency:",
      error.message
    );
  }
  return consumeGhlEventIdInMemory(eventId);
}

/** Test-only: drop the in-memory idempotency window. */
export function resetGhlEventIdsForTests(): void {
  seenEventIds.clear();
}
