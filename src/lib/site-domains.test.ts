import { describe, it, expect } from "vitest";
import {
  normalizeHost,
  isOwnerHubHost,
  ownerHubOrigin,
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
