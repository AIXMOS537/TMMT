import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { resetGhlEventIdsForTests } from "@/lib/ghl/webhook-auth";

/**
 * T-02: the merged GHL entry point. The gate (verifyGhlWebhook) and the replay
 * guard (consumeGhlEventId) run for real; everything past them that would do
 * work — CRM dispatch, payment/token/referral ledgers, ClickUp, the internal
 * program hop — is a mock so the test can say whether it was reached.
 */
const h = vi.hoisted(() => ({
  dispatch: vi.fn(async () => ({ status: 200, body: { ok: true, handler: "contact" } })),
  recordPayment: vi.fn(),
  shouldRecordPayment: vi.fn(() => false),
  grantTokens: vi.fn(async () => ({ topped_up: false, reason: "no-grant-tag" })),
  referral: vi.fn(),
  clickupEnabled: vi.fn(() => false),
  clickupSync: vi.fn(),
  fetchWithTimeout: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: h.createClient }));
vi.mock("@/lib/ghl/dispatch", () => ({ dispatchGhlWebhook: h.dispatch }));
vi.mock("@/lib/ghl-payment-sync", () => ({
  recordGhlPayment: h.recordPayment,
  shouldRecordPayment: h.shouldRecordPayment,
  extractPaymentRef: () => null,
}));
vi.mock("@/lib/token-ledger", () => ({ grantMonthlyTokensForPayment: h.grantTokens }));
vi.mock("@/lib/referrals", () => ({ recordCollectedReferral: h.referral }));
vi.mock("@/lib/clickup/client", () => ({ isClickUpEnabled: h.clickupEnabled }));
vi.mock("@/lib/clickup/sync-case", () => ({ syncGhlEventToClickUp: h.clickupSync }));
vi.mock("@/lib/fetch-with-timeout", () => ({ fetchWithTimeout: h.fetchWithTimeout }));

import { POST } from "./route";

const SECRET = "t02-ghl-route-secret";
const URL_ = "https://tmmt.example.com/api/webhooks/ghl";

const contactPayload = {
  webhookId: "evt-contact-1",
  event: "contact.created",
  contact_id: "ghl-c-1",
  email: "lead@example.com",
};

const tagPayload = {
  webhookId: "evt-tag-1",
  email: "member@example.com",
  tags: ["welcome-call"],
  event: "tag_added",
};

function req(body: unknown, headers: Record<string, string>): NextRequest {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return new NextRequest(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: raw,
  });
}

const withSecret = (body: unknown, extra: Record<string, string> = {}) =>
  req(body, { "x-ghl-webhook-secret": SECRET, ...extra });

const hmac = (raw: string, secret = SECRET) =>
  createHmac("sha256", secret).update(raw, "utf8").digest("hex");

let db: FakeSupabase;
/** Event ids the fake ghl_webhook_events table has already stored. */
let seenEvents: Set<string>;

