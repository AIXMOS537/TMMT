import { describe, it, expect, vi, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  summarizeMoney,
  summarizeByCategory,
  isFreeForever,
  freeForeverEmails,
  recordMoneyEvent,
  recordMoneyEventSafe,
  getMoneyEvents,
  type MoneyEvent,
} from "./money-meter";

const ORG = "11111111-1111-1111-1111-111111111111";

function ev(e: Partial<MoneyEvent>): MoneyEvent {
  return {
    org_id: ORG,
    direction: "used",
    category: "ai_llm",
    amount_usd: 0,
    billable: true,
    ...e,
  };
}

describe("summarizeMoney", () => {
  it("splits collected / used / saved and computes net + free value", () => {
    const events: MoneyEvent[] = [
      ev({ direction: "collected", category: "sale", amount_usd: 97 }),
      ev({ direction: "collected", category: "deposit", amount_usd: 3750 }),
      ev({ direction: "used", category: "ai_llm", amount_usd: 2, billable: true }),
      ev({ direction: "used", category: "sms", amount_usd: 1, billable: true }),
      // owner/family usage: recorded, but NOT billable
      ev({ direction: "used", category: "ai_llm", amount_usd: 5, billable: false }),
      ev({ direction: "saved", category: "ai_llm", amount_usd: 8 }),
    ];
    const s = summarizeMoney(events);
    expect(s.collected).toBe(3847);
    expect(s.usedBillable).toBe(3); // free-forever $5 excluded
    expect(s.usedAll).toBe(8); // includes the $5
    expect(s.saved).toBe(8);
    expect(s.freeForeverValue).toBe(5);
    expect(s.net).toBe(3844); // collected − usedBillable
  });

  it("is all-zero for an empty ledger", () => {
    expect(summarizeMoney([])).toEqual({
      collected: 0, usedBillable: 0, usedAll: 0, saved: 0, net: 0, freeForeverValue: 0,
    });
  });

  it("ignores non-finite amounts instead of poisoning the totals", () => {
    const s = summarizeMoney([
      ev({ direction: "collected", amount_usd: Number("nope") as unknown as number }),
      ev({ direction: "collected", amount_usd: 10 }),
    ]);
    expect(s.collected).toBe(10);
  });
});

describe("summarizeByCategory", () => {
  it("groups per category and keeps billable vs all-used distinct", () => {
    const rows = summarizeByCategory([
      ev({ direction: "used", category: "ai_llm", amount_usd: 4, billable: true }),
      ev({ direction: "used", category: "ai_llm", amount_usd: 6, billable: false }),
      ev({ direction: "saved", category: "ai_llm", amount_usd: 20 }),
      ev({ direction: "used", category: "sms", amount_usd: 1, billable: true }),
    ]);
    const ai = rows.find((r) => r.category === "ai_llm")!;
    expect(ai).toEqual({ category: "ai_llm", collected: 0, usedBillable: 4, usedAll: 10, saved: 20 });
    // ai_llm has more total activity than sms → sorts first
    expect(rows[0].category).toBe("ai_llm");
  });

  it("buckets blank categories under 'other'", () => {
    const rows = summarizeByCategory([ev({ category: "  ", direction: "used", amount_usd: 1 })]);
    expect(rows[0].category).toBe("other");
  });
});

