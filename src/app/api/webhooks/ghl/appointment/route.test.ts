import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { resetGhlEventIdsForTests } from "@/lib/ghl/webhook-auth";

/**
 * T-02: /api/webhooks/ghl/appointment — handleGhlWebhookPost with the
 * "appointment" handler forced. Gate + replay guard + real handler; DB is a double.
 */
const createDb = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase-service", () => ({ createServiceRoleClient: createDb }));

import { POST } from "./route";

const SECRET = "t02-ghl-appointment-secret";
const URL_ = "https://tmmt.example.com/api/webhooks/ghl/appointment";

const payload = {
  webhookId: "evt-appt-1",
  event: "appointment.booked",
  appointment_id: "appt-9",
  contact_id: "ghl-c-9",
  title: "Pickup",
  status: "confirmed",
  calendar_id: "cal-1",
  startTime: "2026-09-10T15:00:00.000Z",
  endTime: "2026-09-10T15:30:00.000Z",
  contact: { name: "Booked Lead", email: "booked@example.com", phone: "+15550002222" },
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
  seenEvents = new Set();
  db = makeFakeSupabase((call) => {
    if (call.table === "ghl_webhook_events" && call.op === "insert") {
      const id = (call.payload as { event_id: string }).event_id;
      if (seenEvents.has(id)) return { error: { code: "23505", message: "duplicate key" } };
      seenEvents.add(id);
      return { error: null };
    }
    if (call.table === "sync_events" && call.op === "insert") return { data: { id: "se-appt" } };
    if (call.table === "ghl_appointments" && call.op === "upsert") {
      const row = call.payload as { ghl_appointment_id: string; starts_at: string | null };
      return { data: { id: "appt-row-1", ghl_appointment_id: row.ghl_appointment_id, starts_at: row.starts_at } };
    }
    return undefined;
  });
  createDb.mockReset();
  createDb.mockReturnValue(db);
  resetGhlEventIdsForTests();
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/webhooks/ghl/appointment — gate", () => {
  it("401 with no credential and no DB client", async () => {
    expect((await POST(req(payload, {}))).status).toBe(401);
    expect(createDb).not.toHaveBeenCalled();
  });

  it("401 on a wrong secret", async () => {
    expect((await POST(req(payload, { "x-ghl-webhook-secret": "nope" }))).status).toBe(401);
    expect(createDb).not.toHaveBeenCalled();
  });

  it("401 when the secret is not configured", async () => {
    vi.stubEnv("GHL_WEBHOOK_SECRET", undefined);
    expect((await POST(withSecret(payload))).status).toBe(401);
    expect(createDb).not.toHaveBeenCalled();
  });

  it("400 on a stale x-ghl-timestamp header", async () => {
    const res = await POST(
      req(payload, { "x-ghl-webhook-secret": SECRET, "x-ghl-timestamp": String(Date.now() - 400_000) })
    );
    expect(res.status).toBe(400);
    expect(createDb).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/ghl/appointment — happy path", () => {
  it("upserts the contact then the appointment, keyed on ghl_appointment_id", async () => {
    const res = await POST(withSecret(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      handler: "appointment",
      appointment_row_id: "appt-row-1",
      ghl_appointment_id: "appt-9",
      starts_at: "2026-09-10T15:00:00.000Z",
    });

    const w = writes(db);
    expect(w.map((c) => [c.table, c.op])).toEqual([
      ["ghl_webhook_events", "insert"],
      ["sync_events", "insert"],
      ["ghl_contacts", "upsert"],
      ["ghl_appointments", "upsert"],
      ["sync_events", "update"],
    ]);
    expect(w[3]).toMatchObject({
      payload: {
        ghl_appointment_id: "appt-9",
        ghl_contact_id: "ghl-c-9",
        title: "Pickup",
        status: "confirmed",
        calendar_id: "cal-1",
        starts_at: "2026-09-10T15:00:00.000Z",
        ends_at: "2026-09-10T15:30:00.000Z",
      },
      options: { onConflict: "ghl_appointment_id" },
    });
  });

  it("400 without an appointment id, after the replay id was consumed", async () => {
    const res = await POST(withSecret({ webhookId: "evt-appt-none", event: "appointment.booked" }));
    expect(res.status).toBe(400);
    expect(writes(db).map((c) => c.table)).toEqual(["ghl_webhook_events"]);
  });
});

describe("POST /api/webhooks/ghl/appointment — idempotent replay", () => {
  it("second delivery is a 409 and writes no appointment", async () => {
    expect((await POST(withSecret(payload))).status).toBe(200);
    const second = await POST(withSecret(payload));
    expect(second.status).toBe(409);
    expect(writes(db).filter((c) => c.table === "ghl_appointments")).toHaveLength(1);
  });
});
