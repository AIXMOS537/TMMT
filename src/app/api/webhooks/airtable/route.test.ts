import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";

/**
 * T-02: /api/webhooks/airtable is a shared-secret route (x-sync-secret via
 * secretMatches, F-07). Airtable fetch, the verified-sync applier and the ops
 * location upsert are mocked so the test can see whether they were reached;
 * the DB is a recording double.
 */
const h = vi.hoisted(() => ({
  createDb: vi.fn(),
  fetchRecord: vi.fn(),
  applyVerified: vi.fn(async () => ({ caseId: "case-9", canonical: "verified" })),
  upsertOps: vi.fn(async () => ({ slug: "cville", name: "Charlottesville" })),
}));
vi.mock("@/lib/supabase-service", () => ({ createServiceRoleClient: h.createDb }));
vi.mock("@/lib/crm-sync/airtable", () => ({ fetchAirtableRecord: h.fetchRecord }));
vi.mock("@/lib/crm-sync/apply-verified", () => ({ applyVerifiedSync: h.applyVerified }));
vi.mock("@/lib/routing/ops-locations", () => ({ upsertOpsLocationFromAirtable: h.upsertOps }));

import { POST } from "./route";

const SECRET = "t02-airtable-sync-secret";
const URL_ = "https://tmmt.example.com/api/webhooks/airtable";

const leadPayload = { airtable_record_id: "recTEST000000001", event: "lead.verified", verified_by: "va@example.com" };

function req(body: unknown, headers: Record<string, string>): NextRequest {
  return new NextRequest(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const withSecret = (body: unknown) => req(body, { "x-sync-secret": SECRET });

let db: FakeSupabase;

beforeEach(() => {
  vi.stubEnv("SYNC_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("AIRTABLE_OPS_LOCATIONS_TABLE", undefined);
  vi.stubEnv("AIRTABLE_LEADS_TABLE", undefined);
  db = makeFakeSupabase((call) => {
    if (call.table === "crm_sync_records" && call.op === "select") return { data: { id: "sync-1" } };
    return undefined;
  });
  h.createDb.mockReset();
  h.createDb.mockReturnValue(db);
  h.fetchRecord.mockReset();
  h.fetchRecord.mockResolvedValue({ Verified: true, "GHL Contact ID": "ghl-c-verified" });
  h.applyVerified.mockClear();
  h.upsertOps.mockClear();
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/webhooks/airtable — gate", () => {
  it("401 with no header; Airtable is not fetched and no DB client is built", async () => {
    const res = await POST(req(leadPayload, {}));
    expect(res.status).toBe(401);
    expect(h.fetchRecord).not.toHaveBeenCalled();
    expect(h.createDb).not.toHaveBeenCalled();
    expect(h.applyVerified).not.toHaveBeenCalled();
  });

  it("401 on a wrong secret", async () => {
    expect((await POST(req(leadPayload, { "x-sync-secret": "wrong" }))).status).toBe(401);
    expect(h.createDb).not.toHaveBeenCalled();
  });

  it("401 on a different-length secret without throwing", async () => {
    expect((await POST(req(leadPayload, { "x-sync-secret": "x" }))).status).toBe(401);
  });

  it("fails closed when SYNC_WEBHOOK_SECRET is unset", async () => {
    vi.stubEnv("SYNC_WEBHOOK_SECRET", undefined);
    expect((await POST(req(leadPayload, { "x-sync-secret": "" }))).status).toBe(401);
    expect(h.createDb).not.toHaveBeenCalled();
  });

  it("400 on a body without airtable_record_id, with no fetch or write", async () => {
    const res = await POST(withSecret({ event: "lead.verified" }));
    expect(res.status).toBe(400);
    expect(h.fetchRecord).not.toHaveBeenCalled();
    expect(writes(db)).toEqual([]);
  });
});

describe("POST /api/webhooks/airtable — happy path", () => {
  it("lead.verified: logs the event against the sync record and applies the verified sync", async () => {
    const res = await POST(withSecret(leadPayload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, sync_record_id: "sync-1", case_id: "case-9", canonical_stage: "verified" });

    expect(h.fetchRecord).toHaveBeenCalledWith("Leads", "recTEST000000001");
    const lookup = db.calls.find((c) => c.table === "crm_sync_records");
    expect(lookup?.filters).toContainEqual(["eq", "ghl_contact_id", "ghl-c-verified"]);
    expect(writes(db)).toEqual([
      expect.objectContaining({
        table: "sync_events",
        op: "insert",
        payload: expect.objectContaining({
          source: "airtable",
          event_type: "record.verified",
          external_id: "recTEST000000001",
          sync_record_id: "sync-1",
          processed: true,
        }),
      }),
    ]);
    expect(h.applyVerified).toHaveBeenCalledWith({
      syncRecordId: "sync-1",
      verifiedBy: "va@example.com",
      airtableFields: { Verified: true, "GHL Contact ID": "ghl-c-verified" },
    });
  });

  it("ops_location.upsert: upserts the location and logs a processed sync event", async () => {
    const fields = { Slug: "cville", Name: "Charlottesville" };
    h.fetchRecord.mockResolvedValue(fields);
    const res = await POST(withSecret({ airtable_record_id: "recOPS0000000001", event: "ops_location.upsert" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ops_location: { slug: "cville", name: "Charlottesville" } });
    expect(h.upsertOps).toHaveBeenCalledWith(fields);
    expect(writes(db)[0]).toMatchObject({
      table: "sync_events",
      op: "insert",
      payload: { source: "airtable", event_type: "ops_location.upsert", external_id: "recOPS0000000001", processed: true },
    });
    expect(h.applyVerified).not.toHaveBeenCalled();
  });

  it("400 when the row is not verified — nothing applied, nothing written", async () => {
    h.fetchRecord.mockResolvedValue({ Verified: false, "GHL Contact ID": "ghl-c-verified" });
    const res = await POST(withSecret(leadPayload));
    expect(res.status).toBe(400);
    expect(writes(db)).toEqual([]);
    expect(h.applyVerified).not.toHaveBeenCalled();
  });

  it("400 when no GHL contact id can be found on the row or in the body", async () => {
    h.fetchRecord.mockResolvedValue({ Verified: true });
    expect((await POST(withSecret(leadPayload))).status).toBe(400);
    expect(writes(db)).toEqual([]);
  });

  it("404 when there is no crm_sync_record for the contact", async () => {
    db = makeFakeSupabase(() => ({ data: null }));
    h.createDb.mockReturnValue(db);
    const res = await POST(withSecret(leadPayload));
    expect(res.status).toBe(404);
    expect(writes(db)).toEqual([]);
    expect(h.applyVerified).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/airtable — replay", () => {
  // TODO(T-02): no replay guard. There is no event id or timestamp; a retried
  // Airtable automation re-fetches the row, logs a second record.verified
  // sync_events row and re-runs applyVerifiedSync. Whether that is harmless
  // depends on applyVerifiedSync being idempotent on sync_record_id.
  it("documents current behaviour: an identical second delivery re-applies the sync", async () => {
    await POST(withSecret(leadPayload));
    await POST(withSecret(leadPayload));
    expect(writes(db).filter((c) => c.table === "sync_events")).toHaveLength(2);
    expect(h.applyVerified).toHaveBeenCalledTimes(2);
  });
});
