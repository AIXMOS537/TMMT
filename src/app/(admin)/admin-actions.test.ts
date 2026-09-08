import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ upsert: vi.fn(), getUser: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({
  createSSRClient: async () => ({ auth: { getUser: db.getUser }, from: () => ({
    upsert: db.upsert, select: () => ({ eq: () => ({ maybeSingle: db.read }) }),
  }) }),
}));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("NEXT_REDIRECT"); } }));
import { adminUpsert } from "./admin-actions";

beforeEach(() => {
  vi.resetAllMocks();
  db.getUser.mockResolvedValue({ data: { user: { app_metadata: { role: "admin" } } } });
  db.upsert.mockResolvedValue({ error: null });
  db.read.mockResolvedValue({ data: { start_date: "2026-09-10", end_date: "2026-09-20" }, error: null });
});

describe("rental input validation at the server boundary", () => {
  it.each([NaN, Infinity, -Infinity, "350/week", "", true, {}])("rejects an invalid payment amount %s before writing", async (amount) => {
    expect(await adminUpsert("customer_payments", { amount })).toMatchObject({ success: false });
    expect(db.upsert).not.toHaveBeenCalled();
  });
  it("rejects a contract whose end date precedes its start", async () => {
    expect(await adminUpsert("contracts", { start_date: "2026-09-10", end_date: "2026-09-09" })).toMatchObject({ success: false });
    expect(db.upsert).not.toHaveBeenCalled();
  });
  it("rejects impossible calendar dates", async () => {
    expect(await adminUpsert("contracts", { start_date: "2026-02-30" })).toMatchObject({ success: false });
  });
  it("preserves status-only updates and nullable optional fields", async () => {
    expect(await adminUpsert("contracts", { id: "c1", contract_status: "Active" })).toEqual({ success: true });
    expect(await adminUpsert("customer_payments", { id: "p1", amount: null })).toEqual({ success: true });
  });
  it.each([0, 125.5, -25, "125.50"])("accepts finite amounts without changing signed adjustment policy: %s", async (amount) => {
    expect(await adminUpsert("customer_payments", { amount })).toEqual({ success: true });
  });
  it("keeps authentication and authorization ahead of writes", async () => {
    db.getUser.mockResolvedValue({ data: { user: { app_metadata: { role: "customer" } } } });
    expect(await adminUpsert("customer_payments", { amount: 10 })).toEqual({ success: false, error: "Not authorized." });
    expect(db.upsert).not.toHaveBeenCalled();
  });
  it("allows staff to save the tasks table that the desk already supports offline", async () => {
    expect(await adminUpsert("tasks", { id: "t1", status: "In Progress" })).toEqual({ success: true });
  });
  it("validates a partial date edit against the stored contract", async () => {
    expect(await adminUpsert("contracts", { id: "c1", end_date: "2026-09-09" })).toMatchObject({ success: false });
    expect(db.upsert).not.toHaveBeenCalled();
  });
  it("holds a partial date edit if the existing contract cannot be read", async () => {
    db.read.mockResolvedValue({ data: null, error: { message: "Database unavailable" } });
    expect(await adminUpsert("contracts", { id: "c1", end_date: "2026-09-21" })).toMatchObject({ success: false });
    expect(db.upsert).not.toHaveBeenCalled();
  });
});
