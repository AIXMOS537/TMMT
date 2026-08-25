import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  consumeGhlEventId,
  resetGhlEventIdsForTests,
  verifyGhlWebhook,
} from "./webhook-auth";

const SECRET = "flagship-test-secret";

function req(headers: Record<string, string>, rawBody?: string): NextRequest {
  return new NextRequest("https://example.test/api/webhooks/ghl", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

function hmacHex(rawBody: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

describe("verifyGhlWebhook", () => {
  const prev = process.env.GHL_WEBHOOK_SECRET;
  afterEach(() => {
    if (prev === undefined) delete process.env.GHL_WEBHOOK_SECRET;
    else process.env.GHL_WEBHOOK_SECRET = prev;
    resetGhlEventIdsForTests();
  });

  it("rejects when secret env is missing", () => {
    delete process.env.GHL_WEBHOOK_SECRET;
    expect(verifyGhlWebhook(req({ "x-ghl-webhook-secret": "anything" }))).toEqual({
      ok: false,
      status: 401,
    });
  });

  it("rejects HMAC path when secret env is missing", () => {
    delete process.env.GHL_WEBHOOK_SECRET;
    const raw = JSON.stringify({ email: "a@b.com" });
    expect(
      verifyGhlWebhook(req({ "x-ghl-signature": hmacHex(raw) }, raw), raw)
    ).toEqual({ ok: false, status: 401 });
  });

  it("accepts x-ghl-webhook-secret", () => {
    process.env.GHL_WEBHOOK_SECRET = SECRET;
    expect(verifyGhlWebhook(req({ "x-ghl-webhook-secret": SECRET }))).toEqual({ ok: true });
  });

  it("accepts x-ghl-secret (form workflows)", () => {
    process.env.GHL_WEBHOOK_SECRET = SECRET;
    expect(verifyGhlWebhook(req({ "x-ghl-secret": SECRET }))).toEqual({ ok: true });
  });

  it("rejects a wrong header value", () => {
    process.env.GHL_WEBHOOK_SECRET = SECRET;
    expect(verifyGhlWebhook(req({ "x-ghl-webhook-secret": "nope" }))).toEqual({
      ok: false,
      status: 401,
    });
  });

  it("timing-safe: rejects a different-length header without throwing", () => {
    process.env.GHL_WEBHOOK_SECRET = SECRET;
    expect(() =>
      verifyGhlWebhook(req({ "x-ghl-webhook-secret": "x" }))
    ).not.toThrow();
    expect(verifyGhlWebhook(req({ "x-ghl-webhook-secret": "x" }))).toEqual({
      ok: false,
      status: 401,
    });
  });

  it("accepts valid HMAC-SHA256 hex on x-ghl-signature", () => {
    process.env.GHL_WEBHOOK_SECRET = SECRET;
    const raw = JSON.stringify({ email: "hmac@test.com", event: "contact.updated" });
    const headers = { "x-ghl-signature": hmacHex(raw) };
    expect(verifyGhlWebhook(req(headers, raw), raw)).toEqual({ ok: true });
  });

  it("accepts valid HMAC-SHA256 hex on x-wh-signature", () => {
    process.env.GHL_WEBHOOK_SECRET = SECRET;
    const raw = JSON.stringify({ email: "wh@test.com" });
    const headers = { "x-wh-signature": hmacHex(raw) };
    expect(verifyGhlWebhook(req(headers, raw), raw)).toEqual({ ok: true });
  });

  it("rejects a bad HMAC signature", () => {
    process.env.GHL_WEBHOOK_SECRET = SECRET;
    const raw = JSON.stringify({ email: "bad-hmac@test.com" });
    const headers = { "x-ghl-signature": "deadbeef" };
    expect(verifyGhlWebhook(req(headers, raw), raw)).toEqual({
      ok: false,
      status: 401,
    });
  });

  it("rejects HMAC when signature header is present but body is missing", () => {
    process.env.GHL_WEBHOOK_SECRET = SECRET;
    expect(verifyGhlWebhook(req({ "x-ghl-signature": "abc123" }))).toEqual({
      ok: false,
      status: 401,
    });
  });

  it("rejects replay when x-ghl-timestamp is older than 5 minutes", () => {
    process.env.GHL_WEBHOOK_SECRET = SECRET;
    const stale = String(Date.now() - 400_000);
    expect(
      verifyGhlWebhook(
        req({
          "x-ghl-webhook-secret": SECRET,
          "x-ghl-timestamp": stale,
        })
      )
    ).toEqual({ ok: false, status: 400 });
  });

  it("rejects replay when body.timestamp is older than 5 minutes", () => {
    process.env.GHL_WEBHOOK_SECRET = SECRET;
    const raw = JSON.stringify({ email: "old@test.com", timestamp: Date.now() - 400_000 });
    expect(verifyGhlWebhook(req({ "x-ghl-webhook-secret": SECRET }, raw), raw)).toEqual({
      ok: false,
      status: 400,
    });
  });

  it("rejects replay when body.ts is older than 5 minutes", () => {
    process.env.GHL_WEBHOOK_SECRET = SECRET;
    const raw = JSON.stringify({ email: "old-ts@test.com", ts: Math.floor((Date.now() - 400_000) / 1000) });
    expect(verifyGhlWebhook(req({ "x-ghl-webhook-secret": SECRET }, raw), raw)).toEqual({
      ok: false,
      status: 400,
    });
  });

  it("does not reject when no timestamp is present (GHL workflows omit it)", () => {
    process.env.GHL_WEBHOOK_SECRET = SECRET;
    const raw = JSON.stringify({ email: "workflow@test.com", event: "tag_added" });
    expect(verifyGhlWebhook(req({ "x-ghl-webhook-secret": SECRET }, raw), raw)).toEqual({
      ok: true,
    });
  });

  it("accepts a fresh timestamp", () => {
    process.env.GHL_WEBHOOK_SECRET = SECRET;
    expect(
      verifyGhlWebhook(
        req({
          "x-ghl-webhook-secret": SECRET,
          "x-ghl-timestamp": String(Date.now()),
        })
      )
    ).toEqual({ ok: true });
  });
});

describe("consumeGhlEventId — in-memory fallback (no supabase client passed)", () => {
  afterEach(() => {
    resetGhlEventIdsForTests();
  });

  it("accepts the first event and rejects the duplicate (409)", async () => {
    const body = { webhookId: "evt-idem-1", email: "dup@test.com" };
    await expect(consumeGhlEventId(body)).resolves.toEqual({ ok: true, eventId: "evt-idem-1" });
    await expect(consumeGhlEventId(body)).resolves.toEqual({
      ok: false,
      status: 409,
      duplicate: true,
    });
  });

  it("uses eventId then id when webhookId is absent", async () => {
    await expect(consumeGhlEventId({ eventId: "evt-2" })).resolves.toEqual({
      ok: true,
      eventId: "evt-2",
    });
    await expect(consumeGhlEventId({ id: "evt-3" })).resolves.toEqual({
      ok: true,
      eventId: "evt-3",
    });
  });

  it("hashes email+event+contact_id+timestamp when no explicit id", async () => {
    const body = {
      email: "hash@test.com",
      event: "tag_added",
      contact_id: "c-1",
      timestamp: "1710000000000",
    };
    const first = await consumeGhlEventId(body);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.eventId).toMatch(/^[a-f0-9]{64}$/);
    }
    await expect(consumeGhlEventId(body)).resolves.toEqual({
      ok: false,
      status: 409,
      duplicate: true,
    });
  });
});

describe("consumeGhlEventId — Supabase-backed (survives cold starts / cross-instance)", () => {
  function fakeSupabase(insertImpl: (row: { event_id: string }) => { error: { code?: string; message: string } | null }) {
    return {
      from: () => ({
        insert: async (row: { event_id: string }) => insertImpl(row),
      }),
    } as unknown as Parameters<typeof consumeGhlEventId>[1];
  }

  it("accepts on a clean insert", async () => {
    const supabase = fakeSupabase(() => ({ error: null }));
    await expect(consumeGhlEventId({ id: "evt-db-1" }, supabase)).resolves.toEqual({
      ok: true,
      eventId: "evt-db-1",
    });
  });

  it("treats a unique_violation (23505) as a duplicate", async () => {
    const supabase = fakeSupabase(() => ({ error: { code: "23505", message: "duplicate key" } }));
    await expect(consumeGhlEventId({ id: "evt-db-2" }, supabase)).resolves.toEqual({
      ok: false,
      status: 409,
      duplicate: true,
    });
  });

  it("falls back to in-memory (not a hard failure) when the table doesn't exist yet", async () => {
    const supabase = fakeSupabase(() => ({
      error: { code: "42P01", message: 'relation "ghl_webhook_events" does not exist' },
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(consumeGhlEventId({ id: "evt-db-3" }, supabase)).resolves.toEqual({
      ok: true,
      eventId: "evt-db-3",
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
