import { describe, it, expect } from "vitest";
import { checkoutHref } from "./kit-checkout";

describe("checkoutHref", () => {
  it("returns a real URL unchanged", () => {
    expect(checkoutHref("https://link.gohighlevel.com/abc")).toBe("https://link.gohighlevel.com/abc");
  });
  it("falls back to TMMT's own lead form, not the partner site (no dead button)", () => {
    const url = checkoutHref("");
    expect(url).not.toContain("allinonemanagementsolutions");
    expect(url.startsWith("/forms/lead-intake?")).toBe(true);
    expect(url).toContain("utm_source=kits-page");
    expect(url).toContain("utm_campaign=member-97");
  });
  it("tags dealer-bundle interest and keeps the lead on TMMT", () => {
    const url = checkoutHref("", "dealer-bundle");
    expect(url).not.toContain("allinonemanagementsolutions");
    expect(url.startsWith("/forms/lead-intake?")).toBe(true);
    expect(url).toContain("utm_campaign=dealer-bundle");
    expect(url).toContain("utm_content=dealer-bundle");
  });
});
