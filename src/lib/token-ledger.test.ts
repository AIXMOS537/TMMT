import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COST_PER_JOB,
  MEMBER_97_MONTHLY_TOKENS,
  tokenGrantForTag,
  firstGrantTag,
  topupDedupeKey,
  resolveOrgIdByEmail,
  grantTokens,
  spendTokens,
  getTokenBalance,
  grantMonthlyTokensForPayment,
} from "./token-ledger";

const ORG = "11111111-1111-1111-1111-111111111111";

describe("tokenGrantForTag / firstGrantTag", () => {
  it("maps member-97 to the monthly stack", () => {
    expect(tokenGrantForTag("member-97")).toEqual({
      tokens: MEMBER_97_MONTHLY_TOKENS,
      tier: "member",
      reason: "member-97 monthly top-up",
    });
  });

  it("returns null for tags that don't grant tokens", () => {
    expect(tokenGrantForTag("credit-guidance-active")).toBeNull();
    expect(tokenGrantForTag("build-carbox-deposit")).toBeNull();
    expect(tokenGrantForTag("nope")).toBeNull();
  });

  it("firstGrantTag picks the first granting tag, ignoring others", () => {
    expect(firstGrantTag(["some-tag", "member-97", "aff-jane"])).toBe("member-97");
    expect(firstGrantTag(["contact.created", "credit-guidance-active"])).toBeNull();
  });
});

describe("topupDedupeKey", () => {
  it("uses the transaction ref when present (every recurring charge is unique)", () => {
    expect(topupDedupeKey("member-97", "a@b.com", "txn_123")).toBe("ghl-topup:txn_123");
  });

  it("falls back to a per-email, per-month key so a month grants at most once", () => {
    const now = new Date("2026-06-18T12:00:00Z");
    expect(topupDedupeKey("member-97", "A@B.com", null, now)).toBe("member-97:a@b.com:2026-06");
  });

  it("rolls the fallback key to a fresh key next month (so renewals re-grant)", () => {
    const jun = topupDedupeKey("member-97", "a@b.com", null, new Date("2026-06-30T23:59:00Z"));
    const jul = topupDedupeKey("member-97", "a@b.com", null, new Date("2026-07-01T00:01:00Z"));
    expect(jun).not.toBe(jul);
  });
});

// ── Minimal service-client stubs ────────────────────────────────────────────
function rpcStub(returns: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue({ data: returns.data ?? null, error: returns.error ?? null });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

/** Stub for resolveOrgIdByEmail's profiles().select().ilike().not().order().limit() chain. */
function profilesStub(rows: Array<{ organization_id: string | null }>) {
  const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
  const order = vi.fn().mockReturnValue({ limit });
  const not = vi.fn().mockReturnValue({ order });
  const ilike = vi.fn().mockReturnValue({ not });
  const select = vi.fn().mockReturnValue({ ilike });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as SupabaseClient, from, ilike };
}

describe("grantTokens", () => {
  it("calls tmmt_token_grant with the mapped params and returns the result", async () => {
    const { client, rpc } = rpcStub({ data: { granted: true, balance: 500 } });
    const res = await grantTokens(client, {
      orgId: ORG,
      amount: 500,
      reason: "member-97 monthly top-up",
      dedupeKey: "ghl-topup:txn_1",
      setAllotment: 500,
      tier: "member",
    });
    expect(res).toEqual({ granted: true, balance: 500 });
    expect(rpc).toHaveBeenCalledWith("tmmt_token_grant", {
      p_org: ORG,
      p_amount: 500,
      p_reason: "member-97 monthly top-up",
      p_dedupe: "ghl-topup:txn_1",
      p_set_allotment: 500,
      p_tier: "member",
    });
  });

  it("throws when the RPC errors", async () => {
    const { client } = rpcStub({ error: { message: "boom" } });
    await expect(
      grantTokens(client, { orgId: ORG, amount: 1, reason: "x" })
    ).rejects.toThrow(/tmmt_token_grant failed: boom/);
  });
});

