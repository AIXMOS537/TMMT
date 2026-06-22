import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inferVertical, claimLead, routeLead, crossReferLead, routeIncomingLead } from "@/lib/lead-pool";

describe("inferVertical", () => {
  it("classifies funding signals", () => {
    expect(inferVertical("business funding now")).toBe("funding");
    expect(inferVertical(null, "credit guidance")).toBe("funding");
    expect(inferVertical("need capital for my LLC")).toBe("funding");
  });

  it("classifies rentals signals", () => {
    expect(inferVertical("rent a car this weekend")).toBe("rentals");
    expect(inferVertical("vehicle transport", "fleet")).toBe("rentals");
  });

  it("returns null when nothing matches", () => {
    expect(inferVertical("hello there")).toBeNull();
    expect(inferVertical("", null, undefined)).toBeNull();
  });
});

function rpcStub(data: unknown) {
  const rpc = vi.fn().mockResolvedValue({ data, error: null });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("rpc wrappers map params correctly", () => {
  it("claimLead calls lead_claim atomically", async () => {
    const { client, rpc } = rpcStub({ claimed: true, pool_id: 7 });
    const res = await claimLead(client, { poolId: 7, orgId: "org-1", userId: "u-1" });
    expect(res).toEqual({ claimed: true, pool_id: 7 });
    expect(rpc).toHaveBeenCalledWith("lead_claim", { p_pool: 7, p_org: "org-1", p_user: "u-1" });
  });

  it("routeLead passes vertical + agency", async () => {
    const { client, rpc } = rpcStub({ routed: true, pool_id: 1 });
    await routeLead(client, { leadId: "lead-1", vertical: "funding", agencyOrgId: "moe" });
    expect(rpc).toHaveBeenCalledWith("lead_route", {
      p_lead: "lead-1",
      p_vertical: "funding",
      p_agency: "moe",
      p_expires: null,
      p_origin: "route",
    });
  });

  it("crossReferLead targets the other agency/vertical", async () => {
    const { client, rpc } = rpcStub({ referred: true, pool_id: 2 });
    const res = await crossReferLead(client, {
      poolId: 1,
      targetAgencyOrgId: "tmmt",
      targetVertical: "rentals",
    });
    expect(res.referred).toBe(true);
    expect(rpc).toHaveBeenCalledWith("lead_cross_refer", {
      p_pool: 1,
      p_target_agency: "tmmt",
      p_target_vertical: "rentals",
    });
  });

  it("throws on rpc error", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const client = { rpc } as unknown as SupabaseClient;
    await expect(claimLead(client, { poolId: 1, orgId: "o", userId: "u" })).rejects.toThrow(/lead_claim failed: boom/);
  });
});

describe("routeIncomingLead (capture → pool, fail-open)", () => {
  // Client with no matching routes; routeLead rpc succeeds.
  function captureClient(routeRows: unknown[] = []) {
    const limit = vi.fn().mockResolvedValue({ data: routeRows, error: null });
    const order = vi.fn().mockReturnValue({ limit });
    const eq2 = vi.fn().mockReturnValue({ order });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    const from = vi.fn().mockReturnValue({ select });
    const rpc = vi.fn().mockResolvedValue({ data: { routed: true, pool_id: 9 }, error: null });
    return { client: { from, rpc } as unknown as SupabaseClient, rpc };
  }

  it("routes to the capturing tenant when vertical is inferable and no rule matches", async () => {
    const { client, rpc } = captureClient();
    const res = await routeIncomingLead(client, {
      leadId: "lead-1",
      capturingOrgId: "tmmt-org",
      signals: ["rent a car"],
    });
    expect(res.routed).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      "lead_route",
      expect.objectContaining({ p_lead: "lead-1", p_vertical: "rentals", p_agency: "tmmt-org" })
    );
  });

  it("skips (no-op) when the vertical can't be determined", async () => {
    const { client, rpc } = captureClient();
    const res = await routeIncomingLead(client, {
      leadId: "lead-2",
      capturingOrgId: "tmmt-org",
      signals: ["hello"],
    });
    expect(res.skipped).toBe(true);
    expect(res.routed).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails open (never throws) when the schema/rpc errors", async () => {
    const from = vi.fn(() => { throw new Error("relation lead_routes does not exist"); });
    const client = { from } as unknown as SupabaseClient;
    const res = await routeIncomingLead(client, {
      leadId: "lead-3",
      capturingOrgId: "tmmt-org",
      vertical: "funding",
    });
    expect(res).toEqual({ routed: false, reason: "error", skipped: true });
  });
});
