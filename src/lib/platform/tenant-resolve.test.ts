import { describe, it, expect } from "vitest";
import {
  canonicalSlug,
  normalizeHost,
  resolveTenant,
  resolveTenantByHost,
  resolveTenantByPath,
  resolveTenantBySlug,
  tenantOrDefault,
  DEFAULT_TENANT_SLUG,
  OPS_FALLBACK_SLUG,
} from "./tenant-resolve";

describe("normalizeHost", () => {
  it("strips scheme, port, path, and case", () => {
    expect(normalizeHost("https://TMMTRentals.com:3000/lp/x")).toBe("tmmtrentals.com");
  });
  it("tolerates missing input", () => {
    expect(normalizeHost(null)).toBe("");
    expect(normalizeHost(undefined)).toBe("");
  });
});

describe("canonicalSlug", () => {
  it("passes through canonical slugs", () => {
    expect(canonicalSlug("tmmt_property")).toBe("tmmt_property");
  });
  it("maps aliases to the canonical slug", () => {
    expect(canonicalSlug("tmmt")).toBe("tmmt_property");
    expect(canonicalSlug("moe-legacy")).toBe("moe_legacy");
    expect(canonicalSlug("aixmos537")).toBe("aixmos");
  });
  it("returns undefined for unknown or empty input", () => {
    expect(canonicalSlug("redhood")).toBeUndefined();
    expect(canonicalSlug("")).toBeUndefined();
  });
});

describe("resolveTenantBySlug", () => {
  it("returns the brand for a slug or alias", () => {
    expect(resolveTenantBySlug("moe_legacy")?.displayName).toBe("AIXMOS Credit");
    expect(resolveTenantBySlug("tmmt")?.id).toBe("tmmt");
  });
  it("returns undefined rather than guessing", () => {
    expect(resolveTenantBySlug("not-a-client")).toBeUndefined();
  });
});

describe("resolveTenantByHost", () => {
  it("matches a configured domain", () => {
    expect(resolveTenantByHost("tmmtrentals.com")?.slug).toBe("tmmt_property");
    expect(resolveTenantByHost("tmmt-ops.vercel.app:443")?.slug).toBe("tmmt_property");
  });
  it("treats a leading label as a tenant", () => {
    expect(resolveTenantByHost("tmmt.example.com")?.slug).toBe("tmmt_property");
  });
  it("ignores infrastructure labels", () => {
    expect(resolveTenantByHost("www.some-other-site.com")).toBeUndefined();
  });
});

describe("resolveTenantByPath", () => {
  it("reads the org segment of a landing page path", () => {
    expect(resolveTenantByPath("/lp/moe_legacy/intro-97")?.slug).toBe("moe_legacy");
  });
  it("ignores unrelated paths", () => {
    expect(resolveTenantByPath("/command/dispatch")).toBeUndefined();
  });
});

describe("tenantOrDefault", () => {
  it("honours an explicit fallback for unknown input", () => {
    expect(tenantOrDefault("nope", "tmmt_property").slug).toBe("tmmt_property");
  });
  it("falls back to the platform tenant with no hint", () => {
    expect(tenantOrDefault(undefined).slug).toBe(DEFAULT_TENANT_SLUG);
  });
});

describe("resolveTenant", () => {
  it("prefers an explicit slug over the host", () => {
    expect(resolveTenant({ slug: "moe_legacy", host: "tmmtrentals.com" }).slug).toBe("moe_legacy");
  });
  it("honours x-forwarded-host when host is the proxy", () => {
    expect(
      resolveTenant({ host: "localhost", forwardedHost: "tmmtrentals.com" }).slug,
    ).toBe("tmmt_property");
  });
  it("always returns a brand", () => {
    expect(resolveTenant({}).slug).toBe(DEFAULT_TENANT_SLUG);
  });
  it("keeps the ops product as TMMT when asked", () => {
    expect(resolveTenant({ fallbackSlug: OPS_FALLBACK_SLUG }).slug).toBe("tmmt_property");
    expect(
      resolveTenant({ slug: "ghost", host: "localhost", fallbackSlug: OPS_FALLBACK_SLUG }).slug,
    ).toBe("tmmt_property");
  });
});
