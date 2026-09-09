import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";

/**
 * T-02: /api/webhooks/airtable/locations — shared secret (x-sync-secret), bulk
 * upsert of ops_locations keyed on slug. DB is a recording double.
 */
const createDb = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase-service", () => ({ createServiceRoleClient: createDb }));

import { POST } from "./route";

const SECRET = "t02-airtable-locations-secret";
const URL_ = "https://tmmt.example.com/api/webhooks/airtable/locations";

const payload = {
  locations: [
    { slug: "cville", name: "Charlottesville", ghl_pipeline_id: "pipe-1", overseas_assignee_email: "ops@example.com" },
    { slug: "rva", name: "Richmond", active: false },
  ],
};

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
  db = makeFakeSupabase();
  createDb.mockReset();
  createDb.mockReturnValue(db);
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/webhooks/airtable/locations — gate", () => {
  it("401 with no header and no DB client", async () => {
    expect((await POST(req(payload, {}))).status).toBe(401);
    expect(createDb).not.toHaveBeenCalled();
  });

  it("401 on a wrong secret", async () => {
    expect((await POST(req(payload, { "x-sync-secret": "wrong" }))).status).toBe(401);
    expect(createDb).not.toHaveBeenCalled();
  });

  it("fails closed when SYNC_WEBHOOK_SECRET is unset", async () => {
    vi.stubEnv("SYNC_WEBHOOK_SECRET", undefined);
    expect((await POST(req(payload, { "x-sync-secret": "" }))).status).toBe(401);
    expect(createDb).not.toHaveBeenCalled();
  });

  it("400 on an empty locations list, with no write", async () => {
    expect((await POST(withSecret({ locations: [] }))).status).toBe(400);
    expect(writes(db)).toEqual([]);
  });

  it("400 on an invalid assignee email, with no write", async () => {
    const bad = { locations: [{ slug: "x", name: "X", overseas_assignee_email: "not-an-email" }] };
    expect((await POST(withSecret(bad))).status).toBe(400);
    expect(writes(db)).toEqual([]);
  });
});

describe("POST /api/webhooks/airtable/locations — happy path", () => {
  it("upserts every row on slug with defaults filled in", async () => {
    const res = await POST(withSecret(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, results: [{ slug: "cville", ok: true }, { slug: "rva", ok: true }] });

    const w = writes(db);
    expect(w).toHaveLength(2);
    expect(w[0]).toMatchObject({
      table: "ops_locations",
      op: "upsert",
      payload: {
        slug: "cville",
        name: "Charlottesville",
        ghl_pipeline_id: "pipe-1",
        ghl_pipeline_name: null,
        clickup_list_id: null,
        overseas_assignee_email: "ops@example.com",
        courier_prefs: {},
        active: true,
      },
      options: { onConflict: "slug" },
    });
    expect(w[1].payload).toMatchObject({ slug: "rva", active: false });
  });

  it("reports a per-row failure without failing the batch", async () => {
    db = makeFakeSupabase((call) =>
      (call.payload as { slug: string }).slug === "rva" ? { error: { message: "boom" } } : undefined
    );
    createDb.mockReturnValue(db);
    const res = await POST(withSecret(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      results: [{ slug: "cville", ok: true }, { slug: "rva", ok: false, error: "boom" }],
    });
  });
});

describe("POST /api/webhooks/airtable/locations — replay", () => {
  // TODO(T-02): no replay guard, but the write is an upsert on slug, so a
  // retried delivery converges on the same rows. Documenting: two deliveries
  // issue two upserts each, no other side effect.
  it("documents current behaviour: a second identical delivery re-upserts the same slugs", async () => {
    await POST(withSecret(payload));
    await POST(withSecret(payload));
    const slugs = writes(db).map((c) => (c.payload as { slug: string }).slug);
    expect(slugs).toEqual(["cville", "rva", "cville", "rva"]);
    expect(writes(db).every((c) => c.op === "upsert")).toBe(true);
  });
});
