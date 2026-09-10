import { describe, it, expect } from "vitest";
import {
  isLiveHttpUrl,
  withUtm,
  ghlOffer,
  tmmtClientUpgradeUrl,
} from "./ghl-offers";

const ALL_OFFER_IDS = [
  "member97", "credit", "llc", "base", "enterprise", "carbox", "ecommerce",
  "ecosystem", "operator", "consult", "aixmode", "opsKit", "commandKit",
  "dealerBundle",
] as const;

describe("ghlOffer", () => {
  it("carries the right campaign tag on every offer", () => {
    expect(ghlOffer("credit")).toContain("utm_campaign=credit-guidance");
    expect(ghlOffer("carbox")).toContain("utm_source=aixmos");
    expect(ghlOffer("opsKit")).toContain("utm_campaign=ops-kit");
    expect(ghlOffer("dealerBundle")).toContain("utm_campaign=dealer-bundle");
  });
  it("keeps an unconfigured offer on TMMT instead of the partner site", () => {
    // With no NEXT_PUBLIC_GHL_CHECKOUT_* set — which is the live state — the
    // fallback used to be the partner's homepage, so all fourteen money
    // buttons gave the buyer away. Every one of them must now stay in-app.
    for (const id of ALL_OFFER_IDS) {
      const url = ghlOffer(id);
      expect(url).not.toContain("allinonemanagementsolutions");
      expect(url.startsWith("/forms/lead-intake?")).toBe(true);
      expect(url).toContain(`offer=${id}`);
    }
  });
  it("uses a configured checkout URL when one exists", () => {
    const prev = process.env.NEXT_PUBLIC_GHL_CHECKOUT_97;
    process.env.NEXT_PUBLIC_GHL_CHECKOUT_97 = "https://pay.example.com/97";
    try {
      const url = ghlOffer("member97");
      expect(url.startsWith("https://pay.example.com/97")).toBe(true);
      expect(url).toContain("utm_campaign=member-97");
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_GHL_CHECKOUT_97;
      else process.env.NEXT_PUBLIC_GHL_CHECKOUT_97 = prev;
    }
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
