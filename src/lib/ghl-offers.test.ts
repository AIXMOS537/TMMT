import { describe, it, expect } from "vitest";
import {
  GHL_PUBLIC_SITE,
  isLiveHttpUrl,
  withUtm,
  ghlOffer,
  tmmtClientUpgradeUrl,
} from "./ghl-offers";

describe("ghlOffer", () => {
  it("always returns a live GHL http(s) URL", () => {
    expect(ghlOffer("member97")).toMatch(/^https:\/\//);
    expect(ghlOffer("credit")).toContain("utm_campaign=credit-guidance");
    expect(ghlOffer("carbox")).toContain("utm_source=aixmos");
    expect(ghlOffer("opsKit")).toContain("utm_campaign=ops-kit");
    expect(ghlOffer("dealerBundle")).toContain("utm_campaign=dealer-bundle");
  });
  it("falls back to the All In One Management GHL site when env is empty", () => {
    expect(ghlOffer("member97").startsWith(GHL_PUBLIC_SITE)).toBe(true);
  });
  it("tags existing TMMT clients so GHL can promote them", () => {
    const url = tmmtClientUpgradeUrl("member97");
    expect(url).toContain("utm_source=tmmt");
    expect(url).toContain("utm_medium=client-upgrade");
    expect(url).toContain("utm_campaign=member-97");
    expect(url).toContain("utm_content=existing-client");
  });
});

describe("withUtm / isLiveHttpUrl", () => {
  it("keeps an existing checkout host and adds campaign", () => {
    const out = withUtm("https://link.gohighlevel.com/widget/form/abc", {
      utm_campaign: "member-97",
      utm_source: "tmmt",
    });
    expect(out).toContain("link.gohighlevel.com");
    expect(out).toContain("utm_campaign=member-97");
    expect(out).toContain("utm_source=tmmt");
  });
  it("rejects sentinels", () => {
    expect(isLiveHttpUrl("")).toBe(false);
    expect(isLiveHttpUrl("YOUR_GHL_97_CHECKOUT_LINK")).toBe(false);
    expect(isLiveHttpUrl("#checkout")).toBe(false);
  });
});
