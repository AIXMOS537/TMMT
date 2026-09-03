import { describe, it, expect } from "vitest";
import { formsForSite, isAixmosOnlyPath, PUBLIC_FORMS } from "./catalog";
import { siteFromHost } from "./site";

describe("forms catalog", () => {
  it("gives TMMT a short rental set and AIXMOS the full set", () => {
    const tmmt = formsForSite("tmmt");
    const aixmos = formsForSite("aixmos");
    expect(tmmt.length).toBeGreaterThanOrEqual(5);
    expect(aixmos.length).toBeGreaterThan(tmmt.length);
    expect(tmmt.every((f) => f.sites.includes("tmmt"))).toBe(true);
    expect(aixmos.find((f) => f.slug === "sovereign")).toBeTruthy();
    expect(tmmt.find((f) => f.slug === "sovereign")).toBeUndefined();
    expect(tmmt.find((f) => f.slug === "credit-funding-intake")).toBeUndefined();
  });

  it("every form has cost, time, and what", () => {
    for (const f of PUBLIC_FORMS) {
      expect(f.cost.length).toBeGreaterThan(0);
      expect(f.time.length).toBeGreaterThan(0);
      expect(f.what.length).toBeGreaterThan(0);
    }
  });

  it("keeps credit and academy on AIXMOS only", () => {
    expect(isAixmosOnlyPath("/forms/credit-funding-intake")).toBe(true);
    expect(isAixmosOnlyPath("/forms/lead-intake")).toBe(false);
  });
});

describe("siteFromHost", () => {
  it("treats the GHL public site as AIXMOS even when forwarded", () => {
    expect(siteFromHost("tmmt-ops.vercel.app", "allinonemanagementsolutions.com")).toBe("aixmos");
    expect(siteFromHost("www.allinonemanagementsolutions.net")).toBe("aixmos");
    expect(siteFromHost("tmmt-ops.vercel.app")).toBe("tmmt");
  });
});
