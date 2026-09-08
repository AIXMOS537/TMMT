import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * decideBgCheck adopts the seven-argument bg_check_decide contract that S3-03
 * (migration 20260907035109_s3_03_decision_contract.sql) put in production:
 *
 *   p_id uuid, p_decision text, p_notes text = null, p_reason_code text = null,
 *   p_explanation text = null, p_product_program text = null, p_dedupe_key text = null
 *   → jsonb {id, from, to, reviewed_at, decision_event_id, reason_code}
 *
 * These tests pin the wire payload the app sends, not the database's behaviour.
 * Authorization (42501 "staff or admin only"), org isolation and reason-code
 * validation are enforced inside the SECURITY DEFINER function; the app's job is
 * to send the right shape and surface the database's answer unchanged.
 */

const rpc = vi.fn();
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));
vi.mock("@/lib/offline/store", () => ({
  cacheRead: vi.fn(),
  cacheReplace: vi.fn(),
  isBrowserOffline: () => false,
}));

import { decideBgCheck, bgCheckDedupeKey, BG_CHECK_DECISIONS, type BgCheckDecision } from "./queries";

const ID = "8e651b25-e7c8-4356-af64-1716a82053b0";
const OK = { id: ID, from: null, to: "Eligible", reviewed_at: "2026-09-08T12:00:00Z", decision_event_id: "e1", reason_code: null };

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: OK, error: null });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-08T14:05:59.999Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("bgCheckDedupeKey", () => {
  it("is bgcheck:<id>:<decision>:<yyyymmddhhmm> in UTC, minute granularity", () => {
    expect(bgCheckDedupeKey(ID, "Eligible", new Date("2026-09-08T14:05:59.999Z"))).toBe(
      `bgcheck:${ID}:Eligible:202609081405`
    );
  });

  it("is stable within a minute, so a retry or double-click reuses it", () => {
    const a = bgCheckDedupeKey(ID, "Not Eligible", new Date("2026-09-08T14:05:00.000Z"));
    const b = bgCheckDedupeKey(ID, "Not Eligible", new Date("2026-09-08T14:05:59.000Z"));
    expect(a).toBe(b);
  });

  it("changes when the minute, the verdict, or the check changes", () => {
    const base = bgCheckDedupeKey(ID, "Eligible", new Date("2026-09-08T14:05:00Z"));
    expect(bgCheckDedupeKey(ID, "Eligible", new Date("2026-09-08T14:06:00Z"))).not.toBe(base);
    expect(bgCheckDedupeKey(ID, "Not found", new Date("2026-09-08T14:05:00Z"))).not.toBe(base);
    expect(bgCheckDedupeKey("00000000-0000-4000-8000-000000000001", "Eligible", new Date("2026-09-08T14:05:00Z"))).not.toBe(base);
  });
});

describe("decideBgCheck — wire contract", () => {
  it("sends all seven named arguments; the legacy three plus nulls and a derived dedupe key", async () => {
    await decideBgCheck(ID, "Eligible", "  looks fine  ");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("bg_check_decide", {
      p_id: ID,
      p_decision: "Eligible",
      p_notes: "looks fine",
      p_reason_code: null,
      p_explanation: null,
      p_product_program: null,
      p_dedupe_key: `bgcheck:${ID}:Eligible:202609081405`,
    });
  });

  it("keeps the pre-S3-03 behaviour for notes: blank or missing becomes null", async () => {
    await decideBgCheck(ID, "Not found");
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_notes: null });
    await decideBgCheck(ID, "Not found", "   ");
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_notes: null });
  });

  it("forwards the optional arguments when the caller has them, trimmed", async () => {
    await decideBgCheck(ID, "Not Eligible", "no paystub", {
      reasonCode: " DOC_MISSING ",
      explanation: "Paystub not uploaded",
      productProgram: "rentals_rideshare",
      dedupeKey: "bg:abc:req-42",
    });
    expect(rpc).toHaveBeenCalledWith("bg_check_decide", {
      p_id: ID,
      p_decision: "Not Eligible",
      p_notes: "no paystub",
      p_reason_code: "DOC_MISSING",
      p_explanation: "Paystub not uploaded",
      p_product_program: "rentals_rideshare",
      p_dedupe_key: "bg:abc:req-42",
    });
  });

  it("a caller-supplied dedupe key wins over the derived one; a blank one does not", async () => {
    await decideBgCheck(ID, "Eligible", undefined, { dedupeKey: "   " });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_dedupe_key: `bgcheck:${ID}:Eligible:202609081405` });
  });

  it("never invents a reason code: a decision with no code sends null", async () => {
    for (const d of BG_CHECK_DECISIONS) {
      rpc.mockClear();
      await decideBgCheck(ID, d);
      expect(rpc.mock.calls[0][1]).toMatchObject({ p_reason_code: null });
    }
  });

  it("returns the jsonb the function produced, including decision_event_id", async () => {
    const r = await decideBgCheck(ID, "Eligible");
    expect(r).toEqual(OK);
    expect(r.decision_event_id).toBe("e1");
  });
});

describe("decideBgCheck — errors", () => {
  it("rejects a verdict outside the five eligibility states before touching the network", async () => {
    await expect(decideBgCheck(ID, "Approved" as BgCheckDecision)).rejects.toThrow(/must be one of/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces the database's authorization refusal unchanged", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "bg_check_decide: staff or admin only", code: "42501" } });
    await expect(decideBgCheck(ID, "Eligible")).rejects.toThrow("bg_check_decide: staff or admin only");
  });

  it("surfaces the reason-code rule the database enforces once the taxonomy is seeded", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "record_decision_event: reason_code is required for decision Not Eligible once the taxonomy is active" },
    });
    await expect(decideBgCheck(ID, "Not Eligible", "free text")).rejects.toThrow(/reason_code is required/);
  });
});
