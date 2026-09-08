import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { timingSafeEqualString, secretMatches, bearerMatches } from "./secure-compare";

describe("timingSafeEqualString", () => {
  it("is true only for identical strings", () => {
    expect(timingSafeEqualString("abc", "abc")).toBe(true);
    expect(timingSafeEqualString("abc", "abd")).toBe(false);
  });
  it("does not throw and returns false on length mismatch", () => {
    expect(timingSafeEqualString("abc", "abcd")).toBe(false);
    expect(timingSafeEqualString("", "a")).toBe(false);
    expect(timingSafeEqualString("", "")).toBe(true);
  });
  it("compares bytes, not code points, so multibyte input is safe", () => {
    expect(timingSafeEqualString("héllo", "héllo")).toBe(true);
    expect(timingSafeEqualString("héllo", "hello")).toBe(false);
  });
});

describe("secretMatches", () => {
  it("fails closed when the configured secret is missing", () => {
    expect(secretMatches("x", undefined)).toBe(false);
    expect(secretMatches("x", "")).toBe(false);
  });
  it("fails closed when the header is missing", () => {
    expect(secretMatches(null, "s3cret")).toBe(false);
    expect(secretMatches(undefined, "s3cret")).toBe(false);
  });
  it("matches an exact secret and nothing else", () => {
    expect(secretMatches("s3cret", "s3cret")).toBe(true);
    expect(secretMatches("s3cret ", "s3cret")).toBe(false);
    expect(secretMatches("S3CRET", "s3cret")).toBe(false);
  });
});

describe("bearerMatches", () => {
  it("requires the Bearer prefix", () => {
    expect(bearerMatches("s3cret", "s3cret")).toBe(false);
    expect(bearerMatches("Basic s3cret", "s3cret")).toBe(false);
  });
  it("matches Bearer <secret>, tolerating surrounding whitespace on the token", () => {
    expect(bearerMatches("Bearer s3cret", "s3cret")).toBe(true);
    expect(bearerMatches("Bearer  s3cret ", "s3cret")).toBe(true);
    expect(bearerMatches("Bearer s3cre", "s3cret")).toBe(false);
  });
  it("fails closed on a missing header or secret", () => {
    expect(bearerMatches(null, "s3cret")).toBe(false);
    expect(bearerMatches("Bearer s3cret", "")).toBe(false);
  });
});

/**
 * ENFORCEMENT: no API route may compare a request header to a secret with
 * `===` / `!==`. That is how six routes leaked comparison timing before
 * remediation F-07. Anything under src/app/api that reads a header and then
 * compares it directly fails here; use secretMatches / bearerMatches instead.
 */
describe("no plain-equality secret comparison in API routes", () => {
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) out.push(...walk(p));
      else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
    }
    return out;
  }
  const API = join(process.cwd(), "src", "app", "api");
  // `headers.get("...") === x`, `headers.get("...") !== x`, and the reversed forms.
  const direct =
    /headers\.get\([^)]*\)\s*(===|!==)|(===|!==)\s*(?:req|request)\.headers\.get\(|(===|!==)\s*`Bearer \$\{/;

  it("every header-vs-secret comparison under src/app/api is constant-time", () => {
    const offenders = walk(API)
      .filter((f) => direct.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(process.cwd(), "").replace(/\\/g, "/"));
    expect(offenders, `plain-equality secret compare in: ${offenders.join(", ")}`).toEqual([]);
  });
});
