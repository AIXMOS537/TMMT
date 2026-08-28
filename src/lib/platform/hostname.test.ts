import { describe, it, expect } from "vitest";
import {
  normalizeHostname,
  checkHostname,
  dnsInstruction,
  answerPointsAtVercel,
  VERCEL_A_RECORD,
  VERCEL_CNAME_TARGET,
} from "./hostname";

describe("normalizeHostname", () => {
  it("strips scheme, path, port and casing", () => {
    expect(normalizeHostname("HTTPS://Joes-Auto.com:443/some/path")).toBe("joes-auto.com");
  });

  it("strips the trailing dot DNS answers carry", () => {
    // "example.com." vs "example.com" would otherwise never match, and a
    // correctly configured domain would look unverified forever.
    expect(normalizeHostname("cname.vercel-dns.com.")).toBe("cname.vercel-dns.com");
  });

  it("is empty-safe", () => {
    expect(normalizeHostname(null)).toBe("");
    expect(normalizeHostname("   ")).toBe("");
  });
});

describe("checkHostname", () => {
  it("accepts an apex and reports it as one", () => {
    const r = checkHostname("joes-auto.com");
    expect(r).toEqual({ ok: true, hostname: "joes-auto.com", isApex: true });
  });

  it("accepts a subdomain and reports it is not apex", () => {
    const r = checkHostname("ops.joes-auto.com");
    expect(r.ok && r.isApex).toBe(false);
  });

  it("rejects a bare word with a usable message", () => {
    const r = checkHostname("joesauto");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toMatch(/full domain/i);
  });

  it("rejects local-only names", () => {
    // These resolve differently per machine and can never be a tenant host.
    for (const h of ["localhost", "shop.local"]) {
      expect(checkHostname(h).ok).toBe(false);
    }
  });

  it("rejects spaces, empty input and a numeric suffix", () => {
    expect(checkHostname("joes auto.com").ok).toBe(false);
    expect(checkHostname("").ok).toBe(false);
    expect(checkHostname("joes-auto.123").ok).toBe(false);
  });

  it("rejects a label starting or ending with a hyphen", () => {
    expect(checkHostname("-joes.com").ok).toBe(false);
    expect(checkHostname("joes-.com").ok).toBe(false);
  });

  it("normalizes before validating, so a pasted URL is accepted", () => {
    const r = checkHostname("  https://Joes-Auto.com/  ");
    expect(r.ok && r.hostname).toBe("joes-auto.com");
  });
});

describe("dnsInstruction", () => {
  it("gives an apex an A record, because an apex cannot be a CNAME", () => {
    expect(dnsInstruction("joes-auto.com")).toEqual({ type: "A", name: "@", value: VERCEL_A_RECORD });
  });

  it("gives a subdomain a CNAME on its own label", () => {
    expect(dnsInstruction("ops.joes-auto.com")).toEqual({
      type: "CNAME",
      name: "ops",
      value: VERCEL_CNAME_TARGET,
    });
  });
});

describe("answerPointsAtVercel", () => {
  it("accepts the A record", () => {
    expect(answerPointsAtVercel({ Status: 0, Answer: [{ name: "x", type: 1, data: VERCEL_A_RECORD }] })).toBe(true);
  });

  it("accepts a CNAME chain, trailing dot and all", () => {
    expect(
      answerPointsAtVercel({ Status: 0, Answer: [{ name: "x", type: 5, data: "cname.vercel-dns.com." }] }),
    ).toBe(true);
  });

  it("rejects a domain pointing somewhere else", () => {
    // GoHighLevel's IP — the wrong answer that a half-migrated domain gives.
    expect(answerPointsAtVercel({ Status: 0, Answer: [{ name: "x", type: 1, data: "162.159.140.166" }] })).toBe(false);
  });

  it("rejects NXDOMAIN, an empty answer, and nothing at all", () => {
    expect(answerPointsAtVercel({ Status: 3 })).toBe(false);
    expect(answerPointsAtVercel({ Status: 0, Answer: [] })).toBe(false);
    expect(answerPointsAtVercel(null)).toBe(false);
    expect(answerPointsAtVercel(undefined)).toBe(false);
  });
});
