import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeSupabase, writes, type FakeDbCall, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { CUSTOMER, NO_ROLE, OPERATOR, OWNER, STAFF, type RoleUser } from "@/lib/testing/role-users";

/**
 * T-03 for dispatch: every mutation goes through the RLS-scoped SSR client, but
 * the app-side gate is requireOrgAccess(): staff pass; everyone else needs a row
 * in org_roles for THE RECORD'S org (never one the caller names), and the
 * responder-link actions need tenant_admin/dispatcher there.
 *
 * The org for an existing record is read off the record (orgForUnit /
 * orgForIncident / the assignment view / the link row); createIncident and
 * lockExpiredAssignments take it from the input, so the membership check is
 * what keeps a signed-in user from filing into someone else's organisation.
 */
const state = vi.hoisted(() => ({
  ssr: null as unknown,
  notifyResponder: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({ createSSRClient: async () => state.ssr }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/osm-geocode", () => ({
  searchAddress: async () => [{ place_name: "1 Main St, Springfield", center: [-72.59, 42.1] }],
}));
vi.mock("@/lib/captain-client", () => ({ askCaptainDispatch: async () => null }));
vi.mock("@/lib/notify-telegram", () => ({ notifyResponder: state.notifyResponder }));

import {
  approveResponderLink,
  createIncident,
  geocodeAddress,
  lockExpiredAssignments,
  overrideAssignment,
  revokeResponderLink,
  setUnitLocation,
  setUnitStatus,
  transitionStatus,
} from "./actions";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UNIT_B = "0b000000-0000-4000-8000-00000000000b";
const UNIT_A = "0a000000-0000-4000-8000-00000000000a";
const INCIDENT_B = "1b000000-0000-4000-8000-00000000000b";
const INCIDENT_A = "1a000000-0000-4000-8000-00000000000a";
const ASSIGNMENT_B = "2b000000-0000-4000-8000-00000000000b";
const ASSIGNMENT_A = "2a000000-0000-4000-8000-00000000000a";
const LINK_B = "3b000000-0000-4000-8000-00000000000b";
const LINK_A = "3a000000-0000-4000-8000-00000000000a";
const RESPONDER_UID = "00000000-0000-4000-8000-0000000000fe";
const INCIDENT_NEW = "1c000000-0000-4000-8000-00000000000c";

/** Membership table for the fake: user id -> org id -> roles. */
type Membership = Record<string, Record<string, string[]>>;

const orgOf: Record<string, string> = {
  [UNIT_A]: ORG_A,
  [UNIT_B]: ORG_B,
  [INCIDENT_A]: ORG_A,
  [INCIDENT_B]: ORG_B,
  [ASSIGNMENT_A]: ORG_A,
  [ASSIGNMENT_B]: ORG_B,
  [LINK_A]: ORG_A,
  [LINK_B]: ORG_B,
};

function signIn(user: RoleUser | null, membership: Membership = {}) {
  state.ssr = makeFakeSupabase((call) => {
    const eq = Object.fromEntries(call.filters.filter((f) => f[0] === "eq").map((f) => [String(f[1]), f[2]]));
    if (call.table === "org_roles") {
      const roles = membership[String(eq.user_id)]?.[String(eq.org_id)] ?? [];
      return { data: roles.map((role) => ({ role })) };
    }
    if (call.op === "select" && (call.table === "units" || call.table === "incidents" || call.table === "org_responder_links")) {
      const id = String(eq.id);
      const org = orgOf[id];
      if (!org) return { data: null };
      // Honour an org_id filter the way Postgres would: a row from another
      // org is simply not there (overrideAssignment's unit cross-check).
      if (eq.org_id !== undefined && eq.org_id !== org) return { data: null };
      if (call.table === "incidents" && call.columns === "*") {
        return { data: { id, org_id: org, ref_code: "DSP-1", severity: 2, location_lat: 1, location_lng: 2, location_text: "x", required_capabilities: [], description: null } };
      }
      return { data: { id, org_id: org, responder_id: RESPONDER_UID, callsign: "U1" } };
    }
    if (call.table === "incident_assignments_v") {
      if (eq.effective_status === "locked") return { data: { unit_id: UNIT_A } };
      const id = String(eq.id);
      const org = orgOf[id];
      if (!org) return { data: null };
      return { data: { id, org_id: org, unit_id: org === ORG_A ? UNIT_A : UNIT_B, incident_id: org === ORG_A ? INCIDENT_A : INCIDENT_B, effective_status: "tentative", reasoning_json: { prior: true } } };
    }
    if (call.table === "incidents" && call.op === "insert") return { data: { id: INCIDENT_NEW } };
    if (call.table === "rpc:next_dsp_ref_code") return { data: "DSP-0042" };
    if (call.table === "rpc:find_best_unit") return { data: [] };
    if (call.table === "rpc:assign_unit") return { data: { id: "new-assignment" } };
    if (call.table === "rpc:lock_expired_assignments") return { data: 3 };
    if (call.table === "profiles") return { data: { telegram_chat_id: null } };
    return undefined;
  }, { user });
  return state.ssr as FakeSupabase;
}

const validIncident = (org_id: string) => ({
  org_id,
  reporter_name: "Test Reporter",
  reporter_phone: "555-0100",
  location_lat: 42.1,
  location_lng: -72.59,
  location_text: "1 Main St, Springfield",
  description: "flat tyre",
  severity: 2 as const,
  required_capabilities: [],
});

/** Every mutating action, targeting org B's records / org B by name. */
const actionsAgainstOrgB: Array<[string, () => Promise<unknown>]> = [
  ["createIncident(org B)", () => createIncident(validIncident(ORG_B))],
  ["overrideAssignment(assignment in B)", () => overrideAssignment({ incident_id: INCIDENT_B, current_assignment_id: ASSIGNMENT_B, chosen_unit_id: UNIT_B, reason: "closer" })],
  ["transitionStatus(incident in B)", () => transitionStatus({ incident_id: INCIDENT_B, to_status: "en_route" })],
  ["lockExpiredAssignments(org B)", () => lockExpiredAssignments(ORG_B)],
  ["setUnitStatus(unit in B)", () => setUnitStatus({ unit_id: UNIT_B, status: "available" })],
  ["setUnitLocation(unit in B)", () => setUnitLocation({ unit_id: UNIT_B, lat: 1, lng: 2 })],
  ["approveResponderLink(org B)", () => approveResponderLink({ org_id: ORG_B, user_id: RESPONDER_UID, link_kind: "vendor" })],
  ["revokeResponderLink(link in B)", () => revokeResponderLink(LINK_B)],
];

const orgRoleLookups = (db: FakeSupabase): FakeDbCall[] => db.calls.filter((c) => c.table === "org_roles");

beforeEach(() => {
  vi.resetAllMocks();
  state.notifyResponder.mockResolvedValue(undefined);
});

describe("dispatch: anonymous callers are redirected before any read or write", () => {
  it.each([...actionsAgainstOrgB, ["geocodeAddress", () => geocodeAddress("Main St")] as [string, () => Promise<unknown>]])(
    "%s",
    async (_label, run) => {
      const db = signIn(null);
      await expect(run()).rejects.toThrow("NEXT_REDIRECT:/login");
      expect(db.calls).toHaveLength(0);
      expect(state.notifyResponder).not.toHaveBeenCalled();
    }
  );
});

describe("dispatch: signed in without any org membership", () => {
  it.each(actionsAgainstOrgB)("%s is not authorized for a customer with no org_roles row, and nothing is written", async (_label, run) => {
    const db = signIn(CUSTOMER);
    expect(await run()).toEqual({ ok: false, error: "not authorized" });
    expect(writes(db)).toHaveLength(0);
  });

  it.each(actionsAgainstOrgB)("%s is not authorized for a signed-in user with no role token", async (_label, run) => {
    const db = signIn(NO_ROLE);
    expect(await run()).toEqual({ ok: false, error: "not authorized" });
    expect(writes(db)).toHaveLength(0);
  });
});

describe("dispatch: org A member acting on org B", () => {
  const memberOfA: Membership = { [OPERATOR.id]: { [ORG_A]: ["tenant_admin", "dispatcher"] } };

  it.each(actionsAgainstOrgB)("%s is refused, and the membership check is against the RECORD's org, not the caller's", async (_label, run) => {
    const db = signIn(OPERATOR, memberOfA);
    expect(await run()).toEqual({ ok: false, error: "not authorized" });
    expect(writes(db)).toHaveLength(0);

    const lookups = orgRoleLookups(db);
    expect(lookups).toHaveLength(1);
    expect(lookups[0].filters).toContainEqual(["eq", "user_id", OPERATOR.id]);
    expect(lookups[0].filters).toContainEqual(["eq", "org_id", ORG_B]);
    expect(lookups[0].filters).not.toContainEqual(["eq", "org_id", ORG_A]);
  });

  it("a record that does not exist resolves to no org, and a non-staff caller is refused without a lookup", async () => {
    const db = signIn(OPERATOR, memberOfA);
    const ghost = "9e000000-0000-4000-8000-00000000009e";
    expect(await setUnitStatus({ unit_id: ghost, status: "available" })).toEqual({ ok: false, error: "not authorized" });
    expect(await transitionStatus({ incident_id: ghost, to_status: "closed" })).toEqual({ ok: false, error: "not authorized" });
    expect(await revokeResponderLink(ghost)).toEqual({ ok: false, error: "not authorized" });
    expect(orgRoleLookups(db)).toHaveLength(0);
    expect(writes(db)).toHaveLength(0);
  });
});

describe("dispatch: membership is not enough to grant responder rights", () => {
  const responderInA: Membership = { [OPERATOR.id]: { [ORG_A]: ["responder"] } };

  it("a responder can move their own org's incident along", async () => {
    const db = signIn(OPERATOR, responderInA);
    expect(await transitionStatus({ incident_id: INCIDENT_A, to_status: "on_scene" })).toEqual({ ok: true, data: null });
    const upd = writes(db).find((c) => c.table === "incidents");
    expect(upd).toMatchObject({ op: "update", payload: { status: "on_scene" } });
    expect(upd?.filters).toContainEqual(["eq", "id", INCIDENT_A]);
  });

  it("a responder cannot approve or revoke responder links, even in their own org", async () => {
    const db = signIn(OPERATOR, responderInA);
    expect(await approveResponderLink({ org_id: ORG_A, user_id: OPERATOR.id, link_kind: "operator" })).toEqual({ ok: false, error: "not authorized" });
    expect(await revokeResponderLink(LINK_A)).toEqual({ ok: false, error: "not authorized" });
    expect(writes(db)).toHaveLength(0);
  });

  it.each(["tenant_admin", "dispatcher"])("a %s in org A approves a responder into org A with their own id as approver", async (role) => {
    const db = signIn(OPERATOR, { [OPERATOR.id]: { [ORG_A]: [role] } });
    expect(await approveResponderLink({ org_id: ORG_A, user_id: RESPONDER_UID, link_kind: "contractor", certs: { cdl: true } })).toEqual({ ok: true, data: null });
    const up = writes(db);
    expect(up).toHaveLength(1);
    expect(up[0]).toMatchObject({ table: "org_responder_links", op: "upsert" });
    expect(up[0].payload).toMatchObject({ org_id: ORG_A, user_id: RESPONDER_UID, link_kind: "contractor", approved_by: OPERATOR.id, active: true, certs: { cdl: true } });
  });

  it("a dispatcher in org A revokes a link in org A", async () => {
    const db = signIn(OPERATOR, { [OPERATOR.id]: { [ORG_A]: ["dispatcher"] } });
    expect(await revokeResponderLink(LINK_A)).toEqual({ ok: true, data: null });
    const up = writes(db);
    expect(up).toHaveLength(1);
    expect(up[0]).toMatchObject({ table: "org_responder_links", op: "update", payload: { active: false } });
    expect(up[0].filters).toContainEqual(["eq", "id", LINK_A]);
  });
});

describe("dispatch: happy paths write org-scoped rows", () => {
  const dispatcherInA: Membership = { [OPERATOR.id]: { [ORG_A]: ["dispatcher"] } };

  it("createIncident stamps the verified org and the caller, then falls back to 'received' with no candidates", async () => {
    const db = signIn(OPERATOR, dispatcherInA);
    expect(await createIncident(validIncident(ORG_A))).toEqual({ ok: true, data: { incident_id: INCIDENT_NEW, ref_code: "DSP-0042" } });
    const ins = writes(db).find((c) => c.table === "incidents" && c.op === "insert");
    expect(ins?.payload).toMatchObject({ org_id: ORG_A, ref_code: "DSP-0042", created_by: OPERATOR.id, status: "assigning", reporter_phone: "555-0100" });
    const fallback = writes(db).find((c) => c.table === "incidents" && c.op === "update");
    expect(fallback).toMatchObject({ payload: { status: "received" } });
    expect(fallback?.filters).toContainEqual(["eq", "id", INCIDENT_NEW]);
  });

  it("createIncident rejects malformed input before authentication", async () => {
    const db = signIn(null);
    expect(await createIncident({ ...validIncident(ORG_A), severity: 9 })).toMatchObject({ ok: false });
    expect(await createIncident({ ...validIncident("not-a-uuid") })).toEqual({ ok: false, error: "Invalid organization id" });
    expect(db.calls).toHaveLength(0);
  });

  it("setUnitLocation records the unit's own org on the location row, never one from the caller", async () => {
    const db = signIn(OPERATOR, dispatcherInA);
    expect(await setUnitLocation({ unit_id: UNIT_A, lat: 42.1, lng: -72.59 })).toEqual({ ok: true, data: null });
    const loc = writes(db).find((c) => c.table === "unit_locations");
    expect(loc).toMatchObject({ op: "insert", payload: { org_id: ORG_A, unit_id: UNIT_A, lat: 42.1, lng: -72.59 } });
  });

  it("lockExpiredAssignments passes the verified org to the RPC", async () => {
    const db = signIn(OPERATOR, dispatcherInA);
    expect(await lockExpiredAssignments(ORG_A)).toEqual({ ok: true, data: { locked: 3 } });
    expect(writes(db)).toEqual([expect.objectContaining({ table: "rpc:lock_expired_assignments", payload: { p_org_id: ORG_A } })]);
    expect(await lockExpiredAssignments("nope")).toEqual({ ok: false, error: "invalid id" });
  });

  it("overrideAssignment takes the org off the assignment row and records the override there", async () => {
    const db = signIn(OPERATOR, dispatcherInA);
    const res = await overrideAssignment({ incident_id: INCIDENT_A, current_assignment_id: ASSIGNMENT_A, chosen_unit_id: UNIT_A, reason: "closer unit" });
    expect(res).toEqual({ ok: true, data: { assignment_id: "new-assignment" } });
    const override = writes(db).find((c) => c.table === "assignment_overrides");
    expect(override?.payload).toMatchObject({ org_id: ORG_A, incident_id: INCIDENT_A, chosen_unit_id: UNIT_A, reason: "closer unit", context: { prior: true } });
    const assign = writes(db).find((c) => c.table === "rpc:assign_unit");
    expect(assign?.payload).toMatchObject({ p_incident_id: INCIDENT_A, p_unit_id: UNIT_A, p_by_kind: "user", p_by_user: OPERATOR.id });
    // The chosen unit was checked against the assignment's org, not trusted.
    const unitCheck = db.calls.find((c) => c.table === "units" && c.op === "select");
    expect(unitCheck?.filters).toEqual(expect.arrayContaining([["eq", "id", UNIT_A], ["eq", "org_id", ORG_A]]));
  });

  it("overrideAssignment refuses an incident_id that is not the assignment's own, writing nothing", async () => {
    const db = signIn(OPERATOR, dispatcherInA);
    // Member of A, assignment A, but names org B's incident: the org check on the
    // assignment row alone would have let assign_unit run against INCIDENT_B.
    const res = await overrideAssignment({ incident_id: INCIDENT_B, current_assignment_id: ASSIGNMENT_A, chosen_unit_id: UNIT_A, reason: "x" });
    expect(res).toEqual({ ok: false, error: "assignment not found" });
    expect(writes(db)).toEqual([]);
  });

  it("overrideAssignment refuses a chosen unit from another org, writing nothing", async () => {
    const db = signIn(OPERATOR, dispatcherInA);
    const res = await overrideAssignment({ incident_id: INCIDENT_A, current_assignment_id: ASSIGNMENT_A, chosen_unit_id: UNIT_B, reason: "x" });
    expect(res).toEqual({ ok: false, error: "unit not found" });
    expect(writes(db)).toEqual([]);
  });
});

describe("dispatch: staff run every org", () => {
  it.each([["owner", OWNER], ["staff", STAFF]] as Array<[string, RoleUser]>)("%s passes without an org_roles lookup", async (_label, user) => {
    const db = signIn(user);
    expect(await setUnitStatus({ unit_id: UNIT_B, status: "out_of_service" })).toEqual({ ok: true, data: null });
    expect(await approveResponderLink({ org_id: ORG_B, user_id: RESPONDER_UID, link_kind: "vendor" })).toEqual({ ok: true, data: null });
    expect(orgRoleLookups(db)).toHaveLength(0);
    expect(writes(db).map((c) => c.table)).toEqual(["units", "org_responder_links"]);
  });
});

describe("dispatch: geocodeAddress", () => {
  it("is available to any signed-in user and touches no table", async () => {
    const db = signIn(CUSTOMER);
    expect(await geocodeAddress("Main St")).toEqual({ ok: true, data: [{ label: "1 Main St, Springfield", lat: 42.1, lng: -72.59 }] });
    expect(db.calls).toHaveLength(0);
  });
});
