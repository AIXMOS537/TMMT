import { describe, it, expect } from "vitest";
import {
  normalizeHost,
  isOwnerHubHost,
  ownerHubOrigin,
  isTmmtPublicHost,
  shouldBounceTmmtCreditToAixmos,
  aixmosCreditPath,
  aixmosCreditRedirectUrl,
  isAixmosCorsOrigin,
} from "./site-domains";

describe("normalizeHost", () => {
  it("lowercases and strips the port", () => {
    expect(normalizeHost("Example.COM:3000")).toBe("example.com");
    expect(normalizeHost("ops.allinonemanagementsolutions.com")).toBe(
      "ops.allinonemanagementsolutions.com",
    );
  });
  it("handles null/empty", () => {
    expect(normalizeHost(null)).toBe("");
    expect(normalizeHost("")).toBe("");
  });
});

describe("isOwnerHubHost", () => {
  it("matches the ops hub host, its www, and admin.ops", () => {
    expect(isOwnerHubHost("ops.allinonemanagementsolutions.com")).toBe(true);
    expect(isOwnerHubHost("www.ops.allinonemanagementsolutions.com")).toBe(
      true,
    );
    expect(isOwnerHubHost("admin.ops.allinonemanagementsolutions.com")).toBe(
      true,
    );
    expect(
      isOwnerHubHost("OPS.ALLINONEMANAGEMENTSOLUTIONS.COM:443"),
    ).toBe(true);
  });
  it("still matches the dead tmmtrentals.net aliases so old bookmarks do not crash", () => {
    expect(isOwnerHubHost("tmmtrentals.net")).toBe(true);
    expect(isOwnerHubHost("www.tmmtrentals.net")).toBe(true);
    expect(isOwnerHubHost("admin.tmmtrentals.net")).toBe(true);
  });
  it("rejects GHL public hosts so we never steal marketing DNS", () => {
    expect(isOwnerHubHost("allinonemanagementsolutions.com")).toBe(false);
    expect(isOwnerHubHost("www.allinonemanagementsolutions.com")).toBe(false);
    expect(isOwnerHubHost("allinonemanagementsolutions.net")).toBe(false);
    expect(isOwnerHubHost("app.allinonemanagementsolutions.com")).toBe(false);
  });
  it("rejects other hosts (no accidental owner-hub access)", () => {
    expect(isOwnerHubHost("tmmt-ops.vercel.app")).toBe(false);
    expect(isOwnerHubHost("evil.com")).toBe(false);
    expect(isOwnerHubHost(null)).toBe(false);
  });
});

describe("ownerHubOrigin", () => {
  it("is an https origin for the ops hub host", () => {
    expect(ownerHubOrigin()).toBe(
      "https://ops.allinonemanagementsolutions.com",
    );
  });
});

describe("isTmmtPublicHost", () => {
  it("matches rental/ops public hosts", () => {
    expect(isTmmtPublicHost("tmmt-ops.vercel.app")).toBe(true);
    expect(isTmmtPublicHost("tmmtrentals.com")).toBe(true);
  });
  it("leaves the retired landing and the GHL hosts alone", () => {
    expect(isTmmtPublicHost("aixmos-landing.vercel.app")).toBe(false);
    expect(isTmmtPublicHost("tmmt-command-center.vercel.app")).toBe(false);
    expect(isTmmtPublicHost("allinonemanagementsolutions.com")).toBe(false);
    expect(isTmmtPublicHost("localhost:3000")).toBe(false);
  });
});

describe("shouldBounceTmmtCreditToAixmos", () => {
  it("bounces a person who typed a TMMT credit URL", () => {
    expect(shouldBounceTmmtCreditToAixmos("tmmt-ops.vercel.app", "tmmt-ops.vercel.app")).toBe(true);
    expect(shouldBounceTmmtCreditToAixmos("tmmt-ops.vercel.app", null)).toBe(true);
  });
  it("does not bounce when the public GHL site proxied the request here", () => {
    expect(
      shouldBounceTmmtCreditToAixmos("tmmt-ops.vercel.app", "allinonemanagementsolutions.com"),
    ).toBe(false);
  });
});

describe("aixmosCreditPath", () => {
  const utm = (c: string) => `/?utm_source=tmmt-ops&utm_medium=redirect&utm_campaign=${c}`;
  it("sends marketing entry points to the GHL public site", () => {
    expect(aixmosCreditPath("/lp/moe_legacy/intro-97")).toBe(utm("credit-guidance"));
    expect(aixmosCreditPath("/lp/aixmos/intro-97")).toBe(utm("credit-guidance"));
    expect(aixmosCreditPath("/lp/moe_legacy/lead-magnet")).toBe(utm("playbook"));
    expect(aixmosCreditPath("/credit")).toBe(utm("credit"));
    expect(aixmosCreditPath("/funding")).toBe(utm("credit"));
  });
  it("keeps the intake forms on the one app (GHL links to them)", () => {
    expect(aixmosCreditPath("/forms/credit-funding-intake")).toBeNull();
    expect(aixmosCreditPath("/forms/academy-join")).toBeNull();
    expect(aixmosCreditPath("/forms/apply")).toBeNull();
  });
  it("does not steal rental SKUs", () => {
    expect(aixmosCreditPath("/lp/tmmt_property/rental-in-a-box")).toBeNull();
    expect(aixmosCreditPath("/lp/aixmos/training")).toBeNull();
    expect(aixmosCreditPath("/dealers")).toBeNull();
    expect(aixmosCreditPath("/kits")).toBeNull();
  });
  it("points the redirect at the GHL public site", () => {
    expect(aixmosCreditRedirectUrl("/lp/moe_legacy/intro-97")).toBe(
      "https://allinonemanagementsolutions.com" + utm("credit-guidance"),
    );
    expect(aixmosCreditRedirectUrl("/forms/apply")).toBeNull();
  });
});

describe("isAixmosCorsOrigin", () => {
  it("allows the GHL public site (.com and .net) to post leads", () => {
    expect(isAixmosCorsOrigin("https://allinonemanagementsolutions.com")).toBe(true);
    expect(isAixmosCorsOrigin("https://www.allinonemanagementsolutions.net")).toBe(true);
  });
  it("no longer trusts the retired landing origin", () => {
    expect(isAixmosCorsOrigin("https://aixmos-landing.vercel.app")).toBe(false);
  });
  it("rejects random origins", () => {
    expect(isAixmosCorsOrigin("https://evil.com")).toBe(false);
    expect(isAixmosCorsOrigin(null)).toBe(false);
  });
});
