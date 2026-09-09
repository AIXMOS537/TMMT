import { beforeEach, describe, expect, it, vi } from "vitest";

const io = vi.hoisted(() => ({
  live: vi.fn(), cache: vi.fn(), queue: vi.fn(), offline: vi.fn(),
}));
vi.mock("@/app/(admin)/admin-actions", () => ({ adminUpsert: io.live }));
vi.mock("@/lib/offline/store", () => ({
  cacheUpsert: io.cache, outboxAdd: io.queue, isBrowserOffline: io.offline,
}));
import { adminUpsert } from "./desk-save";

beforeEach(() => {
  vi.resetAllMocks();
  io.offline.mockReturnValue(false);
  io.live.mockResolvedValue({ success: true });
  io.queue.mockResolvedValue(undefined);
  io.cache.mockImplementation(async (_table, row) => ({ ...row, updated_at: "cache-only" }));
});

describe("rental desk save acknowledgement", () => {
  it("surfaces a server rejection instead of reporting an offline success", async () => {
    io.live.mockResolvedValue({ success: false, error: "Not authorized." });
    expect(await adminUpsert("contracts", { id: "c1", contract_status: "Active" }))
      .toEqual({ success: false, error: "Not authorized." });
    expect(io.queue).not.toHaveBeenCalled();
    expect(io.cache).not.toHaveBeenCalled();
  });
  it("does not requeue a successful online save or send cache metadata", async () => {
    expect(await adminUpsert("customer_payments", { id: "p1", amount: 125.5 })).toEqual({ success: true });
    expect(io.live).toHaveBeenCalledWith("customer_payments", { id: "p1", amount: 125.5 });
    expect(io.queue).not.toHaveBeenCalled();
  });
  it("keeps the same record identity when a network failure is queued for retry", async () => {
    io.live.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await adminUpsert("contracts", { vehicle: "Test vehicle" })).toEqual({ success: true, offline: true });
    const attempted = io.live.mock.calls[0][1];
    expect(attempted.id).toEqual(expect.any(String));
    expect(io.queue).toHaveBeenCalledWith("contracts", attempted);
    expect(attempted).not.toHaveProperty("updated_at");
  });
  it("reports failure if offline storage cannot persist the queued write", async () => {
    io.offline.mockReturnValue(true);
    io.queue.mockRejectedValue(new Error("QuotaExceededError"));
    expect(await adminUpsert("contracts", { id: "c1" })).toMatchObject({ success: false, error: expect.any(String) });
    expect(io.live).not.toHaveBeenCalled();
  });
  it("acknowledges a durable offline write without contacting the server", async () => {
    io.offline.mockReturnValue(true);
    expect(await adminUpsert("contracts", { id: "c1" })).toEqual({ success: true, offline: true });
    expect(io.queue).toHaveBeenCalledWith("contracts", { id: "c1" });
    expect(io.live).not.toHaveBeenCalled();
  });
  it("does not queue invalid payment values while offline", async () => {
    io.offline.mockReturnValue(true);
    expect(await adminUpsert("customer_payments", { amount: Infinity })).toMatchObject({ success: false });
    expect(io.queue).not.toHaveBeenCalled();
  });
  it("does not mistake an expired-login redirect for an offline save", async () => {
    io.live.mockRejectedValue(new Error("NEXT_REDIRECT"));
    expect(await adminUpsert("contracts", { id: "c1" })).toMatchObject({ success: false });
    expect(io.queue).not.toHaveBeenCalled();
  });
});
