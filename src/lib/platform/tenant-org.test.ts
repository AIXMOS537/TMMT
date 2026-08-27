import { describe, it, expect } from "vitest";
import {
  orgIdForHostStatic,
  orgIdForTenantSlug,
  isHouseOrgId,
  HOUSE_ORG_IDS,
  ORG_HEADER,
  HOST_HEADER,
} from "./tenant-org";

describe("orgIdForTenantSlug", () => {
  it("maps every slug and alias the brand map can hand back", () => {
    for (const s of ["tmmt", "tmmt_property", "tmmt-rentals"]) {
      expect(orgIdForTenantSlug(s)).toBe(HOUSE_ORG_IDS.tmmt);
    }
    for (const s of ["aixmos", "aixmos537"]) {
      expect(orgIdForTenantSlug(s)).toBe(HOUSE_ORG_IDS.aixmos);
    }
  });

  it("is case and whitespace insensitive", () => {
    expect(orgIdForTenantSlug("  TMMT_Property ")).toBe(HOUSE_ORG_IDS.tmmt);
  });

  it("returns undefined for a non-house tenant rather than guessing", () => {
    // moe-legacy has an organizations row but is not a house org: it must go
    // through the database like any other tenant.
    expect(orgIdForTenantSlug("moe-legacy")).toBeUndefined();
    expect(orgIdForTenantSlug("")).toBeUndefined();
    expect(orgIdForTenantSlug(null)).toBeUndefined();
    expect(orgIdForTenantSlug(undefined)).toBeUndefined();
  });
});

describe("orgIdForHostStatic", () => {
  it("resolves a house host without touching the database", () => {
    expect(orgIdForHostStatic("tmmt.example.com")).toBe(HOUSE_ORG_IDS.tmmt);
    expect(orgIdForHostStatic("aixmos.example.com")).toBe(HOUSE_ORG_IDS.aixmos);
  });

  it("tolerates ports, protocol and casing", () => {
    expect(orgIdForHostStatic("https://TMMT.example.com:3000")).toBe(HOUSE_ORG_IDS.tmmt);
  });

  it("returns undefined for an unknown host — the cue to ask the database", () => {
    // An operator's own domain lives in organization_domains, not here. Static
    // resolution admitting ignorance is what makes the DB fallback correct.
    expect(orgIdForHostStatic("joes-auto.com")).toBeUndefined();
    expect(orgIdForHostStatic("")).toBeUndefined();
    expect(orgIdForHostStatic(null)).toBeUndefined();
  });

  it("does not treat infrastructure subdomains as tenants", () => {
    // www/app/api/admin/staging/preview are excluded by tenant-resolve, so they
    // must not resolve to an org either.
    for (const h of ["www.example.com", "app.example.com", "api.example.com"]) {
      expect(orgIdForHostStatic(h)).toBeUndefined();
    }
  });
});

describe("isHouseOrgId", () => {
  it("recognises exactly the two house orgs", () => {
    expect(isHouseOrgId(HOUSE_ORG_IDS.tmmt)).toBe(true);
    expect(isHouseOrgId(HOUSE_ORG_IDS.aixmos)).toBe(true);
    expect(isHouseOrgId("370cd891-f6c0-4fcc-a36a-bc25f27ca229")).toBe(false);
    expect(isHouseOrgId(null)).toBe(false);
  });
});

describe("header names", () => {
  it("are distinct and lowercase", () => {
    // Header names are compared case-insensitively by Headers, but keeping them
    // lowercase avoids surprises when they are used as plain object keys.
    expect(ORG_HEADER).toBe(ORG_HEADER.toLowerCase());
    expect(HOST_HEADER).toBe(HOST_HEADER.toLowerCase());
    expect(ORG_HEADER).not.toBe(HOST_HEADER);
  });
});
