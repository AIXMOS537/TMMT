import { describe, it, expect } from "vitest";
import {
  evaluateSmsCompliance,
  isRestrictedVertical,
  SMS_RESTRICTED_VERTICALS,
} from "./sms-compliance-gate";

describe("evaluateSmsCompliance", () => {
  it("BLOCKs marketing on credit_repair", () => {
    expect(evaluateSmsCompliance({ vertical: "credit_repair", messageType: "marketing" }).decision).toBe("BLOCK");
  });

  it("BLOCKs marketing on funding", () => {
    expect(evaluateSmsCompliance({ vertical: "funding", messageType: "marketing" }).decision).toBe("BLOCK");
  });

  it("BLOCKs marketing on debt_relief and lending", () => {
    expect(evaluateSmsCompliance({ vertical: "debt_relief", messageType: "marketing" }).decision).toBe("BLOCK");
    expect(evaluateSmsCompliance({ vertical: "lending", messageType: "marketing" }).decision).toBe("BLOCK");
  });

  it("BLOCKs marketing on the moe-legacy slug (normalized to funding)", () => {
    expect(evaluateSmsCompliance({ vertical: "moe-legacy", messageType: "marketing" }).decision).toBe("BLOCK");
  });

  it("ALLOWs transactional on a restricted vertical", () => {
    expect(evaluateSmsCompliance({ vertical: "credit_repair", messageType: "transactional" }).decision).toBe("ALLOW");
  });

  it("defaults missing messageType to transactional (ALLOW on restricted)", () => {
    expect(evaluateSmsCompliance({ vertical: "funding" }).decision).toBe("ALLOW");
  });

  it("ALLOWs marketing on an unrestricted vertical (rentals) once approved", () => {
    const r = evaluateSmsCompliance({
      vertical: "tmmt-rentals",
      messageType: "marketing",
      requiresOwnerApproval: true,
      ownerApproved: true,
    });
    expect(r.decision).toBe("ALLOW");
  });

  it("HOLDs an unrestricted action awaiting owner approval", () => {
    const r = evaluateSmsCompliance({
      vertical: "tmmt-rentals",
      messageType: "marketing",
      requiresOwnerApproval: true,
      ownerApproved: false,
    });
    expect(r.decision).toBe("HOLD");
  });

  it("BLOCK takes precedence over a pending approval on restricted+marketing", () => {
    const r = evaluateSmsCompliance({
      vertical: "funding",
      messageType: "marketing",
      requiresOwnerApproval: true,
      ownerApproved: false,
    });
    expect(r.decision).toBe("BLOCK");
  });

  it("ALLOWs when no vertical is supplied", () => {
    expect(evaluateSmsCompliance({ messageType: "marketing" }).decision).toBe("ALLOW");
  });
});

describe("isRestrictedVertical", () => {
  it("matches every configured restricted category", () => {
    for (const v of SMS_RESTRICTED_VERTICALS) expect(isRestrictedVertical(v)).toBe(true);
  });
  it("matches mapped slugs case-insensitively", () => {
    expect(isRestrictedVertical("MOE-LEGACY")).toBe(true);
  });
  it("does not match unrestricted verticals or empty input", () => {
    expect(isRestrictedVertical("tmmt-rentals")).toBe(false);
    expect(isRestrictedVertical("")).toBe(false);
    expect(isRestrictedVertical(null)).toBe(false);
  });
});
