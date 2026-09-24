import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bearerMatchesEdge, timingSafeEqualUtf8 } from "./secure-compare-edge";

describe("timingSafeEqualUtf8", () => {
  it("is true only for identical strings", () => {
    expect(timingSafeEqualUtf8("abc", "abc")).toBe(true);
    expect(timingSafeEqualUtf8("abc", "abd")).toBe(false);
    expect(timingSafeEqualUtf8("", "")).toBe(true);
  });
  it("treats a prefix or extension as unequal (length folded in)", () => {
    expect(timingSafeEqualUtf8("abc", "abcd")).toBe(false);
    expect(timingSafeEqualUtf8("abcd", "abc")).toBe(false);
    expect(timingSafeEqualUtf8("", "a")).toBe(false);
    expect(timingSafeEqualUtf8("a\0", "a")).toBe(false);
  });
  it("compares UTF-8 bytes, so multibyte input is safe", () => {
    expect(timingSafeEqualUtf8("héllo", "héllo")).toBe(true);
    expect(timingSafeEqualUtf8("héllo", "hello")).toBe(false);
  });
});

describe("bearerMatchesEdge", () => {
  it("matches exactly Bearer <secret>", () => {
    expect(bearerMatchesEdge("Bearer s3cret-long-enough", "s3cret-long-enough")).toBe(true);
  });
  it("fails closed on unset secret, missing header, empty token, wrong scheme", () => {
    expect(bearerMatchesEdge("Bearer x", undefined)).toBe(false);
    expect(bearerMatchesEdge("Bearer ", "")).toBe(false);
    expect(bearerMatchesEdge(null, "s")).toBe(false);
    expect(bearerMatchesEdge("Bearer ", "s")).toBe(false);
    expect(bearerMatchesEdge("s", "s")).toBe(false);
    expect(bearerMatchesEdge("Basic s", "s")).toBe(false);
  });
});

describe("edge-safety", () => {
  it("imports nothing from node: (the Edge middleware must be able to load it)", () => {
    const src = readFileSync(join(process.cwd(), "src", "lib", "secure-compare-edge.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["']node:/);
    expect(src).not.toMatch(/require\(/);
  });
});
