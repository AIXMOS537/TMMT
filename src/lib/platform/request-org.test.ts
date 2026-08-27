import { describe, it, expect, vi, beforeEach } from "vitest";
import { HOUSE_ORG_IDS, ORG_HEADER, HOST_HEADER } from "./tenant-org";

const rpc = vi.fn();
vi.mock("@/lib/agent/supabase-server", () => ({
  createServiceSupabase: () => ({ rpc }),
}));

const OPERATOR_ORG = "370cd891-f6c0-4fcc-a36a-bc25f27ca229";

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("orgIdForRequest", () => {
  beforeEach(async () => {
    rpc.mockReset();
    const { clearOrgHostCache } = await import("./request-org");
    clearOrgHostCache();
  });

  it("trusts the header middleware set, without a lookup", async () => {
    const { orgIdForRequest } = await import("./request-org");
    const got = await orgIdForRequest(headers({ [ORG_HEADER]: HOUSE_ORG_IDS.tmmt }));
    expect(got).toBe(HOUSE_ORG_IDS.tmmt);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("resolves a house host statically when middleware did not run", async () => {
    // Route handlers can sit outside the matcher, so the header may be absent.
    const { orgIdForRequest } = await import("./request-org");
    const got = await orgIdForRequest(headers({ host: "tmmt.example.com" }));
    expect(got).toBe(HOUSE_ORG_IDS.tmmt);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("falls back to the database for an operator domain", async () => {
    const { orgIdForRequest } = await import("./request-org");
    rpc.mockResolvedValue({ data: OPERATOR_ORG });

    const got = await orgIdForRequest(headers({ [HOST_HEADER]: "joes-auto.com" }));
    expect(got).toBe(OPERATOR_ORG);
    expect(rpc).toHaveBeenCalledWith("org_id_for_host", { p_host: "joes-auto.com" });
  });

  it("caches the lookup so repeat requests cost nothing", async () => {
    const { orgIdForRequest } = await import("./request-org");
    rpc.mockResolvedValue({ data: OPERATOR_ORG });

    await orgIdForRequest(headers({ [HOST_HEADER]: "joes-auto.com" }));
    await orgIdForRequest(headers({ [HOST_HEADER]: "joes-auto.com" }));
    await orgIdForRequest(headers({ [HOST_HEADER]: "joes-auto.com" }));
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("caches misses too, so an unknown host cannot hammer the database", async () => {
    const { orgIdForRequest } = await import("./request-org");
    rpc.mockResolvedValue({ data: null });

    await orgIdForRequest(headers({ [HOST_HEADER]: "nobody.example" }));
    await orgIdForRequest(headers({ [HOST_HEADER]: "nobody.example" }));
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("returns undefined for an unknown host — never a default org", async () => {
    // The whole point: a wrong org id shows one tenant another tenant's data.
    const { orgIdForRequest } = await import("./request-org");
    rpc.mockResolvedValue({ data: null });

    await expect(orgIdForRequest(headers({ [HOST_HEADER]: "nobody.example" })))
      .resolves.toBeUndefined();
  });

  it("returns undefined when the lookup throws, rather than guessing", async () => {
    const { orgIdForRequest } = await import("./request-org");
    rpc.mockRejectedValue(new Error("database unreachable"));

    // A transient outage must not become an authorization decision.
    await expect(orgIdForRequest(headers({ [HOST_HEADER]: "joes-auto.com" })))
      .resolves.toBeUndefined();
  });

  it("returns undefined with no host at all", async () => {
    const { orgIdForRequest } = await import("./request-org");
    await expect(orgIdForRequest(headers({}))).resolves.toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("isKnownHost", () => {
  beforeEach(async () => {
    rpc.mockReset();
    const { clearOrgHostCache } = await import("./request-org");
    clearOrgHostCache();
  });

  it("is true for a house host and for a registered operator domain", async () => {
    const { isKnownHost } = await import("./request-org");
    await expect(isKnownHost("tmmt.example.com")).resolves.toBe(true);

    rpc.mockResolvedValue({ data: OPERATOR_ORG });
    await expect(isKnownHost("joes-auto.com")).resolves.toBe(true);
  });

  it("is false for an unregistered host", async () => {
    const { isKnownHost } = await import("./request-org");
    rpc.mockResolvedValue({ data: null });
    await expect(isKnownHost("nobody.example")).resolves.toBe(false);
    await expect(isKnownHost("")).resolves.toBe(false);
  });
});
