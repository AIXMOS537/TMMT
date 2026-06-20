import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  commissionFor,
  deriveReferralCode,
  referralDedupeKey,
  recordCollectedReferral,
  REFERRAL_RATE,
} from "@/lib/referrals";

// Stub: code lookup returns the given owner_email; insert is captured.
function refStub(ownerEmail: string) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const limit = vi.fn().mockResolvedValue({ data: [{ code: "ABC", owner_email: ownerEmail }], error: null });
  const eq = vi.fn().mockReturnValue({ limit });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockImplementation((t: string) =>
    t === "pocket_referral_codes" ? { select } : { insert }
  );
  return { client: { from } as unknown as SupabaseClient, insert };
}

describe("referral commission (collected sales only)", () => {
  it("computes a 2-dp commission at the default rate", () => {
    expect(commissionFor(97)).toBe(Math.round(97 * REFERRAL_RATE * 100) / 100);
  });

  it("honors an explicit rate", () => {
    expect(commissionFor(100, 0.25)).toBe(25);
  });

  it("never pays on zero/negative sales (no guaranteed income)", () => {
    expect(commissionFor(0)).toBe(0);
    expect(commissionFor(-50)).toBe(0);
    expect(commissionFor(Number.NaN)).toBe(0);
  });
});

describe("referral code derivation", () => {
  it("is stable for the same email", () => {
    expect(deriveReferralCode("a@b.com")).toBe(deriveReferralCode("A@B.COM "));
  });

  it("differs for different emails and is short + uppercase", () => {
    const a = deriveReferralCode("alice@x.com");
    const b = deriveReferralCode("bob@x.com");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9A-Z]{6,7}$/);
  });
});

describe("recordCollectedReferral self-dealing guard", () => {
  it("refuses to pay a code on its own owner's purchase", async () => {
    const { client, insert } = refStub("owner@x.com");
    const r = await recordCollectedReferral(client, {
      code: "ABC",
      referredEmail: "OWNER@X.com",
      saleAmount: 97,
    });
    expect(r).toEqual({ recorded: false, reason: "self_referral" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("pays when the buyer is a different person", async () => {
    const { client, insert } = refStub("owner@x.com");
    const r = await recordCollectedReferral(client, {
      code: "ABC",
      referredEmail: "buyer@y.com",
      saleAmount: 97,
    });
    expect(r.recorded).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
  });
});

describe("referralDedupeKey (no double-pay)", () => {
  it("uses the transaction ref when present", () => {
    expect(referralDedupeKey("ABC", "x@y.com", 97, "txn_9")).toBe("ref:txn_9");
  });

  it("synthesizes a stable per-month key when there's no ref (never NULL)", () => {
    const now = new Date("2026-06-18T12:00:00Z");
    const k1 = referralDedupeKey("ABC", "X@Y.com", 97, null, now);
    const k2 = referralDedupeKey("ABC", "x@y.com ", 97, null, now);
    expect(k1).toBe("ref:ABC:x@y.com:97:2026-06");
    expect(k1).toBe(k2); // case/space-insensitive → retries collide → no double-pay
  });

  it("rolls to a fresh key next month so a genuine new sale can record", () => {
    const jun = referralDedupeKey("ABC", "x@y.com", 97, null, new Date("2026-06-30T23:00:00Z"));
    const jul = referralDedupeKey("ABC", "x@y.com", 97, null, new Date("2026-07-01T01:00:00Z"));
    expect(jun).not.toBe(jul);
  });
});
