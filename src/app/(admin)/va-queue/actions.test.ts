import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = [string, ...unknown[]];

const db = vi.hoisted(() => ({
  getUser: vi.fn(),
  responses: [] as unknown[],
  calls: [] as Call[],
}));

function builder() {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "not", "order", "limit", "update", "maybeSingle"]) {
    b[m] = vi.fn((...args: unknown[]) => {
      db.calls.push([m, ...args]);
      return b;
    });
  }
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(db.responses.shift()).then(resolve, reject);
  return b;
}

vi.mock("@/lib/supabase-server", () => ({
  createSSRClient: async () => ({ auth: { getUser: db.getUser } }),
}));
vi.mock("@/lib/supabase-service", () => ({
  createServiceRoleClient: () => ({ from: (table: string) => { db.calls.push(["from", table]); return builder(); } }),
}));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("NEXT_REDIRECT"); } }));

import { decideVaTask, getVaQueueSummary, listVaQueue } from "./actions";

const owner = { id: "u-owner", email: "owner@example.com", app_metadata: { role: "admin" } };
const staff = { id: "u-staff", email: "va@example.com", app_metadata: { role: "internal_team" } };
const customer = { id: "u-cust", email: "c@example.com", app_metadata: { role: "customer" } };

const calls = (name: string) => db.calls.filter((c) => c[0] === name);
const pendingRow = { id: 7, status: "pending", handled_at: null, result: { prior: true } };

beforeEach(() => {
  vi.resetAllMocks();
  db.responses.length = 0;
  db.calls.length = 0;
  db.getUser.mockResolvedValue({ data: { user: owner } });
});

describe("access control", () => {
  it("redirects anonymous callers before touching the queue", async () => {
    db.getUser.mockResolvedValue({ data: { user: null } });
    await expect(listVaQueue({ triage: "needs_approval" })).rejects.toThrow("NEXT_REDIRECT");
    expect(calls("from")).toHaveLength(0);
  });

  it("refuses non-staff users without reading or writing", async () => {
    db.getUser.mockResolvedValue({ data: { user: customer } });
    expect(await decideVaTask(7, "dismiss")).toEqual({ success: false, error: "Not authorized." });
    expect(await listVaQueue({ triage: "auto" })).toEqual({ success: false, error: "Not authorized." });
    expect(calls("from")).toHaveLength(0);
  });

  it("lets staff handle and dismiss but reserves approval for the owner", async () => {
    db.getUser.mockResolvedValue({ data: { user: staff } });
    expect(await decideVaTask(7, "approve")).toEqual({
      success: false,
      error: "Only the owner can approve a task.",
    });
    expect(calls("update")).toHaveLength(0);

    db.responses.push({ data: pendingRow, error: null }, { data: [{ id: 7 }], error: null });
    const res = await decideVaTask(7, "handled", "called them");
    expect(res).toMatchObject({ success: true, data: { id: 7, decision: "handled", by: "va@example.com" } });
  });
});

