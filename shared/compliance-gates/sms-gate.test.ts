import { describe, it, expect } from "vitest";
import {
  evaluateSms,
  assertSmsAllowed,
  isRestrictedVertical,
  SmsBlockedError,
} from "./sms-gate";

describe("SMS Compliance Gate (specs/compliance-sms-gate.md)", () => {
  it("BLOCKS marketing for credit_repair", () => {
    expect(evaluateSms({ vertical: "credit_repair", type: "marketing" }).decision).toBe("BLOCK");
  });

  it("BLOCKS marketing for funding", () => {
    expect(evaluateSms({ vertical: "funding", type: "marketing" }).decision).toBe("BLOCK");
  });

  it("BLOCKS marketing for debt_relief and lending too", () => {
    expect(evaluateSms({ vertical: "debt_relief", type: "marketing" }).decision).toBe("BLOCK");
    expect(evaluateSms({ vertical: "lending", type: "marketing" }).decision).toBe("BLOCK");
  });

  it("BLOCKS restricted marketing even when owner_approved (hard lock)", () => {
    expect(
      evaluateSms({ vertical: "credit_repair", type: "marketing", owner_approved: true }).decision
    ).toBe("BLOCK");
  });

  it("ALLOWS transactional for credit_repair (transactional-only is permitted)", () => {
    expect(evaluateSms({ vertical: "credit_repair", type: "transactional" }).decision).toBe("ALLOW");
  });

  it("HOLDS marketing for rentals until owner approval, then ALLOWS", () => {
    expect(evaluateSms({ vertical: "rentals", type: "marketing" }).decision).toBe("HOLD");
    expect(
      evaluateSms({ vertical: "rentals", type: "marketing", owner_approved: true }).decision
    ).toBe("ALLOW");
  });

  it("ALLOWS transactional for non-restricted verticals without approval", () => {
    expect(evaluateSms({ vertical: "rentals", type: "transactional" }).decision).toBe("ALLOW");
  });

  it("knows the restricted verticals from config (not hardcoded)", () => {
    for (const v of ["credit_repair", "funding", "debt_relief", "lending"]) {
      expect(isRestrictedVertical(v)).toBe(true);
    }
    expect(isRestrictedVertical("rentals")).toBe(false);
  });

  it("assertSmsAllowed throws SmsBlockedError on a blocked send", () => {
    expect(() => assertSmsAllowed({ vertical: "funding", type: "marketing" })).toThrow(SmsBlockedError);
  });

  it("assertSmsAllowed returns HOLD (does not throw) for pending approval", () => {
    expect(assertSmsAllowed({ vertical: "rentals", type: "marketing" }).decision).toBe("HOLD");
  });
});
