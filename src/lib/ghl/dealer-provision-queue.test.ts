import { describe, it, expect } from "vitest";
import { dealerSkuFromTags, dealerProvisionCommand } from "./dealer-provision-queue";

describe("dealerSkuFromTags", () => {
  it("maps dealer bundle purchase", () => {
    expect(dealerSkuFromTags(["dealer-prospect", "kit-ordered-dealer-bundle"])).toBe("dealer");
  });
  it("maps ops kit purchase", () => {
    expect(dealerSkuFromTags(["kit-ordered-ops-kit"])).toBe("ops");
    expect(dealerSkuFromTags(["kit-ordered-ops"])).toBe("ops");
  });
  it("ignores prospect-only tags", () => {
    expect(dealerSkuFromTags(["dealer-prospect", "member-97"])).toBeNull();
  });
});

describe("dealerProvisionCommand", () => {
  it("prints a dry-run army command", () => {
    expect(dealerProvisionCommand("dealer", "Joe's Auto", "gm@lot.com")).toContain("--sku dealer");
    expect(dealerProvisionCommand("dealer", "Joe's Auto", "gm@lot.com")).toContain("--dry-run");
  });
});
