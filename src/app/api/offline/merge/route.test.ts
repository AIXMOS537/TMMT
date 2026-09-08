import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ upsert: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({
  createSSRClient: async () => ({
    auth: { getUser: db.getUser }, rpc: async () => ({ data: "test-org" }),
    from: () => ({ upsert: db.upsert }),
  }),
}));
import { POST } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  db.getUser.mockResolvedValue({ data: { user: { app_metadata: { role: "admin" } } } });
  db.upsert.mockResolvedValue({ error: null });
});
function request(items: unknown[]) {
  return new Request("http://localhost/api/offline/merge", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }),
  });
}
it("holds invalid queued rows while merging a valid payment", async () => {
  const response = await POST(request([
    { table: "contracts", record: { start_date: "2026-09-10", end_date: "2026-09-09" } },
    { table: "customer_payments", record: { amount: "350/week" } },
    { table: "customer_payments", record: { id: "p1", amount: 350 } },
  ]));
  expect(await response.json()).toMatchObject({ ok: false, merged: 1, errors: [expect.any(String), expect.any(String)] });
  expect(db.upsert).toHaveBeenCalledExactlyOnceWith({ id: "p1", amount: 350, org_id: "test-org" });
});
it("holds malformed records instead of inserting blank rows", async () => {
  const response = await POST(request([{ table: "contracts", record: null }]));
  expect(await response.json()).toMatchObject({ ok: false, merged: 0 });
  expect(db.upsert).not.toHaveBeenCalled();
});
it("never merges queued data for an unauthenticated caller", async () => {
  db.getUser.mockResolvedValue({ data: { user: null } });
  const response = await POST(request([{ table: "customer_payments", record: { amount: 350 } }]));
  expect(response.status).toBe(401);
  expect(db.upsert).not.toHaveBeenCalled();
});
it("removes cache-only timestamps from older queued records before replay", async () => {
  const response = await POST(request([{ table: "customer_payments", record: { id: "p1", amount: 350, updated_at: "cache-only", synced: false } }]));
  expect(await response.json()).toMatchObject({ ok: true, merged: 1 });
  expect(db.upsert).toHaveBeenCalledExactlyOnceWith({ id: "p1", amount: 350, org_id: "test-org" });
});
