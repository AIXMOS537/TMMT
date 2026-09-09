import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { NON_OWNER_USERS, OWNER, type RoleUser } from "@/lib/testing/role-users";
import type { StoredClient } from "@/lib/credit-dispute/data/store";
import type { DisputeLetterBatch } from "@/lib/credit-dispute/engine/protocol";

/**
 * T-03 for the credit dispute desk. The book holds legal names, DOB, SSN last
 * four, addresses and bureau scores. The gate is requireOwner(): anonymous is
 * redirected, and everyone who is not `admin` — including internal staff and
 * VAs — gets "Not authorized." with no query issued. RLS
 * (dispute_clients_admin_only) is the real wall; this is the app-side copy.
 */
const state = vi.hoisted(() => ({ ssr: null as unknown }));

vi.mock("@/lib/supabase-server", () => ({ createSSRClient: async () => state.ssr }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

import {
  addDisputeRoundsForClient,
  getDisputeClient,
  importClientsFromBrowser,
  listDisputeClients,
  upsertDisputeClient,
} from "./actions";

const CLIENT_ID = "c1000000-0000-4000-8000-000000000001";
const OTHER_ID = "c2000000-0000-4000-8000-000000000002";

const client = (id: string): StoredClient =>
  ({
    profile: { id, fullName: "Test Client", email: "client@example.com" },
    source: "manual",
    negativeItems: [],
    disputeRounds: [],
    importedAt: "2026-09-01T00:00:00.000Z",
  }) as unknown as StoredClient;

const batch: DisputeLetterBatch = {
  negativeItemId: "ni-1",
  roundNumber: 1,
  roundType: "initial",
  bureau: "equifax",
  status: "drafted",
  furnisherName: "Example Bank",
  letter: { subject: "Dispute", body: "Please investigate." },
} as unknown as DisputeLetterBatch;

function signIn(user: RoleUser | null, rows: Record<string, StoredClient> = {}) {
  state.ssr = makeFakeSupabase((call) => {
    if (call.table !== "dispute_clients") return undefined;
    const eqId = call.filters.find((f) => f[0] === "eq" && f[1] === "id")?.[2] as string | undefined;
    const inIds = call.filters.find((f) => f[0] === "in" && f[1] === "id")?.[2] as string[] | undefined;
    if (call.op === "select" && eqId) return { data: rows[eqId] ? { id: eqId, payload: rows[eqId] } : null };
    if (call.op === "select" && inIds) return { data: inIds.filter((id) => rows[id]).map((id) => ({ id })) };
    if (call.op === "select") return { data: Object.entries(rows).map(([id, payload]) => ({ id, payload })) };
    return { error: null };
  }, { user });
  return state.ssr as FakeSupabase;
}

const everyAction: Array<[string, () => Promise<unknown>]> = [
  ["listDisputeClients", () => listDisputeClients()],
  ["getDisputeClient", () => getDisputeClient(CLIENT_ID)],
  ["upsertDisputeClient", () => upsertDisputeClient(client(CLIENT_ID))],
  ["addDisputeRoundsForClient", () => addDisputeRoundsForClient(CLIENT_ID, [batch])],
  ["importClientsFromBrowser", () => importClientsFromBrowser([client(CLIENT_ID)])],
];

beforeEach(() => {
  vi.resetAllMocks();
});

describe("credit dispute desk: anonymous", () => {
  it.each(everyAction)("%s redirects to login before any query", async (_label, run) => {
    const db = signIn(null);
    await expect(run()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(db.calls).toHaveLength(0);
  });
});

describe("credit dispute desk: signed in but not the owner", () => {
  const cases = NON_OWNER_USERS.flatMap(([role, user]) => everyAction.map(([action, run]) => [role, action, user, run] as const));

  it.each(cases)("%s calling %s gets Not authorized. and no query is issued", async (_role, _action, user, run) => {
    const db = signIn(user, { [CLIENT_ID]: client(CLIENT_ID) });
    expect(await run()).toEqual({ ok: false, error: "Not authorized." });
    expect(db.calls).toHaveLength(0);
  });
});

describe("credit dispute desk: owner", () => {
  it("lists and fetches through the request-scoped client", async () => {
    const db = signIn(OWNER, { [CLIENT_ID]: client(CLIENT_ID) });
    expect(await listDisputeClients()).toEqual({ ok: true, data: [client(CLIENT_ID)] });
    expect(await getDisputeClient(CLIENT_ID)).toEqual({ ok: true, data: client(CLIENT_ID) });
    expect(await getDisputeClient(OTHER_ID)).toEqual({ ok: true, data: null });
    expect(writes(db)).toHaveLength(0);
    expect(db.calls.every((c) => c.table === "dispute_clients")).toBe(true);
  });

  it("upserts with the searchable columns copied from the payload", async () => {
    const db = signIn(OWNER);
    expect(await upsertDisputeClient(client(CLIENT_ID))).toEqual({ ok: true, data: client(CLIENT_ID) });
    const up = writes(db);
    expect(up).toHaveLength(1);
    expect(up[0]).toMatchObject({ table: "dispute_clients", op: "upsert" });
    expect(up[0].payload).toMatchObject({ id: CLIENT_ID, client_name: "Test Client", email: "client@example.com", source: "manual", payload: client(CLIENT_ID) });
  });

  it("refuses a client without an id before writing", async () => {
    const db = signIn(OWNER);
    expect(await upsertDisputeClient({ ...client(CLIENT_ID), profile: {} } as unknown as StoredClient)).toEqual({ ok: false, error: "Client is missing an id." });
    expect(writes(db)).toHaveLength(0);
  });

  it("appends dispute rounds onto the stored client", async () => {
    const db = signIn(OWNER, { [CLIENT_ID]: client(CLIENT_ID) });
    const res = await addDisputeRoundsForClient(CLIENT_ID, [batch]);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    expect(res.data.disputeRounds).toHaveLength(1);
    expect(res.data.disputeRounds[0]).toMatchObject({ negativeItemId: "ni-1", bureau: "equifax", letterBody: "Please investigate." });
    const up = writes(db);
    expect(up).toHaveLength(1);
    expect((up[0].payload as { payload: StoredClient }).payload.disputeRounds).toHaveLength(1);
  });

  it("adding rounds to an unknown client writes nothing", async () => {
    const db = signIn(OWNER);
    expect(await addDisputeRoundsForClient(OTHER_ID, [batch])).toEqual({ ok: false, error: "Client not found." });
    expect(writes(db)).toHaveLength(0);
  });

  it("browser rescue inserts only ids not already present, and never overwrites", async () => {
    const db = signIn(OWNER, { [CLIENT_ID]: client(CLIENT_ID) });
    const res = await importClientsFromBrowser([client(CLIENT_ID), client(OTHER_ID), { profile: {} } as unknown as StoredClient]);
    expect(res).toEqual({ ok: true, data: { imported: 1, skipped: 1 } });
    const up = writes(db);
    expect(up).toHaveLength(1);
    expect(up[0].op).toBe("insert");
    expect((up[0].payload as Array<{ id: string }>).map((r) => r.id)).toEqual([OTHER_ID]);
  });

  it("browser rescue with nothing new writes nothing", async () => {
    const db = signIn(OWNER, { [CLIENT_ID]: client(CLIENT_ID) });
    expect(await importClientsFromBrowser([client(CLIENT_ID)])).toEqual({ ok: true, data: { imported: 0, skipped: 1 } });
    expect(await importClientsFromBrowser([])).toEqual({ ok: true, data: { imported: 0, skipped: 0 } });
    expect(writes(db)).toHaveLength(0);
  });
});