describe("decisions are durable, fenced, and never send anything", () => {
  it("approve records authority in result and leaves the task pending", async () => {
    db.responses.push({ data: pendingRow, error: null }, { data: [{ id: 7 }], error: null });
    const res = await decideVaTask(7, "approve", "  go ahead  ");
    expect(res).toMatchObject({ success: true, data: { decision: "approve", by: "owner@example.com" } });

    const [, patch] = calls("update")[0] as [string, Record<string, unknown>];
    expect(patch).not.toHaveProperty("handled_at");
    expect(patch).not.toHaveProperty("status");
    expect(patch).not.toHaveProperty("triage");
    expect(patch.result).toMatchObject({ prior: true, approval: { by: "owner@example.com", note: "go ahead" } });
    // fenced on handled_at is null so a concurrent close cannot be overwritten
    expect(calls("is")).toContainEqual(["is", "handled_at", null]);
  });

  it("dismiss closes the task with handled_at and keeps prior result data", async () => {
    db.responses.push({ data: pendingRow, error: null }, { data: [{ id: 7 }], error: null });
    const res = await decideVaTask(7, "dismiss");
    expect(res).toMatchObject({ success: true, data: { decision: "dismiss" } });
    const [, patch] = calls("update")[0] as [string, Record<string, unknown>];
    expect(typeof patch.handled_at).toBe("string");
    expect(patch.result).toMatchObject({ prior: true, decision: { kind: "dismiss", note: null } });
  });

  it("refuses to decide a task that is already handled or not pending", async () => {
    db.responses.push({ data: { ...pendingRow, handled_at: "2026-09-01T00:00:00Z" }, error: null });
    expect(await decideVaTask(7, "dismiss")).toEqual({ success: false, error: "Task was already handled." });
    db.responses.push({ data: { ...pendingRow, status: "blocked_dnc" }, error: null });
    expect(await decideVaTask(7, "approve")).toEqual({ success: false, error: "Task is blocked_dnc, not pending." });
    db.responses.push({ data: null, error: null });
    expect(await decideVaTask(7, "handled")).toEqual({ success: false, error: "Task not found." });
    expect(calls("update")).toHaveLength(0);
  });

  it("reports a lost race instead of claiming success when zero rows changed", async () => {
    db.responses.push({ data: pendingRow, error: null }, { data: [], error: null });
    expect(await decideVaTask(7, "handled")).toEqual({
      success: false,
      error: "Task changed before the decision was saved. Reload and try again.",
    });
  });

  it("surfaces database errors verbatim instead of a generic message", async () => {
    db.responses.push({ data: pendingRow, error: null }, { data: null, error: { message: "permission denied" } });
    expect(await decideVaTask(7, "dismiss")).toEqual({
      success: false,
      error: "Could not save the decision: permission denied",
    });
  });

  it("rejects malformed ids and decisions before reading", async () => {
    expect(await decideVaTask(0, "dismiss")).toEqual({ success: false, error: "Invalid task id." });
    expect(await decideVaTask(1.5, "dismiss")).toEqual({ success: false, error: "Invalid task id." });
    expect(await decideVaTask(3, "send" as never)).toEqual({ success: false, error: "Invalid decision." });
    expect(calls("from")).toHaveLength(0);
  });
});

describe("queue reads", () => {
  it("lists only pending, unhandled rows for the requested triage", async () => {
    db.responses.push({ data: [{ id: 1 }], error: null });
    const res = await listVaQueue({ triage: "needs_approval", category: "waitlist_contact", limit: 5000 });
    expect(res).toEqual({ success: true, data: [{ id: 1 }] });
    expect(calls("eq")).toEqual(
      expect.arrayContaining([
        ["eq", "status", "pending"],
        ["eq", "triage", "needs_approval"],
        ["eq", "category", "waitlist_contact"],
      ])
    );
    expect(calls("is")).toContainEqual(["is", "handled_at", null]);
    expect(calls("limit")).toEqual([["limit", 500]]);
  });

  it("treats untriaged as triage is null", async () => {
    db.responses.push({ data: [], error: null });
    await listVaQueue({ triage: "untriaged" });
    expect(calls("is")).toContainEqual(["is", "triage", null]);
    expect(calls("eq").some((c) => c[1] === "triage")).toBe(false);
  });

  it("summarises counts and tells the client whether approval is available", async () => {
    for (const count of [745, 3, 20, 71, 0]) db.responses.push({ count, error: null });
    expect(await getVaQueueSummary()).toEqual({
      success: true,
      data: { needs_approval: 745, approved: 3, auto: 20, ignore: 71, untriaged: 0, canApprove: true },
    });
    expect(calls("not")).toContainEqual(["not", "result->approval", "is", null]);
  });

  it("returns the database error when the list cannot load", async () => {
    db.responses.push({ data: null, error: { message: "timeout" } });
    expect(await listVaQueue({ triage: "auto" })).toEqual({
      success: false,
      error: "Could not load the queue: timeout",
    });
  });
});
