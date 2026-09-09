import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";

/**
 * T-02: /api/webhooks/ghl/overdue is a shared-secret route (x-ghl-secret,
 * compared with secretMatches — see F-07). The GHL tag call is mocked; the DB
 * is a recording double.
 */
const h = vi.hoisted(() => ({ createDb: vi.fn(), addContactTag: vi.fn(async () => undefined) }));
vi.mock("@/lib/supabase-service", () => ({ createServiceRoleClient: h.createDb }));
vi.mock("@/lib/ghl/client", () => ({ addContactTag: h.addContactTag }));

import { POST } from "./route";

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

beforeEach(() => {
  vi.stubEnv("GHL_OVERDUE_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("GHL_WEBHOOK_SECRET", undefined);
  db = makeFakeSupabase();
  h.createDb.mockReset();
  h.createDb.mockReturnValue(db);
  h.addContactTag.mockClear();
  h.addContactTag.mockResolvedValue(undefined);
});

afterEach(() => vi.unstubAllEnvs());

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

    expect(writes(db)).toEqual([
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
    expect(writes(db)).toHaveLength(1);
    err.mockRestore();
  });
});

describe("POST /api/webhooks/ghl/overdue — replay", () => {
  // TODO(T-02): no replay guard. The route has no event id / timestamp check, so a
  // retried delivery logs a second sync_events row and re-applies the tag. The tag
  // is naturally idempotent in GHL; the duplicate sync_events row is the cost.
  it("documents current behaviour: an identical second delivery writes a second sync_events row", async () => {
    await POST(withSecret(payload));
    await POST(withSecret(payload));
    expect(writes(db).filter((c) => c.table === "sync_events")).toHaveLength(2);
    expect(h.addContactTag).toHaveBeenCalledTimes(2);
  });
});
