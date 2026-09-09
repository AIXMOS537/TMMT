import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { resetGhlEventIdsForTests } from "@/lib/ghl/webhook-auth";

/**
 * T-02: /api/webhooks/ghl/contact goes through handleGhlWebhookPost with the
 * "contact" handler forced. Gate, replay guard and the real contact handler run;
 * only the Supabase client is a recording double.
 */
const createDb = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase-service", () => ({ createServiceRoleClient: createDb }));

import { POST } from "./route";

const SECRET = "t02-ghl-contact-secret";
const URL_ = "https://tmmt.example.com/api/webhooks/ghl/contact";

const payload = {
  webhookId: "evt-contact-sub-1",
  event: "contact.created",
  contact_id: "ghl-c-77",
  location_id: "loc-1",
  tags: ["new-lead"],
  contact: { name: "Test Lead", email: "lead@example.com", phone: "+15550001111" },
};

function req(body: unknown, headers: Record<string, string>): NextRequest {
  return new NextRequest(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const withSecret = (body: unknown) => req(body, { "x-ghl-webhook-secret": SECRET });

let db: FakeSupabase;
let seenEvents: Set<string>;

beforeEach(() => {
  vi.stubEnv("GHL_WEBHOOK_SECRET", SECRET);
  seenEvents = new Set();
  db = makeFakeSupabase((call) => {
    if (call.table === "ghl_webhook_events" && call.op === "insert") {
      const id = (call.payload as { event_id: string }).event_id;
      if (seenEvents.has(id)) return { error: { code: "23505", message: "duplicate key" } };
      seenEvents.add(id);
      return { error: null };
    }
    if (call.table === "sync_events" && call.op === "insert") return { data: { id: "se-1" } };
    if (call.table === "ghl_contacts" && call.op === "upsert") {
      const row = call.payload as { ghl_contact_id: string; email: string; full_name: string };
      return { data: { id: "row-1", ...row } };
    }
    return undefined;
  });
  createDb.mockReset();
  createDb.mockReturnValue(db);
  resetGhlEventIdsForTests();
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/webhooks/ghl/contact — gate", () => {
  it("401 with no credential; the service-role client is never even built", async () => {
    const res = await POST(req(payload, {}));
    expect(res.status).toBe(401);
    expect(createDb).not.toHaveBeenCalled();
  });

  it("401 on a wrong secret", async () => {
    const res = await POST(req(payload, { "x-ghl-secret": "wrong" }));
    expect(res.status).toBe(401);
    expect(createDb).not.toHaveBeenCalled();
  });

  it("401 on a bad HMAC", async () => {
    const res = await POST(req(payload, { "x-wh-signature": "00" }));
    expect(res.status).toBe(401);
    expect(createDb).not.toHaveBeenCalled();
  });

  it("401 when the secret is not configured (fail closed)", async () => {
    vi.stubEnv("GHL_WEBHOOK_SECRET", undefined);
    expect((await POST(withSecret(payload))).status).toBe(401);
    expect(createDb).not.toHaveBeenCalled();
  });

  it("400 on a stale timestamp", async () => {
    const raw = JSON.stringify({ ...payload, timestamp: Date.now() - 400_000 });
    const res = await POST(withSecret(raw));
    expect(res.status).toBe(400);
    expect(createDb).not.toHaveBeenCalled();
  });

  it("400 on a non-JSON body, before the DB is touched", async () => {
    expect((await POST(withSecret("not json"))).status).toBe(400);
    expect(createDb).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/ghl/contact — happy path", () => {
  it("upserts ghl_contacts keyed on ghl_contact_id and marks the sync event processed", async () => {
    const res = await POST(withSecret(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      handler: "contact",
      event: "contact.created",
      ghl_contact_id: "ghl-c-77",
      contact_row_id: "row-1",
    });

    const w = writes(db);
    expect(w.map((c) => [c.table, c.op])).toEqual([
      ["ghl_webhook_events", "insert"],
      ["sync_events", "insert"],
      ["ghl_contacts", "upsert"],
      ["sync_events", "update"],
    ]);
    expect(w[2]).toMatchObject({
      payload: {
        ghl_contact_id: "ghl-c-77",
        full_name: "Test Lead",
        email: "lead@example.com",
        phone: "+15550001111",
        location_id: "loc-1",
        tags: ["new-lead"],
      },
      options: { onConflict: "ghl_contact_id" },
    });
    expect(w[3]).toMatchObject({ payload: { processed: true }, filters: [["eq", "id", "se-1"]] });
  });

  it("HMAC signature over the raw body is accepted too", async () => {
    const raw = JSON.stringify(payload);
    const sig = createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
    const res = await POST(req(raw, { "x-ghl-signature": sig }));
    expect(res.status).toBe(200);
  });

  it("400 when no contact id can be derived (after the replay guard consumed the id)", async () => {
    const res = await POST(withSecret({ webhookId: "evt-no-contact", event: "contact.updated" }));
    expect(res.status).toBe(400);
    expect(writes(db).map((c) => c.table)).toEqual(["ghl_webhook_events"]);
  });
});

describe("POST /api/webhooks/ghl/contact — idempotent replay", () => {
  it("the second delivery of the same webhookId is a 409 with no contact write", async () => {
    expect((await POST(withSecret(payload))).status).toBe(200);
    const second = await POST(withSecret(payload));
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ ok: true, duplicate: true });
    expect(writes(db).filter((c) => c.table === "ghl_contacts")).toHaveLength(1);
  });
});
