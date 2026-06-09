import { describe, it, expect } from "vitest";
import { checkoutHref } from "./kit-checkout";

describe("checkoutHref", () => {
  it("returns a real URL unchanged", () => {
    expect(checkoutHref("https://link.gohighlevel.com/abc")).toBe("https://link.gohighlevel.com/abc");
  });
  it("falls back to the pending sentinel for empty/whitespace (no dead button)", () => {
    expect(checkoutHref("")).toBe("#checkout-pending");
    expect(checkoutHref("   ")).toBe("#checkout-pending");
  });
  it("honors a custom fallback", () => {
    expect(checkoutHref("", "/contact")).toBe("/contact");
  });
});
