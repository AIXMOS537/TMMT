import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { resetGhlEventIdsForTests } from "@/lib/ghl/webhook-auth";

/**
 * T-02: /api/webhooks/ghl/form — handleGhlWebhookPost with the "form" handler
 * forced. Gate + replay guard + real form handler; the DB is a double and the
 * unified intake (case creation, routing) is mocked so its call is observable.
 */
const h = vi.hoisted(() => ({
  createDb: vi.fn(),
  intake: vi.fn(async () => ({ intakeId: "in-1", caseId: "case-1", refCode: "TM-0001", status: "new" })),
}));
vi.mock("@/lib/supabase-service", () => ({ createServiceRoleClient: h.createDb }));
vi.mock("@/lib/intake/unified", () => ({ processUnifiedIntake: h.intake }));

import { POST } from "./route";

const SECRET = "t02-ghl-form-secret";
const URL_ = "https://tmmt.example.com/api/webhooks/ghl/form";

const payload = {
  webhookId: "evt-form-1",
  event: "form.submitted",
  submission_id: "sub-1",
  form_id: "form-1",
  form_name: "Rental Inquiry",
  contact_id: "ghl-c-form",
  fields: { name: "Form Lead", email: "form@example.com", phone: "+15550003333" },
};

function req(body: unknown, headers: Record<string, string>): NextRequest {
  return new NextRequest(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
const withSecret = (body: unknown) => req(body, { "x-ghl-webhook-secret": SECRET });

let db: FakeSupabase;
let seenEvents: Set<string>;

beforeEach(() => {
  vi.stubEnv("GHL_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("GHL_FORM_AUTO_CASE", "false");
  seenEvents = new Set();
  db = makeFakeSupabase((call) => {
    if (call.table === "ghl_webhook_events" && call.op === "insert") {
      const id = (call.payload as { event_id: string }).event_id;
      if (seenEvents.has(id)) return { error: { code: "23505", message: "duplicate key" } };
      seenEvents.add(id);
      return { error: null };
    }
    if (call.table === "sync_events" && call.op === "insert") return { data: { id: "se-form" } };
    if (call.table === "ghl_form_submissions" && (call.op === "upsert" || call.op === "insert")) {
      return { data: { id: "fs-1" } };
    }
    return undefined;
  });
  h.createDb.mockReset();
  h.createDb.mockReturnValue(db);
  h.intake.mockClear();
  resetGhlEventIdsForTests();
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/webhooks/ghl/form — gate", () => {
  it("401 with no credential; no DB client, no intake", async () => {
    expect((await POST(req(payload, {}))).status).toBe(401);
    expect(h.createDb).not.toHaveBeenCalled();
    expect(h.intake).not.toHaveBeenCalled();
  });

  it("401 on a wrong secret", async () => {
    expect((await POST(req(payload, { "x-ghl-secret": "wrong" }))).status).toBe(401);
    expect(h.createDb).not.toHaveBeenCalled();
  });

  it("401 when the secret is not configured", async () => {
    vi.stubEnv("GHL_WEBHOOK_SECRET", undefined);
    expect((await POST(withSecret(payload))).status).toBe(401);
    expect(h.createDb).not.toHaveBeenCalled();
  });

  it("400 on a stale body timestamp", async () => {
    const res = await POST(withSecret({ ...payload, ts: Math.floor((Date.now() - 400_000) / 1000) }));
    expect(res.status).toBe(400);
    expect(h.createDb).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/ghl/form — happy path", () => {
  it("upserts the submission on ghl_submission_id and the contact from the form fields", async () => {
    const res = await POST(withSecret(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      handler: "form.submitted",
      form_submission_id: "fs-1",
      ghl_contact_id: "ghl-c-form",
      case: null,
    });

    const w = writes(db);
    expect(w.map((c) => [c.table, c.op])).toEqual([
      ["ghl_webhook_events", "insert"],
      ["sync_events", "insert"],
      ["ghl_contacts", "upsert"],
      ["ghl_form_submissions", "upsert"],
      ["sync_events", "update"],
    ]);
    expect(w[2].payload).toMatchObject({
      ghl_contact_id: "ghl-c-form",
      full_name: "Form Lead",
      email: "form@example.com",
      phone: "+15550003333",
    });
    expect(w[3]).toMatchObject({
      payload: {
        ghl_submission_id: "sub-1",
        ghl_contact_id: "ghl-c-form",
        form_id: "form-1",
        form_name: "Rental Inquiry",
        source: "ghl",
        fields: payload.fields,
      },
      options: { onConflict: "ghl_submission_id" },
    });
    expect(h.intake).not.toHaveBeenCalled();
  });

  it("create_case: true runs the unified intake and links the submission to the case", async () => {
    const res = await POST(withSecret({ ...payload, webhookId: "evt-form-case", create_case: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ case: { id: "case-1", ref_code: "TM-0001", status: "new" } });
    expect(h.intake).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_name: "Form Lead",
        customer_email: "form@example.com",
        source: "ghl_form",
        payload: expect.objectContaining({ form_submission_id: "fs-1" }),
      })
    );
    const link = writes(db).find((c) => c.table === "ghl_form_submissions" && c.op === "update");
    expect(link).toMatchObject({
      payload: { intake_id: "in-1", case_id: "case-1" },
      filters: [["eq", "id", "fs-1"]],
    });
  });
});

describe("POST /api/webhooks/ghl/form — idempotent replay", () => {
  it("second delivery of the same webhookId is a 409 with no second submission write", async () => {
    expect((await POST(withSecret(payload))).status).toBe(200);
    const second = await POST(withSecret(payload));
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ ok: true, duplicate: true });
    expect(writes(db).filter((c) => c.table === "ghl_form_submissions")).toHaveLength(1);
    expect(h.intake).not.toHaveBeenCalled();
  });
});
