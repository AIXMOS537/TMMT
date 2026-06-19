import { describe, it, expect } from "vitest";
import { commissionFor, deriveReferralCode, REFERRAL_RATE } from "@/lib/referrals";

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
