import { describe, it, expect } from "vitest";
import { normalizeHost, isOwnerHubHost, ownerHubOrigin } from "./site-domains";

describe("normalizeHost", () => {
  it("lowercases and strips the port", () => {
    expect(normalizeHost("Example.COM:3000")).toBe("example.com");
    expect(normalizeHost("tmmtrentals.net")).toBe("tmmtrentals.net");
  });
  it("handles null/empty", () => {
    expect(normalizeHost(null)).toBe("");
    expect(normalizeHost("")).toBe("");
  });
});

describe("isOwnerHubHost", () => {
  it("matches the owner hub host, its www, and admin subdomain", () => {
    expect(isOwnerHubHost("tmmtrentals.net")).toBe(true);
    expect(isOwnerHubHost("www.tmmtrentals.net")).toBe(true);
    expect(isOwnerHubHost("admin.tmmtrentals.net")).toBe(true);
    expect(isOwnerHubHost("TMMTRENTALS.NET:443")).toBe(true);
  });
  it("rejects other hosts (no accidental owner-hub access)", () => {
    expect(isOwnerHubHost("tmmt-ops.vercel.app")).toBe(false);
    expect(isOwnerHubHost("evil.com")).toBe(false);
    expect(isOwnerHubHost("nottmmtrentals.net")).toBe(false);
    expect(isOwnerHubHost(null)).toBe(false);
  });
});

describe("ownerHubOrigin", () => {
  it("is an https origin for the hub host", () => {
    expect(ownerHubOrigin()).toBe("https://tmmtrentals.net");
  });
});