beforeEach(() => {
  vi.stubEnv("GHL_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fake-project.supabase.example.com");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "t02-fake-service-role-key");
  seenEvents = new Set();
  db = makeFakeSupabase((call) => {
    if (call.table === "ghl_webhook_events" && call.op === "insert") {
      const id = (call.payload as { event_id: string }).event_id;
      if (seenEvents.has(id)) return { error: { code: "23505", message: "duplicate key" } };
      seenEvents.add(id);
      return { error: null };
    }
    if (call.table === "active_customers" && call.op === "select") {
      return { data: [{ id: "cust-1", service_notes: "" }] };
    }
    return undefined;
  });
  h.createClient.mockReturnValue(db);
  h.dispatch.mockClear();
  h.recordPayment.mockClear();
  h.grantTokens.mockClear();
  h.fetchWithTimeout.mockClear();
  resetGhlEventIdsForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/webhooks/ghl — gate", () => {
  it("rejects a request with no credential and touches nothing", async () => {
    const res = await POST(req(contactPayload, {}));
    expect(res.status).toBe(401);
    expect(h.createClient).not.toHaveBeenCalled();
    expect(h.dispatch).not.toHaveBeenCalled();
    expect(db.calls).toEqual([]);
  });

  it("rejects a wrong shared secret", async () => {
    const res = await POST(req(contactPayload, { "x-ghl-webhook-secret": "not-the-secret" }));
    expect(res.status).toBe(401);
    expect(h.dispatch).not.toHaveBeenCalled();
    expect(db.calls).toEqual([]);
  });

  it("rejects a bad HMAC signature", async () => {
    const res = await POST(req(contactPayload, { "x-ghl-signature": "deadbeef" }));
    expect(res.status).toBe(401);
    expect(h.dispatch).not.toHaveBeenCalled();
    expect(db.calls).toEqual([]);
  });

  it("rejects an HMAC computed over a different body (tamper)", async () => {
    const raw = JSON.stringify(contactPayload);
    const tampered = JSON.stringify({ ...contactPayload, email: "attacker@example.com" });
    const res = await POST(req(tampered, { "x-ghl-signature": hmac(raw) }));
    expect(res.status).toBe(401);
    expect(h.dispatch).not.toHaveBeenCalled();
  });

  it("fails closed when GHL_WEBHOOK_SECRET is not configured", async () => {
    vi.stubEnv("GHL_WEBHOOK_SECRET", undefined);
    const res = await POST(req(contactPayload, { "x-ghl-webhook-secret": "" }));
    expect(res.status).toBe(401);
    expect(h.dispatch).not.toHaveBeenCalled();
    expect(db.calls).toEqual([]);
  });

  it("rejects a stale timestamp as a replay (400) before any DB access", async () => {
    const stale = String(Date.now() - 400_000);
    const res = await POST(withSecret(contactPayload, { "x-ghl-timestamp": stale }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Stale webhook" });
    expect(h.createClient).not.toHaveBeenCalled();
    expect(h.dispatch).not.toHaveBeenCalled();
  });

  it("rejects a non-object JSON body after auth, before the replay guard", async () => {
    const res = await POST(withSecret("[1,2,3]"));
    expect(res.status).toBe(400);
    expect(db.calls).toEqual([]);
  });
});

describe("POST /api/webhooks/ghl — happy path", () => {
  it("shared-secret header: routes a CRM payload to the dispatcher with the parsed body", async () => {
    const res = await POST(withSecret(contactPayload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, handler: "contact" });
    expect(h.dispatch).toHaveBeenCalledTimes(1);
    expect(h.dispatch).toHaveBeenCalledWith(db, contactPayload);
    // The replay guard recorded the event id first.
    expect(db.calls[0]).toMatchObject({
      table: "ghl_webhook_events",
      op: "insert",
      payload: { event_id: "evt-contact-1" },
    });
  });

  it("HMAC path: x-ghl-signature over the raw body is accepted", async () => {
    const raw = JSON.stringify(contactPayload);
    const res = await POST(req(raw, { "x-ghl-signature": `sha256=${hmac(raw)}` }));
    expect(res.status).toBe(200);
    expect(h.dispatch).toHaveBeenCalledTimes(1);
  });

  it("legacy x-ghl-secret header is still honoured", async () => {
    const res = await POST(req(contactPayload, { "x-ghl-secret": SECRET }));
    expect(res.status).toBe(200);
  });

  it("tag payload: stamps service_notes on the matching active customer", async () => {
    const res = await POST(withSecret(tagPayload));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, updated: "active_customers" });
    expect(h.dispatch).not.toHaveBeenCalled();
    const update = writes(db).find((c) => c.table === "active_customers");
    expect(update).toMatchObject({ op: "update", filters: [["eq", "id", "cust-1"]] });
    expect((update?.payload as { service_notes: string }).service_notes).toContain(
      "GHL tag_added: welcome-call"
    );
  });

  it("tag payload without an email is skipped without writing", async () => {
    const res = await POST(withSecret({ webhookId: "evt-noemail", tags: ["x"] }));
    expect(await res.json()).toEqual({ ok: true, skipped: "no email" });
    expect(writes(db).filter((c) => c.table !== "ghl_webhook_events")).toEqual([]);
  });
});

describe("POST /api/webhooks/ghl — idempotent replay", () => {
  it("DB-backed: the same webhookId delivered twice is a 409 no-op the second time", async () => {
    const first = await POST(withSecret(contactPayload));
    expect(first.status).toBe(200);

    const second = await POST(withSecret(contactPayload));
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ ok: true, duplicate: true });
    expect(h.dispatch).toHaveBeenCalledTimes(1);
  });

  it("tag payload replay: the second delivery writes no service_notes", async () => {
    await POST(withSecret(tagPayload));
    const before = writes(db).filter((c) => c.table === "active_customers").length;
    expect(before).toBe(1);

    const second = await POST(withSecret(tagPayload));
    expect(second.status).toBe(409);
    expect(writes(db).filter((c) => c.table === "active_customers").length).toBe(before);
  });

  it("in-memory fallback: replay is still caught when the events table is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const noTable = makeFakeSupabase((call) =>
      call.table === "ghl_webhook_events"
        ? { error: { code: "42P01", message: 'relation "ghl_webhook_events" does not exist' } }
        : undefined
    );
    h.createClient.mockReturnValue(noTable);

    expect((await POST(withSecret(contactPayload))).status).toBe(200);
    expect((await POST(withSecret(contactPayload))).status).toBe(409);
    expect(h.dispatch).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("distinct event ids are both processed", async () => {
    await POST(withSecret(contactPayload));
    await POST(withSecret({ ...contactPayload, webhookId: "evt-contact-2" }));
    expect(h.dispatch).toHaveBeenCalledTimes(2);
  });
});
