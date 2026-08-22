import { describe, it, expect } from "vitest";
import { checkoutHref } from "./kit-checkout";
import { GHL_PUBLIC_SITE } from "./ghl-offers";

describe("checkoutHref", () => {
  it("returns a real URL unchanged", () => {
    expect(checkoutHref("https://link.gohighlevel.com/abc")).toBe("https://link.gohighlevel.com/abc");
  });
  it("falls back to the live GHL site when checkout URL unset (no dead button)", () => {
    const url = checkoutHref("");
    expect(url.startsWith(GHL_PUBLIC_SITE)).toBe(true);
    expect(url).toContain("utm_source=kits-page");
    expect(url).toContain("utm_campaign=member-97");
  });
  it("tags dealer-bundle interest on the GHL campaign", () => {
    const url = checkoutHref("", "dealer-bundle");
    expect(url.startsWith(GHL_PUBLIC_SITE)).toBe(true);
    expect(url).toContain("utm_campaign=dealer-bundle");
    expect(url).toContain("utm_content=dealer-bundle");
  });
});
