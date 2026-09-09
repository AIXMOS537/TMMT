import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { NON_STAFF_USERS, OWNER, STAFF, STAFF_USERS, type RoleUser } from "@/lib/testing/role-users";

/**
 * T-03: onboardOperator creates an org + domain + licence on the service role,
 * and verifyOperatorDomain flips the switch that makes org_id_for_host() route
 * traffic to a tenant. Both are gated by requireStaff() on the JWT role only.
 */
const state = vi.hoisted(() => ({
  ssr: null as unknown,
  svc: null as unknown,
  fetchWithTimeout: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({ createSSRClient: async () => state.ssr }));
vi.mock("@/lib/supabase-service", () => ({ createServiceRoleClient: () => state.svc }));
vi.mock("@/lib/fetch-with-timeout", () => ({ fetchWithTimeout: state.fetchWithTimeout }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { onboardOperator, verifyOperatorDomain } from "./actions";

const NEW_ORG = "33333333-3333-4333-8333-333333333333";
const INPUT = {
  name: "Joe's Auto",
  hostname: "ops.joes-auto.example.com",
  licenseTier: "starter",
  modules: ["rentals_app", "dispatch"],
  adminEmail: "Admin@Example.com",
};

function signIn(user: RoleUser | null, opts: { hostnameTaken?: boolean } = {}) {
  state.ssr = makeFakeSupabase(() => undefined, { user });
  state.svc = makeFakeSupabase((call) => {
    if (call.table === "organization_domains" && call.op === "select") {
      return { data: opts.hostnameTaken ? { org_id: "x", organizations: { name: "Someone Else" } } : null };
    }
    if (call.table === "organizations" && call.op === "insert") return { data: { id: NEW_ORG } };
    return undefined;
  });
  return state.svc as FakeSupabase;
}

const dnsAnswer = (data: string, type = 5) =>
  ({ json: async () => ({ Status: 0, Answer: [{ name: "ops.joes-auto.example.com.", type, data }] }) }) as unknown as Response;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("onboardOperator / verifyOperatorDomain: rejected callers", () => {
  const rejected: Array<[string, RoleUser | null]> = [["anonymous", null], ...NON_STAFF_USERS];

  it.each(rejected)("%s cannot onboard or verify, and nothing is written or looked up", async (_label, user) => {
    const svc = signIn(user);
    expect(await onboardOperator(INPUT)).toEqual({ success: false, error: "Owner or staff only." });
    expect(await verifyOperatorDomain(INPUT.hostname)).toEqual({ success: false, error: "Owner or staff only." });
    expect(svc.calls).toHaveLength(0);
    expect(state.fetchWithTimeout).not.toHaveBeenCalled();
  });
});

describe("onboardOperator: staff happy path", () => {
  it.each(STAFF_USERS)("%s creates org, unverified domain, inactive licence, then invites the admin", async (_label, user) => {
    const svc = signIn(user);
    const res = await onboardOperator(INPUT);
    expect(res).toEqual({
      success: true,
      data: {
        orgId: NEW_ORG,
        hostname: "ops.joes-auto.example.com",
        dns: { type: "CNAME", name: "ops", value: "cname.vercel-dns.com" },
        adminInvited: true,
      },
    });

    const w = writes(svc);
    expect(w.map((c) => [c.table, c.op])).toEqual([
      ["organizations", "insert"],
      ["organization_domains", "insert"],
      ["organization_licenses", "insert"],
      ["rpc:onboard_org_member", "rpc"],
    ]);
    expect(w[0].payload).toEqual({ name: "Joe's Auto" });
    // A claim, not a route: nothing resolves to the tenant until DNS proves it.
    expect(w[1].payload).toEqual({ org_id: NEW_ORG, hostname: "ops.joes-auto.example.com", is_primary: true, verified_at: null });
    // Off until paid + verified; guardOrganization() refuses an inactive licence.
    expect(w[2].payload).toMatchObject({ organization_id: NEW_ORG, license_tier: "starter", modules: ["rentals_app", "dispatch"], active: false });
    expect(w[3].payload).toEqual({ email: "admin@example.com", org: NEW_ORG, role: "tenant_admin" });
  });

  it("refuses a hostname that is already registered before creating anything", async () => {
    const svc = signIn(OWNER, { hostnameTaken: true });
    expect(await onboardOperator(INPUT)).toEqual({
      success: false,
      error: "ops.joes-auto.example.com is already registered to Someone Else.",
    });
    expect(writes(svc)).toHaveLength(0);
  });

  it("rejects a bad name or hostname before touching the database", async () => {
    const svc = signIn(STAFF);
    expect(await onboardOperator({ ...INPUT, name: " " })).toEqual({ success: false, error: "Enter the operator's business name." });
    expect(await onboardOperator({ ...INPUT, hostname: "localhost" })).toMatchObject({ success: false });
    expect(await onboardOperator({ ...INPUT, hostname: "joes auto.com" })).toMatchObject({ success: false });
    expect(svc.calls).toHaveLength(0);
  });

  it("undoes the org when the domain insert fails", async () => {
    signIn(OWNER);
    state.svc = makeFakeSupabase((call) => {
      if (call.table === "organization_domains" && call.op === "select") return { data: null };
      if (call.table === "organizations" && call.op === "insert") return { data: { id: NEW_ORG } };
      if (call.table === "organization_domains" && call.op === "insert") return { error: { message: "duplicate key" } };
      return undefined;
    });
    expect(await onboardOperator(INPUT)).toEqual({ success: false, error: "Could not register the domain: duplicate key" });
    const deletes = writes(state.svc as FakeSupabase).filter((c) => c.op === "delete");
    expect(deletes.map((c) => c.table)).toEqual(["organization_domains", "organization_licenses", "organizations"]);
    expect(deletes[2].filters).toContainEqual(["eq", "id", NEW_ORG]);
  });
});

describe("verifyOperatorDomain: the switch only flips when DNS actually points here", () => {
  it("marks the domain verified when the CNAME resolves to Vercel", async () => {
    const svc = signIn(STAFF);
    state.fetchWithTimeout.mockResolvedValueOnce(dnsAnswer("cname.vercel-dns.com."));
    const res = await verifyOperatorDomain("OPS.joes-auto.example.com");
    expect(res).toMatchObject({ success: true, data: { verified: true } });
    const upd = writes(svc);
    expect(upd).toHaveLength(1);
    expect(upd[0]).toMatchObject({ table: "organization_domains", op: "update" });
    expect(upd[0].filters).toContainEqual(["eq", "hostname", "ops.joes-auto.example.com"]);
    expect((upd[0].payload as { verified_at: string }).verified_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("writes nothing when DNS points elsewhere", async () => {
    const svc = signIn(OWNER);
    state.fetchWithTimeout
      .mockResolvedValueOnce(dnsAnswer("ghs.googlehosted.com."))
      .mockResolvedValueOnce(dnsAnswer("203.0.113.9", 1));
    const res = await verifyOperatorDomain(INPUT.hostname);
    expect(res).toMatchObject({ success: true, data: { verified: false } });
    expect(writes(svc)).toHaveLength(0);
  });

  it("writes nothing when DNS cannot be reached", async () => {
    const svc = signIn(OWNER);
    state.fetchWithTimeout.mockRejectedValueOnce(new Error("timeout"));
    expect(await verifyOperatorDomain(INPUT.hostname)).toEqual({
      success: false,
      error: "Could not reach DNS to check. Try again in a moment.",
    });
    expect(writes(svc)).toHaveLength(0);
  });

  it("rejects an invalid hostname before any lookup", async () => {
    const svc = signIn(OWNER);
    expect(await verifyOperatorDomain("nodots")).toMatchObject({ success: false });
    expect(state.fetchWithTimeout).not.toHaveBeenCalled();
    expect(svc.calls).toHaveLength(0);
  });
});