describe("spendTokens", () => {
  it("defaults cost to COST_PER_JOB and passes the job ref", async () => {
    const { client, rpc } = rpcStub({ data: { allowed: true, balance: 499, unlimited: false } });
    const res = await spendTokens(client, { orgId: ORG, jobRef: "job-7" });
    expect(res.allowed).toBe(true);
    expect(rpc).toHaveBeenCalledWith("tmmt_token_spend", {
      p_org: ORG,
      p_cost: COST_PER_JOB,
      p_job: "job-7",
    });
  });

  it("surfaces a denial reason verbatim", async () => {
    const { client } = rpcStub({ data: { allowed: false, balance: 0, reason: "insufficient" } });
    const res = await spendTokens(client, { orgId: ORG });
    expect(res).toEqual({ allowed: false, balance: 0, reason: "insufficient" });
  });
});

describe("getTokenBalance", () => {
  it("returns the balance row when present", async () => {
    const row = { balance: 12, monthly_allotment: 500, plan_tier: "member", unlimited: false, status: "active" };
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from } as unknown as SupabaseClient;
    expect(await getTokenBalance(client, ORG)).toEqual(row);
    expect(from).toHaveBeenCalledWith("tmmt_token_balances");
  });
});

describe("resolveOrgIdByEmail", () => {
  it("returns the org id for a known member email", async () => {
    const { client } = profilesStub([{ organization_id: ORG }]);
    expect(await resolveOrgIdByEmail(client, "Member@Example.com")).toBe(ORG);
  });

  it("returns null when no profile/org is tied to the email", async () => {
    const { client } = profilesStub([]);
    expect(await resolveOrgIdByEmail(client, "stranger@example.com")).toBeNull();
  });

  it("returns null for a blank email without querying", async () => {
    const { client, from } = profilesStub([]);
    expect(await resolveOrgIdByEmail(client, "   ")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});

describe("grantMonthlyTokensForPayment", () => {
  it("no-ops when no tag grants tokens", async () => {
    const { client, rpc } = rpcStub({});
    const res = await grantMonthlyTokensForPayment(client, {
      email: "a@b.com",
      tags: ["build-carbox-deposit"],
      paymentRef: "txn_1",
    });
    expect(res).toEqual({ topped_up: false, reason: "no_grant_tag" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("no-ops (no grant) when the email isn't tied to an org", async () => {
    // profiles resolves to nothing → no_org, and rpc is never reached.
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const order = vi.fn().mockReturnValue({ limit });
    const not = vi.fn().mockReturnValue({ order });
    const ilike = vi.fn().mockReturnValue({ not });
    const select = vi.fn().mockReturnValue({ ilike });
    const from = vi.fn().mockReturnValue({ select });
    const rpc = vi.fn();
    const client = { from, rpc } as unknown as SupabaseClient;
    const res = await grantMonthlyTokensForPayment(client, {
      email: "new@member.com",
      tags: ["member-97"],
      paymentRef: "txn_2",
    });
    expect(res).toEqual({ topped_up: false, reason: "no_org" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("grants the monthly stack to the resolved org, idempotently keyed on the payment ref", async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [{ organization_id: ORG }], error: null }),
            }),
          }),
        }),
      }),
    });
    const rpc = vi.fn().mockResolvedValue({ data: { granted: true, balance: MEMBER_97_MONTHLY_TOKENS }, error: null });
    const client = { from, rpc } as unknown as SupabaseClient;

    const res = await grantMonthlyTokensForPayment(client, {
      email: "member@example.com",
      tags: ["member-97"],
      paymentRef: "txn_42",
    });

    expect(res).toEqual({
      topped_up: true,
      tag: "member-97",
      org_id: ORG,
      balance: MEMBER_97_MONTHLY_TOKENS,
      granted: true,
    });
    expect(rpc).toHaveBeenCalledWith("tmmt_token_grant", {
      p_org: ORG,
      p_amount: MEMBER_97_MONTHLY_TOKENS,
      p_reason: "member-97 monthly top-up",
      p_dedupe: "ghl-topup:txn_42",
      p_set_allotment: MEMBER_97_MONTHLY_TOKENS,
      p_tier: "member",
    });
  });
});
