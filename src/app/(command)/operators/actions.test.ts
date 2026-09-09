import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { NON_STAFF_USERS, OWNER, STAFF, STAFF_USERS, type RoleUser } from "@/lib/testing/role-users";

/**
 * T-03: every provisioning action here runs on the service-role client, which
 * bypasses RLS. The only thing between a caller and a new organisation (or a
 * token grant) is requireStaff() -> isStaffUser() on the JWT role. So the
 * assertion that matters is: rejected caller => the service client is never
 * touched and grantTokens is never called.
 */
const state = vi.hoisted(() => ({
  ssr: null as unknown,
  svc: null as unknown,
  grantTokens: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({ createSSRClient: async () => state.ssr }));
vi.mock("@/lib/supabase-service", () => ({ createServiceRoleClient: () => state.svc }));
vi.mock("@/lib/token-ledger", () => ({ grantTokens: state.grantTokens }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { fundOperatorTokens, listOperators, listOrgs, provisionOperatorSubAccount } from "./actions";

const AGENCY = "11111111-1111-4111-8111-111111111111";
const NEW_ORG = "22222222-2222-4222-8222-222222222222";

function signIn(user: RoleUser | null) {
  state.ssr = makeFakeSupabase(() => undefined, { user });
  state.svc = makeFakeSupabase((call) => {
    if (call.table === "organizations" && call.op === "select" && call.columns === "kind") {
      return { data: { kind: "tmmt" } };
    }
    if (call.table === "organizations" && call.op === "insert") return { data: { id: NEW_ORG } };
    if (call.table === "organizations" && call.op === "select") {
      return { data: [{ id: AGENCY, name: "Agency A", kind: "tmmt", parent_agency_id: null, created_at: "2026-01-01" }] };
    }
    if (call.table === "tmmt_token_balances") return { data: [{ org_id: AGENCY, balance: 5, unlimited: false }] };
    return undefined;
  });
  return state.svc as FakeSupabase;
}

beforeEach(() => {
  vi.resetAllMocks();
  state.grantTokens.mockResolvedValue({ ok: true });
});

describe("operators provisioning: anonymous and non-staff never reach the service client", () => {
  const rejected: Array<[string, RoleUser | null]> = [["anonymous", null], ...NON_STAFF_USERS];

  it.each(rejected)("%s is refused by every action with no DB access", async (_label, user) => {
    const svc = signIn(user);

    expect(await listOrgs()).toEqual([]);
    expect(await listOperators()).toEqual([]);
    expect(await provisionOperatorSubAccount({ name: "Joe's Auto", parentAgencyOrgId: AGENCY, initialTokens: 100 })).toEqual({
      success: false,
      error: "Owner/staff only.",
    });
    expect(await fundOperatorTokens({ orgId: AGENCY, amount: 50 })).toEqual({ success: false, error: "Owner/staff only." });

    expect(svc.calls).toHaveLength(0);
    expect(state.grantTokens).not.toHaveBeenCalled();
  });
});

describe("operators provisioning: staff tiers", () => {
  it.each(STAFF_USERS)("%s can list orgs and operators", async (_label, user) => {
    const svc = signIn(user);
    expect(await listOrgs()).toEqual([expect.objectContaining({ id: AGENCY, name: "Agency A" })]);
    const ops = await listOperators();
    expect(ops[0]).toMatchObject({ id: AGENCY, balance: 5, unlimited: false });
    // Reads only — no provisioning action writes on a list.
    expect(writes(svc)).toHaveLength(0);
    // Operator rows are the ones with a parent, never `kind = 'operator'`.
    const opsQuery = svc.calls.find((c) => c.table === "organizations" && c.columns?.includes("created_at"));
    expect(opsQuery?.filters).toContainEqual(["not", "parent_agency_id", { operator: "is", value: null }]);
  });

  it("owner provisions a sub-account under the named agency, inheriting kind, and funds it", async () => {
    const svc = signIn(OWNER);
    const res = await provisionOperatorSubAccount({ name: "  Joe's Auto ", parentAgencyOrgId: AGENCY, initialTokens: 100.9 });
    expect(res).toEqual({ success: true, orgId: NEW_ORG });

    const insert = writes(svc).find((c) => c.table === "organizations" && c.op === "insert");
    expect(insert?.payload).toEqual({ name: "Joe's Auto", kind: "tmmt", parent_agency_id: AGENCY });
    expect(state.grantTokens).toHaveBeenCalledWith(
      svc,
      expect.objectContaining({ orgId: NEW_ORG, amount: 100, dedupeKey: `provision:${NEW_ORG}` })
    );
  });

  it("staff provisioning with no tokens creates the org and skips the grant", async () => {
    const svc = signIn(STAFF);
    expect(await provisionOperatorSubAccount({ name: "Dry Run", parentAgencyOrgId: AGENCY })).toEqual({ success: true, orgId: NEW_ORG });
    expect(writes(svc)).toHaveLength(1);
    expect(state.grantTokens).not.toHaveBeenCalled();
  });

  it("validates name and parent before any write, and refuses a parent that no longer exists", async () => {
    const svc = signIn(OWNER);
    expect(await provisionOperatorSubAccount({ name: "   ", parentAgencyOrgId: AGENCY })).toEqual({ success: false, error: "Name is required." });
    expect(await provisionOperatorSubAccount({ name: "X", parentAgencyOrgId: "" })).toEqual({ success: false, error: "Pick a parent agency." });
    expect(svc.calls).toHaveLength(0);

    state.svc = makeFakeSupabase(() => ({ data: null }));
    expect(await provisionOperatorSubAccount({ name: "X", parentAgencyOrgId: AGENCY })).toEqual({
      success: false,
      error: "That parent agency no longer exists.",
    });
    expect(writes(state.svc as FakeSupabase)).toHaveLength(0);
  });

  it("funds tokens only for a positive whole amount", async () => {
    signIn(OWNER);
    expect(await fundOperatorTokens({ orgId: AGENCY, amount: 0 })).toEqual({ success: false, error: "Enter a positive amount." });
    expect(await fundOperatorTokens({ orgId: AGENCY, amount: -5 })).toEqual({ success: false, error: "Enter a positive amount." });
    expect(await fundOperatorTokens({ orgId: "", amount: 5 })).toEqual({ success: false, error: "Enter a positive amount." });
    expect(state.grantTokens).not.toHaveBeenCalled();

    expect(await fundOperatorTokens({ orgId: AGENCY, amount: 25.7 })).toEqual({ success: true });
    expect(state.grantTokens).toHaveBeenCalledWith(state.svc, expect.objectContaining({ orgId: AGENCY, amount: 25 }));
  });

  it("reports a failed grant instead of claiming success", async () => {
    signIn(OWNER);
    state.grantTokens.mockRejectedValueOnce(new Error("ledger down"));
    expect(await fundOperatorTokens({ orgId: AGENCY, amount: 5 })).toEqual({ success: false, error: "Could not fund tokens." });
  });
});
