import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";

/**
 * T-02 / T-02c: /api/webhooks/airtable is a shared-secret route (x-sync-secret
 * via secretMatches, F-07). Airtable fetch, the verified-sync applier and the
 * ops location upsert are mocked so the test can see whether they were
 * reached; the DB is a recording double.
 *
 * The fake DB carries the one piece of state the replay gate depends on: the
 * sync record's `sync_status`, which the (mocked) applier flips to `verified`
 * and which a new GHL stage change resets to `pending_verification`. Its
 * `sync_events` lookup is answered from the inserts already recorded, so a
 * second delivery in the same test sees the first one's row.
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
/** crm_sync_records.sync_status for sync-1, as the opportunity-stage handler and the applier would leave it. */
let syncStatus: string;

const syncEventWrites = () => writes(db).filter((c) => c.table === "sync_events");
const replayLookups = () => db.calls.filter((c) => c.table === "sync_events" && c.op === "select");

function stateBackedDb(failLookup = false): FakeSupabase {
  const client = makeFakeSupabase((call) => {
    if (call.table === "crm_sync_records" && call.op === "select") {
      return { data: { id: "sync-1", sync_status: syncStatus } };
    }
    if (call.table === "sync_events" && call.op === "select") {
      if (failLookup) return { error: { message: "boom" } };
      const want = (col: string) => call.filters.find(([m, c]) => m === "eq" && c === col)?.[2];
      const hit = client.calls.some((c) => {
        if (c.table !== "sync_events" || c.op !== "insert") return false;
        const p = c.payload as Record<string, unknown>;
        return (
          p.source === want("source") &&
          p.event_type === want("event_type") &&
          p.external_id === want("external_id") &&
          p.sync_record_id === want("sync_record_id")
        );
      });
      return { data: hit ? { external_id: want("external_id") } : null };
    }
    return undefined;
  });
  return client;
}

beforeEach(() => {
  vi.stubEnv("SYNC_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("AIRTABLE_OPS_LOCATIONS_TABLE", undefined);
  vi.stubEnv("AIRTABLE_LEADS_TABLE", undefined);
  syncStatus = "pending_verification";
  db = stateBackedDb();
  h.createDb.mockReset();
  h.createDb.mockReturnValue(db);
  h.fetchRecord.mockReset();
  h.fetchRecord.mockResolvedValue({ Verified: true, "GHL Contact ID": "ghl-c-verified" });
  h.applyVerified.mockReset();
  h.applyVerified.mockImplementation(async () => {
    syncStatus = "verified";
    return { caseId: "case-9", canonical: "verified" };
  });
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

describe("POST /api/webhooks/airtable — replay (T-02c)", () => {
  // No event id or timestamp in the payload. Key = (airtable_record_id,
  // crm_sync_records.id) via the record.verified sync_events row the route
  // writes, AND the sync record currently being `verified` — see the route's
  // module comment for why both are needed.

  it("a first delivery against a pending sync record makes no replay lookup", async () => {
    await POST(withSecret(leadPayload));
    expect(replayLookups()).toEqual([]);
    expect(h.applyVerified).toHaveBeenCalledTimes(1);
  });

  it("a retried delivery after a successful apply is a 200 no-op: no second sync_events row, no second applyVerifiedSync", async () => {
    // Was: a second record.verified row and a second applyVerifiedSync (which
    // re-pushes the stage to GHL and re-syncs portal fields) on every retry.
    const first = await POST(withSecret(leadPayload));
    expect(first.status).toBe(200);
    expect(syncEventWrites()).toHaveLength(1);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const second = await POST(withSecret(leadPayload));
    warn.mockRestore();
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, duplicate: true, sync_record_id: "sync-1" });
    expect(syncEventWrites()).toHaveLength(1);
    expect(h.applyVerified).toHaveBeenCalledTimes(1);
  });

  it("the lookup is scoped to source, type, Airtable record and sync record, and runs BEFORE any write", async () => {
    await POST(withSecret(leadPayload));
    await POST(withSecret(leadPayload));
    const [lookup] = replayLookups();
    expect(lookup).toEqual(
      expect.objectContaining({
        table: "sync_events",
        op: "select",
        filters: [
          ["eq", "source", "airtable"],
          ["eq", "event_type", "record.verified"],
          ["eq", "external_id", "recTEST000000001"],
          ["eq", "sync_record_id", "sync-1"],
          ["limit", 1, undefined],
        ],
      })
    );
    // On the second delivery nothing was written after the lookup.
    const lastWrite = db.calls.map((c) => c.op).lastIndexOf("insert");
    expect(lastWrite).toBeLessThan(db.calls.indexOf(lookup));
  });

  it("re-verifying the same Airtable row after a new GHL stage change reset the sync record is applied again (not a replay)", async () => {
    await POST(withSecret(leadPayload));
    syncStatus = "pending_verification"; // opportunity-stage handler upserted the record in place
    const res = await POST(withSecret(leadPayload));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, sync_record_id: "sync-1", case_id: "case-9" });
    expect(syncEventWrites()).toHaveLength(2);
    expect(h.applyVerified).toHaveBeenCalledTimes(2);
  });

  it("an already-verified sync record with no prior Airtable event is first sight (verified elsewhere): processed once", async () => {
    syncStatus = "verified";
    const res = await POST(withSecret(leadPayload));
    expect(res.status).toBe(200);
    expect(replayLookups()).toHaveLength(1);
    expect(syncEventWrites()).toHaveLength(1);
    expect(h.applyVerified).toHaveBeenCalledTimes(1);
  });

  it("a different Airtable record for the same sync record is not a replay", async () => {
    await POST(withSecret(leadPayload));
    await POST(withSecret({ ...leadPayload, airtable_record_id: "recTEST000000002" }));
    expect(syncEventWrites()).toHaveLength(2);
    expect(h.applyVerified).toHaveBeenCalledTimes(2);
  });

  it("fails open when the replay lookup errors: the delivery is processed, not dropped", async () => {
    db = stateBackedDb(true);
    h.createDb.mockReturnValue(db);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await POST(withSecret(leadPayload));
    const res = await POST(withSecret(leadPayload));
    warn.mockRestore();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, sync_record_id: "sync-1" });
    expect(syncEventWrites()).toHaveLength(2);
    expect(h.applyVerified).toHaveBeenCalledTimes(2);
  });

  it("ops_location.upsert has no guard by decision: a retry converges on the same slug and logs one more processed event", async () => {
    // The only effect is an upsert keyed on slug (see the route comment); a
    // content-hash guard would drop a legitimate re-sync of an unchanged row.
    h.fetchRecord.mockResolvedValue({ Slug: "cville", Name: "Charlottesville" });
    const body = { airtable_record_id: "recOPS0000000001", event: "ops_location.upsert" };
    await POST(withSecret(body));
    await POST(withSecret(body));
    expect(h.upsertOps).toHaveBeenCalledTimes(2);
    expect(h.upsertOps.mock.calls[0]).toEqual(h.upsertOps.mock.calls[1]);
    expect(syncEventWrites()).toHaveLength(2);
    expect(h.applyVerified).not.toHaveBeenCalled();
  });
});
