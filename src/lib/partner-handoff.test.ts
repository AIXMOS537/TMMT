import { describe, it, expect } from "vitest";
import {
  PARTNER_SITE_ORIGIN,
  PARTNER_OPT_IN_PATH,
  partnerHandoffUrl,
  tmmtOfferFallbackPath,
} from "./partner-handoff";

/**
 * These are the guard tests for the leak this module replaced: four separate
 * rules used to send TMMT visitors to the partner site with no consent at all.
 * A test that only asserted the happy path would not have caught any of them,
 * so the refusals are asserted first and hardest.
 */
describe("partnerHandoffUrl refuses without consent", () => {
  it("returns null when the person did not opt in", () => {
    expect(partnerHandoffUrl({ optedIn: false })).toBeNull();
    expect(partnerHandoffUrl({ optedIn: false, interest: "credit" })).toBeNull();
  });

  it("returns null for a missing or malformed consent object", () => {
    // Values that a careless caller could produce. Each must fail closed.
    for (const bad of [undefined, null, {}, { optedIn: "yes" }, { optedIn: 1 }]) {
      expect(
        partnerHandoffUrl(bad as unknown as Parameters<typeof partnerHandoffUrl>[0]),
      ).toBeNull();
    }
  });
});

describe("partnerHandoffUrl with consent", () => {
  it("builds a tagged partner URL only when opted in", () => {
    const url = partnerHandoffUrl({ optedIn: true, formId: "f1", interest: "funding" });
    expect(url).not.toBeNull();
    const u = new URL(url!);
    expect(u.origin).toBe(new URL(PARTNER_SITE_ORIGIN).origin);
    expect(u.searchParams.get("utm_source")).toBe("tmmt-os");
    expect(u.searchParams.get("utm_medium")).toBe("opt-in-referral");
    expect(u.searchParams.get("utm_campaign")).toBe("funding");
    expect(u.searchParams.get("utm_content")).toBe("f1");
  });
});

describe("tmmtOfferFallbackPath", () => {
  it("keeps an unconfigured offer on TMMT, never on the partner site", () => {
    const path = tmmtOfferFallbackPath("member97");
    expect(path.startsWith("/forms/lead-intake?")).toBe(true);
    expect(path).not.toContain("allinonemanagementsolutions");
    expect(path).not.toContain("http");
  });

  it("carries the offer id so the lead is attributable", () => {
    expect(tmmtOfferFallbackPath("carbox")).toContain("offer=carbox");
    expect(tmmtOfferFallbackPath("credit", "pocket-climb")).toContain(
      "utm_content=pocket-climb",
    );
  });
});

describe("the opt-in page is the only advertised door out", () => {
  it("is an in-app path", () => {
    expect(PARTNER_OPT_IN_PATH).toBe("/partners/all-in-one");
  });
});