describe("free-forever (owner + family)", () => {
  const OLD = process.env.MONEY_METER_FREE_FOREVER_EMAILS;
  afterEach(() => {
    if (OLD === undefined) delete process.env.MONEY_METER_FREE_FOREVER_EMAILS;
    else process.env.MONEY_METER_FREE_FOREVER_EMAILS = OLD;
  });

  it("always includes the owner, even with no env set", () => {
    delete process.env.MONEY_METER_FREE_FOREVER_EMAILS;
    expect(isFreeForever("tmmtautodetail@gmail.com")).toBe(true);
    expect(isFreeForever("TMMTAutoDetail@Gmail.com")).toBe(true); // case-insensitive
  });

  it("honors extra family emails from env and is case/space-insensitive", () => {
    process.env.MONEY_METER_FREE_FOREVER_EMAILS = " Wife@Example.com , kid@example.com ";
    expect(isFreeForever("wife@example.com")).toBe(true);
    expect(isFreeForever("kid@example.com")).toBe(true);
    expect(freeForeverEmails()).toContain("tmmtautodetail@gmail.com"); // owner still in
  });

  it("is false for a stranger and for empty input", () => {
    delete process.env.MONEY_METER_FREE_FOREVER_EMAILS;
    expect(isFreeForever("stranger@example.com")).toBe(false);
    expect(isFreeForever(null)).toBe(false);
    expect(isFreeForever("")).toBe(false);
  });
});

// ── Server wrapper stubs ─────────────────────────────────────────────────────
function rpcStub(returns: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue({ data: returns.data ?? null, error: returns.error ?? null });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("recordMoneyEvent", () => {
  it("maps args to the RPC and returns the result", async () => {
    const { client, rpc } = rpcStub({ data: { recorded: true, id: 9, billable: true } });
    const res = await recordMoneyEvent(client, {
      orgId: ORG,
      direction: "used",
      category: "ai_llm",
      amountUsd: 0.0123,
      source: "llm-router",
      ref: "call_1",
      dedupeKey: "ai:call_1",
      meta: { model: "sonnet" },
    });
    expect(res).toEqual({ recorded: true, id: 9, billable: true });
    expect(rpc).toHaveBeenCalledWith("money_meter_record", {
      p_org: ORG,
      p_direction: "used",
      p_category: "ai_llm",
      p_amount: 0.0123,
      p_source: "llm-router",
      p_ref: "call_1",
      p_dedupe: "ai:call_1",
      p_meta: { model: "sonnet" },
    });
  });

  it("defaults optional fields to null (platform-level, no dedupe)", async () => {
    const { client, rpc } = rpcStub({ data: { recorded: true, id: 1, billable: true } });
    await recordMoneyEvent(client, { direction: "saved", category: "ai_llm", amountUsd: 2 });
    expect(rpc).toHaveBeenCalledWith("money_meter_record", {
      p_org: null, p_direction: "saved", p_category: "ai_llm", p_amount: 2,
      p_source: null, p_ref: null, p_dedupe: null, p_meta: null,
    });
  });

  it("throws when the RPC errors", async () => {
    const { client } = rpcStub({ error: { message: "boom" } });
    await expect(
      recordMoneyEvent(client, { direction: "used", category: "sms", amountUsd: 1 })
    ).rejects.toThrow(/money_meter_record failed: boom/);
  });
});

describe("recordMoneyEventSafe", () => {
  it("swallows RPC errors and returns null (never breaks the caller)", async () => {
    const { client } = rpcStub({ error: { message: "db down" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await recordMoneyEventSafe(client, { direction: "used", category: "ai_llm", amountUsd: 1 });
    expect(res).toBeNull();
    spy.mockRestore();
  });
});

describe("getMoneyEvents", () => {
  it("reads the ledger, applies org + since filters, returns rows", async () => {
    const rows = [{ org_id: ORG, direction: "used", category: "ai_llm", amount_usd: 1, billable: true }];
    const gte = vi.fn().mockResolvedValue({ data: rows, error: null });
    const eq = vi.fn().mockReturnValue({ gte });
    const limit = vi.fn().mockReturnValue({ eq });
    const order = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ order });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from } as unknown as SupabaseClient;
    const res = await getMoneyEvents(client, { orgId: ORG, since: "2026-07-01" });
    expect(res).toEqual(rows);
    expect(from).toHaveBeenCalledWith("money_meter_events");
    expect(eq).toHaveBeenCalledWith("org_id", ORG);
    expect(gte).toHaveBeenCalledWith("occurred_at", "2026-07-01");
  });
});
