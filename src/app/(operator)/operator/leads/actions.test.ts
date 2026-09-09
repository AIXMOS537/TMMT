import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeSupabase, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { CUSTOMER, NO_ROLE, OPERATOR, OWNER, STAFF, VENDOR, type RoleUser } from "@/lib/testing/role-users";

/**
 * T-03 for the lead pool. Writes run on the service role, so the gate is
 * caller() + authorizeForPool(): the caller's org comes off their own profile
 * row (never the request), the pool row's agency comes off the pool, and
 * canClaimFromAgency() decides. Staff pass everything; an operator may claim
 * only from their own agency; only the agency itself (or staff) may assign or
 * cross-refer.
 */
const state = vi.hoisted(() => ({
  ssr: null as unknown,
  svc: null as unknown,
  claimLead: vi.fn(),
  assignLead: vi.fn(),
  crossReferLead: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({ createSSRClient: async () => state.ssr }));
vi.mock("@/lib/supabase-service", () => ({ createServiceRoleClient: () => state.svc }));
vi.mock("@/lib/lead-pool", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/lead-pool")>()),
  claimLead: state.claimLead,
  assignLead: state.assignLead,
  crossReferLead: state.crossReferLead,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { assignLeadAction, claimLeadAction, crossReferLeadAction, listOrgsForAssign, viewerContext } from "./actions";

const AGENCY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AGENCY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SUB_OF_A = "a5000000-0000-4000-8000-0000000000a5";
const SUB_OF_B = "b5000000-0000-4000-8000-0000000000b5";
const POOL_IN_A = 101;
const POOL_IN_B = 202;
const POOL_MISSING = 999;

const parentOf: Record<string, string | null> = { [AGENCY_A]: null, [AGENCY_B]: null, [SUB_OF_A]: AGENCY_A, [SUB_OF_B]: AGENCY_B };
const agencyOfPool: Record<number, string> = { [POOL_IN_A]: AGENCY_A, [POOL_IN_B]: AGENCY_B };

function signIn(user: RoleUser | null, profileOrg: string | null = null) {
  state.ssr = makeFakeSupabase((call) => {
    if (call.table === "profiles") return { data: profileOrg ? { organization_id: profileOrg } : null };
    return undefined;
  }, { user });
  state.svc = makeFakeSupabase((call) => {
    const id = call.filters.find((f) => f[0] === "eq" && f[1] === "id")?.[2];
    if (call.table === "lead_pool") {
      const agency = agencyOfPool[id as number];
      return { data: agency ? { agency_org_id: agency } : null };
    }
    if (call.table === "organizations" && id) return { data: { parent_agency_id: parentOf[id as string] ?? null } };
    if (call.table === "organizations") {
      return { data: [{ id: AGENCY_A, name: "Agency A", parent_agency_id: null }, { id: SUB_OF_A, name: "Sub A", parent_agency_id: AGENCY_A }] };
    }
    return undefined;
  });
  return { ssr: state.ssr as FakeSupabase, svc: state.svc as FakeSupabase };
}

const noPoolWrites = () => {
  expect(state.claimLead).not.toHaveBeenCalled();
  expect(state.assignLead).not.toHaveBeenCalled();
  expect(state.crossReferLead).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.resetAllMocks();
  state.claimLead.mockResolvedValue({ claimed: true, pool_id: POOL_IN_A });
  state.assignLead.mockResolvedValue({ assigned: true, pool_id: POOL_IN_A });
  state.crossReferLead.mockResolvedValue({ referred: true, pool_id: POOL_IN_A });
});

describe("lead pool: anonymous", () => {
  it("is refused everywhere with no service-role access", async () => {
    const { svc } = signIn(null);
    expect(await claimLeadAction(POOL_IN_A)).toEqual({ success: false, error: "Not signed in." });
    expect(await assignLeadAction(POOL_IN_A, SUB_OF_A)).toEqual({ success: false, error: "Not signed in." });
    expect(await crossReferLeadAction(POOL_IN_A, AGENCY_B, "funding")).toEqual({ success: false, error: "Not signed in." });
    expect(await listOrgsForAssign()).toEqual({ operators: [], agencies: [] });
    expect(await viewerContext()).toEqual({ canManage: false });
    expect(svc.calls).toHaveLength(0);
    noPoolWrites();
  });
});

describe("lead pool: wrong tier", () => {
  it.each([["customer", CUSTOMER], ["vendor", VENDOR], ["no role", NO_ROLE]] as Array<[string, RoleUser]>)(
    "%s with an org on their profile still cannot claim, and the pool is never read",
    async (_label, user) => {
      const { svc } = signIn(user, SUB_OF_A);
      expect(await claimLeadAction(POOL_IN_A)).toEqual({ success: false, error: "Not allowed." });
      expect(svc.calls).toHaveLength(0);
      expect(await viewerContext()).toEqual({ canManage: false });
      expect(await listOrgsForAssign()).toEqual({ operators: [], agencies: [] });
      noPoolWrites();
    }
  );

  it("an operator with no organization on their profile cannot claim", async () => {
    const { svc } = signIn(OPERATOR, null);
    expect(await claimLeadAction(POOL_IN_A)).toEqual({ success: false, error: "No organization on your profile." });
    expect(await assignLeadAction(POOL_IN_A, SUB_OF_A)).toEqual({ success: false, error: "Not allowed." });
    expect(svc.calls).toHaveLength(0);
    noPoolWrites();
  });
});

describe("lead pool: operator in agency A against agency B", () => {
  it("cannot claim a lead pooled under another agency", async () => {
    signIn(OPERATOR, SUB_OF_A);
    expect(await claimLeadAction(POOL_IN_B)).toEqual({ success: false, error: "This lead isn't in your agency." });
    noPoolWrites();
  });

  it("cannot assign or refer another agency's lead", async () => {
    signIn(OPERATOR, AGENCY_A);
    expect(await assignLeadAction(POOL_IN_B, SUB_OF_A)).toEqual({ success: false, error: "Only the agency can assign this lead." });
    expect(await crossReferLeadAction(POOL_IN_B, AGENCY_A, "rentals")).toEqual({ success: false, error: "Only the agency can refer this lead." });
    noPoolWrites();
  });

  it("a lead that does not exist is not found for anyone below staff", async () => {
    signIn(OPERATOR, SUB_OF_A);
    expect(await claimLeadAction(POOL_MISSING)).toEqual({ success: false, error: "Lead not found." });
    noPoolWrites();
  });
});

describe("lead pool: operator sub-account in agency A", () => {
  it("claims with the org from their profile and their own user id — never from the request", async () => {
    const { svc } = signIn(OPERATOR, SUB_OF_A);
    expect(await claimLeadAction(POOL_IN_A)).toEqual({ success: true });
    expect(state.claimLead).toHaveBeenCalledWith(svc, { poolId: POOL_IN_A, orgId: SUB_OF_A, userId: OPERATOR.id });
    // The eligibility read was for the pool row and the caller's own org.
    expect(svc.calls.map((c) => c.table)).toEqual(["lead_pool", "organizations"]);
    expect(svc.calls[1].filters).toContainEqual(["eq", "id", SUB_OF_A]);
  });

  it("a sub-account is not the agency: it cannot assign or cross-refer even its own agency's lead", async () => {
    signIn(OPERATOR, SUB_OF_A);
    expect(await assignLeadAction(POOL_IN_A, SUB_OF_A)).toEqual({ success: false, error: "Only the agency can assign this lead." });
    expect(await crossReferLeadAction(POOL_IN_A, AGENCY_B, "funding")).toEqual({ success: false, error: "Only the agency can refer this lead." });
    noPoolWrites();
  });

  it("reports a lost race without claiming success", async () => {
    signIn(OPERATOR, SUB_OF_A);
    state.claimLead.mockResolvedValueOnce({ claimed: false, reason: "unavailable" });
    expect(await claimLeadAction(POOL_IN_A)).toEqual({ success: false, error: "Someone just claimed this lead." });
  });
});

describe("lead pool: the agency itself", () => {
  it("assigns and cross-refers its own leads", async () => {
    const { svc } = signIn(OPERATOR, AGENCY_A);
    expect(await assignLeadAction(POOL_IN_A, SUB_OF_A)).toEqual({ success: true });
    expect(state.assignLead).toHaveBeenCalledWith(svc, { poolId: POOL_IN_A, orgId: SUB_OF_A });
    expect(await crossReferLeadAction(POOL_IN_A, AGENCY_B, "funding")).toEqual({ success: true });
    expect(state.crossReferLead).toHaveBeenCalledWith(svc, { poolId: POOL_IN_A, targetAgencyOrgId: AGENCY_B, targetVertical: "funding" });
  });

  it("refuses an unknown vertical before referring", async () => {
    signIn(OPERATOR, AGENCY_A);
    expect(await crossReferLeadAction(POOL_IN_A, AGENCY_B, "crypto")).toEqual({ success: false, error: "Invalid vertical." });
    expect(state.crossReferLead).not.toHaveBeenCalled();
  });
});

describe("lead pool: staff", () => {
  it.each([["owner", OWNER], ["staff", STAFF]] as Array<[string, RoleUser]>)("%s can manage any agency's leads and see the pickers", async (_label, user) => {
    const { svc } = signIn(user, AGENCY_A);
    expect(await viewerContext()).toEqual({ canManage: true });
    expect(await listOrgsForAssign()).toEqual({ operators: [{ id: SUB_OF_A, name: "Sub A" }], agencies: [{ id: AGENCY_A, name: "Agency A" }] });
    expect(await claimLeadAction(POOL_IN_B)).toEqual({ success: true });
    expect(state.claimLead).toHaveBeenCalledWith(svc, { poolId: POOL_IN_B, orgId: AGENCY_A, userId: user.id });
    expect(await assignLeadAction(POOL_IN_B, SUB_OF_B)).toEqual({ success: true });
    expect(await crossReferLeadAction(POOL_IN_B, AGENCY_A, "rentals")).toEqual({ success: true });
  });

  it("staff with no org can still assign, but still cannot claim (a claim needs an org to land in)", async () => {
    signIn(STAFF, null);
    expect(await claimLeadAction(POOL_IN_A)).toEqual({ success: false, error: "No organization on your profile." });
    expect(await assignLeadAction(POOL_IN_A, SUB_OF_A)).toEqual({ success: true });
    expect(state.claimLead).not.toHaveBeenCalled();
  });
});
