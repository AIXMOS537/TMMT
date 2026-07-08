import { describe, it, expect } from "vitest";
import { checkoutHref } from "./kit-checkout";

describe("checkoutHref", () => {
  it("returns a real URL unchanged", () => {
    expect(checkoutHref("https://link.gohighlevel.com/abc")).toBe("https://link.gohighlevel.com/abc");
  });
  it("falls back to lead intake when checkout URL unset (no dead button)", () => {
    expect(checkoutHref("")).toBe("/forms/lead-intake?utm_source=kits-page");
    expect(checkoutHref("   ")).toBe("/forms/lead-intake?utm_source=kits-page");
  });
  it("tags kit interest in utm_campaign when kit id provided", () => {
    expect(checkoutHref("", "dealer-bundle")).toBe(
      "/forms/lead-intake?utm_source=kits-page&utm_campaign=kit-dealer-bundle"
    );
  });
});
