import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";

/**
 * T-02 / T-02c: /api/webhooks/ghl/overdue is a shared-secret route
 * (x-ghl-secret, compared with secretMatches — see F-07). The GHL tag call is
 * mocked; the DB is a recording double whose fake `ghl_webhook_events` table
 * answers 23505 on a repeated event id, so the shared GHL replay gate
 * (`consumeGhlEventId`) behaves as it does against the real primary key.
 */
const h = vi.hoisted(() => ({ createDb: vi.fn(), addContactTag: vi.fn(async () => undefined) }));
vi.mock("@/lib/supabase-service", () => ({ createServiceRoleClient: h.createDb }));
vi.mock("@/lib/ghl/client", () => ({ addContactTag: h.addContactTag }));

import { POST } from "./route";
import { resetGhlEventIdsForTests } from "@/lib/ghl/webhook-auth";
import { _resetDegradedForTests } from "@/lib/degraded";

const SECRET = "t02-ghl-overdue-secret";
const URL_ = "https://tmmt.example.com/api/webhooks/ghl/overdue";

const payload = { contact_id: "ghl-c-late", customer_name: "Late Payer", amount_due: 250, due_date: "2026-09-01" };

function req(body: unknown, headers: Record<string, string>): NextRequest {
  return new NextRequest(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const withSecret = (body: unknown) => req(body, { "x-ghl-secret": SECRET });

let db: FakeSupabase;
/** Event ids the fake ghl_webhook_events table has already stored. */
let seenEvents: Set<string>;

const syncEventWrites = () => writes(db).filter((c) => c.table === "sync_events");
const idemInserts = () => db.calls.filter((c) => c.table === "ghl_webhook_events" && c.op === "insert");

/** The shared GHL idempotency store as a fake: first insert of an id succeeds, a repeat is 23505. */
function idemBackedDb(): FakeSupabase {
  return makeFakeSupabase((call) => {
    if (call.table === "ghl_webhook_events" && call.op === "insert") {
      const id = (call.payload as { event_id: string }).event_id;
      if (seenEvents.has(id)) return { error: { code: "23505", message: "duplicate key" } };
      seenEvents.add(id);
      return { error: null };
    }
    return undefined;
  });
}

beforeEach(() => {
  vi.stubEnv("GHL_OVERDUE_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("GHL_WEBHOOK_SECRET", undefined);
  seenEvents = new Set();
  db = idemBackedDb();
  h.createDb.mockReset();
  h.createDb.mockReturnValue(db);
  h.addContactTag.mockClear();
  h.addContactTag.mockResolvedValue(undefined);
  resetGhlEventIdsForTests();
  _resetDegradedForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("POST /api/webhooks/ghl/overdue — gate", () => {
  it("401 with no header; no DB client and no GHL tag call", async () => {
    const res = await POST(req(payload, {}));
    expect(res.status).toBe(401);
    expect(h.createDb).not.toHaveBeenCalled();
    expect(h.addContactTag).not.toHaveBeenCalled();
  });

  it("401 on a wrong secret", async () => {
    expect((await POST(req(payload, { "x-ghl-secret": "wrong" }))).status).toBe(401);
    expect(h.createDb).not.toHaveBeenCalled();
  });

  it("401 on a different-length secret (timing-safe path does not throw)", async () => {
    expect((await POST(req(payload, { "x-ghl-secret": "x" }))).status).toBe(401);
  });

  it("fails closed when neither GHL_OVERDUE_WEBHOOK_SECRET nor GHL_WEBHOOK_SECRET is set", async () => {
    vi.stubEnv("GHL_OVERDUE_WEBHOOK_SECRET", undefined);
    expect((await POST(req(payload, { "x-ghl-secret": "" }))).status).toBe(401);
    expect(h.createDb).not.toHaveBeenCalled();
  });

  it("falls back to GHL_WEBHOOK_SECRET when the overdue-specific secret is unset", async () => {
    vi.stubEnv("GHL_OVERDUE_WEBHOOK_SECRET", undefined);
    vi.stubEnv("GHL_WEBHOOK_SECRET", "t02-shared-fallback-secret");
    expect((await POST(req(payload, { "x-ghl-secret": "t02-shared-fallback-secret" }))).status).toBe(200);
  });

  it("400 on a body without contact_id, with no write", async () => {
    const res = await POST(withSecret({ customer_name: "nobody" }));
    expect(res.status).toBe(400);
    expect(writes(db)).toEqual([]);
    expect(h.addContactTag).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/ghl/overdue — happy path", () => {
  it("logs a sync_events row and tags the contact payment-overdue", async () => {
    const res = await POST(withSecret(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, contact_id: "ghl-c-late", ghl_tag_applied: true });

    expect(syncEventWrites()).toEqual([
      expect.objectContaining({
        table: "sync_events",
        op: "insert",
        payload: {
          source: "overdue_payment",
          event_type: "payment.overdue",
          external_id: "ghl-c-late",
          payload,
          processed: false,
        },
      }),
    ]);
    expect(h.addContactTag).toHaveBeenCalledWith("ghl-c-late", "payment-overdue");
  });

  it("still returns 200 and records the event when the GHL tag call fails", async () => {
    h.addContactTag.mockRejectedValueOnce(new Error("ghl down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(withSecret(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, ghl_tag_applied: false });
    expect(syncEventWrites()).toHaveLength(1);
    err.mockRestore();
  });
});

describe("POST /api/webhooks/ghl/overdue — replay (T-02c)", () => {
  // The payload has no event id or timestamp. The key is a content hash of
  // (contact_id, amount_due, due_date) bucketed by UTC day — see
  // src/lib/ghl/overdue-replay-key.ts — consumed through the shared GHL store.

  it("records the content-hash key in ghl_webhook_events BEFORE the sync_events insert and the tag", async () => {
    await POST(withSecret(payload));
    const [idem] = idemInserts();
    expect(idem).toBeDefined();
    expect(String((idem.payload as { event_id: string }).event_id)).toMatch(/^overdue:v1:[0-9a-f]{64}$/);
    expect(db.calls.indexOf(idem)).toBeLessThan(db.calls.findIndex((c) => c.table === "sync_events"));
  });

  it("an identical second delivery the same day is a 200 no-op: no second sync_events row, no second tag call", async () => {
    // Was: a second row and a second addContactTag on every retry.
    const first = await POST(withSecret(payload));
    expect(first.status).toBe(200);
    expect(syncEventWrites()).toHaveLength(1);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const second = await POST(withSecret(payload));
    warn.mockRestore();
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, duplicate: true, contact_id: "ghl-c-late" });
    expect(syncEventWrites()).toHaveLength(1);
    expect(h.addContactTag).toHaveBeenCalledTimes(1);
  });

  it("a changed amount or due date is a new signal", async () => {
    await POST(withSecret(payload));
    await POST(withSecret({ ...payload, amount_due: 300 }));
    await POST(withSecret({ ...payload, due_date: "2026-09-15" }));
    expect(syncEventWrites()).toHaveLength(3);
    expect(h.addContactTag).toHaveBeenCalledTimes(3);
  });

  it("customer_name and source are presentation, not state: two producers reporting the same debt collapse", async () => {
    await POST(withSecret({ ...payload, source: "push_overdue_to_ghl" }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await POST(withSecret({ ...payload, customer_name: "L. Payer", source: "n8n" }));
    warn.mockRestore();
    expect(syncEventWrites()).toHaveLength(1);
  });

  it("the same signal for a different contact is not a replay", async () => {
    await POST(withSecret(payload));
    await POST(withSecret({ ...payload, contact_id: "ghl-c-other" }));
    expect(syncEventWrites()).toHaveLength(2);
    expect(h.addContactTag).toHaveBeenCalledTimes(2);
  });

  it("the producer's daily re-send is a new signal the next UTC day (daily cadence preserved)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-08T23:59:00.000Z"));
    await POST(withSecret(payload));
    vi.setSystemTime(new Date("2026-09-09T00:01:00.000Z"));
    await POST(withSecret(payload));
    expect(syncEventWrites()).toHaveLength(2);
    expect(h.addContactTag).toHaveBeenCalledTimes(2);
  });

  it("in-memory fallback: the replay is still caught when the events table is missing, and the fallback is reported", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const noTable = makeFakeSupabase((call) =>
      call.table === "ghl_webhook_events"
        ? { error: { code: "42P01", message: 'relation "ghl_webhook_events" does not exist' } }
        : undefined
    );
    h.createDb.mockReturnValue(noTable);

    expect((await POST(withSecret(payload))).status).toBe(200);
    const second = await POST(withSecret(payload));
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ ok: true, duplicate: true });
    expect(noTable.calls.filter((c) => c.table === "sync_events")).toHaveLength(1);
    expect(h.addContactTag).toHaveBeenCalledTimes(1);
    expect(err.mock.calls.some(([line]) => String(line).startsWith("[degraded] "))).toBe(true);
    warn.mockRestore();
    err.mockRestore();
  });
});
