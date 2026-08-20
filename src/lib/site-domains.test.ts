import { describe, it, expect } from "vitest";
import {
  normalizeHost,
  isOwnerHubHost,
  ownerHubOrigin,
  isTmmtPublicHost,
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
    expect(isTmmtPublicHost("tmmt-command-center.vercel.app")).toBe(true);
    expect(isTmmtPublicHost("tmmtrentals.com")).toBe(true);
  });
  it("leaves AIXMOS and GHL hosts alone", () => {
    expect(isTmmtPublicHost("aixmos-landing.vercel.app")).toBe(false);
    expect(isTmmtPublicHost("allinonemanagementsolutions.com")).toBe(false);
    expect(isTmmtPublicHost("localhost:3000")).toBe(false);
  });
});

describe("aixmosCreditPath", () => {
  it("moves AIXMOS Credit SKUs off TMMT", () => {
    expect(aixmosCreditPath("/lp/moe_legacy/intro-97")).toBe("/forms/academy-join");
    expect(aixmosCreditPath("/lp/aixmos/intro-97")).toBe("/forms/academy-join");
    expect(aixmosCreditPath("/lp/moe_legacy/lead-magnet")).toBe("/lp/playbook");
    expect(aixmosCreditPath("/credit")).toBe("/forms");
    expect(aixmosCreditPath("/funding")).toBe("/forms");
    expect(aixmosCreditPath("/forms/credit-funding-intake")).toBe("/forms/credit-funding-intake");
  });
  it("does not steal rental SKUs", () => {
    expect(aixmosCreditPath("/lp/tmmt_property/rental-in-a-box")).toBeNull();
    expect(aixmosCreditPath("/lp/aixmos/training")).toBeNull();
    expect(aixmosCreditPath("/dealers")).toBeNull();
    expect(aixmosCreditPath("/kits")).toBeNull();
  });
  it("points the redirect at the AIXMOS public origin", () => {
    expect(aixmosCreditRedirectUrl("/lp/moe_legacy/intro-97")).toBe(
      "https://aixmos-landing.vercel.app/forms/academy-join",
    );
  });
});

describe("isAixmosCorsOrigin", () => {
  it("allows the AIXMOS site to post leads", () => {
    expect(isAixmosCorsOrigin("https://aixmos-landing.vercel.app")).toBe(true);
    expect(isAixmosCorsOrigin("https://allinonemanagementsolutions.com")).toBe(
      true,
    );
  });
  it("rejects random origins", () => {
    expect(isAixmosCorsOrigin("https://evil.com")).toBe(false);
    expect(isAixmosCorsOrigin(null)).toBe(false);
  });
});
