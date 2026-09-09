import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeFakeSupabase, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { deriveGhlEventId, resetGhlEventIdsForTests } from "@/lib/ghl/webhook-auth";

/**
 * T-02: /api/webhooks/ghl/program. Gate + replay guard are real; the program
 * application factory is mocked (it is the side effect), and the Supabase
 * client used for the replay table is a double.
 */
const h = vi.hoisted(() => ({
  createClient: vi.fn(),
  createApp: vi.fn(async () => ({ id: "app-1", learnUrl: "https://learn.example.com/a/app-1" })),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: h.createClient }));
vi.mock("@/lib/program-applications-server", () => ({ createProgramApplicationFromGhl: h.createApp }));

import { POST } from "./route";

const SECRET = "t02-ghl-program-secret";
const URL_ = "https://tmmt.example.com/api/webhooks/ghl/program";

const payload = {
  webhookId: "evt-program-1",
  email: "applicant@example.com",
  contact_id: "ghl-c-prog",
  first_name: "Test",
  last_name: "Applicant",
  tags: ["Ready-For-AIXMOS"],
};

function req(body: unknown, headers: Record<string, string>): NextRequest {
  return new NextRequest(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const withSecret = (body: unknown, extra: Record<string, string> = {}) =>
  req(body, { "x-ghl-webhook-secret": SECRET, ...extra });

let db: FakeSupabase;
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
    return undefined;
  });
  h.createClient.mockReset();
  h.createClient.mockReturnValue(db);
  h.createApp.mockClear();
  resetGhlEventIdsForTests();
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/webhooks/ghl/program — gate", () => {
  it("401 with no credential; nothing created, no DB", async () => {
    expect((await POST(req(payload, {}))).status).toBe(401);
    expect(h.createApp).not.toHaveBeenCalled();
    expect(h.createClient).not.toHaveBeenCalled();
  });

  it("401 on a wrong secret", async () => {
    expect((await POST(req(payload, { "x-ghl-webhook-secret": "wrong" }))).status).toBe(401);
    expect(h.createApp).not.toHaveBeenCalled();
  });

  it("401 on a bad HMAC", async () => {
    expect((await POST(req(payload, { "x-ghl-signature": "sha256=00" }))).status).toBe(401);
    expect(h.createApp).not.toHaveBeenCalled();
  });

  it("401 when the secret is not configured", async () => {
    vi.stubEnv("GHL_WEBHOOK_SECRET", undefined);
    expect((await POST(withSecret(payload))).status).toBe(401);
  });

  it("400 Stale webhook on an old timestamp, before the replay table is touched", async () => {
    const res = await POST(withSecret(payload, { "x-ghl-timestamp": String(Date.now() - 400_000) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Stale webhook" });
    expect(h.createClient).not.toHaveBeenCalled();
  });

  it("400 Invalid JSON after auth", async () => {
    const res = await POST(withSecret("{nope"));
    expect(res.status).toBe(400);
    expect(h.createClient).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/ghl/program — happy path", () => {
  it("creates the application for a ready-for-aixmos tag and returns the learn link", async () => {
    const res = await POST(withSecret(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, applicationId: "app-1", learnUrl: "https://learn.example.com/a/app-1" });
    expect(h.createApp).toHaveBeenCalledWith({
      email: "applicant@example.com",
      clientName: "Test Applicant",
      ghlContactId: "ghl-c-prog",
      tags: ["ready-for-aixmos"],
    });
    expect(db.calls[0]).toMatchObject({ table: "ghl_webhook_events", op: "insert", payload: { event_id: "evt-program-1" } });
  });

  it("event=aixmos.program.start triggers without a tag", async () => {
    const res = await POST(withSecret({ webhookId: "evt-program-evt", email: "e@example.com", event: "aixmos.program.start" }));
    expect(res.status).toBe(200);
    expect(h.createApp).toHaveBeenCalledTimes(1);
  });

  it("skips a payload with no program trigger, without creating anything", async () => {
    const res = await POST(withSecret({ webhookId: "evt-program-none", email: "e@example.com", tags: ["welcome"] }));
    expect(await res.json()).toEqual({ ok: true, skipped: "no program trigger" });
    expect(h.createApp).not.toHaveBeenCalled();
  });

  it("503 when the factory throws (no learn link handed out)", async () => {
    h.createApp.mockRejectedValueOnce(new Error("db unavailable"));
    const res = await POST(withSecret(payload));
    expect(res.status).toBe(503);
  });
});

describe("POST /api/webhooks/ghl/program — idempotent replay", () => {
  it("second delivery of the same webhookId is a 409 and creates nothing", async () => {
    expect((await POST(withSecret(payload))).status).toBe(200);
    const second = await POST(withSecret(payload));
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ ok: true, duplicate: true });
    expect(h.createApp).toHaveBeenCalledTimes(1);
  });

  it("internal hop from /api/webhooks/ghl (x-tmmt-ghl-consumed = this event id) skips the replay guard", async () => {
    // The parent route already consumed the id; the hop must not 409 on itself.
    const hop = { "x-tmmt-ghl-consumed": deriveGhlEventId(payload) };
    expect((await POST(withSecret(payload, hop))).status).toBe(200);
    expect(h.createClient).not.toHaveBeenCalled();
    expect(h.createApp).toHaveBeenCalledTimes(1);
  });

  it("a hop header for a DIFFERENT event id does not bypass the guard", async () => {
    const hop = { "x-tmmt-ghl-consumed": "some-other-id" };
    expect((await POST(withSecret(payload, hop))).status).toBe(200);
    expect((await POST(withSecret(payload, hop))).status).toBe(409);
    expect(h.createApp).toHaveBeenCalledTimes(1);
  });

  it("the hop header alone is not a credential", async () => {
    const res = await POST(req(payload, { "x-tmmt-ghl-consumed": deriveGhlEventId(payload) }));
    expect(res.status).toBe(401);
    expect(h.createApp).not.toHaveBeenCalled();
  });
});
