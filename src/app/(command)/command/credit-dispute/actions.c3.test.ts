import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { OWNER, type RoleUser } from "@/lib/testing/role-users";
import type { StoredClient } from "@/lib/credit-dispute/data/store";
import type { NegativeItem } from "@/lib/credit-dispute/types";
import type { RecipientVersion } from "@/lib/credit-dispute/recipients/registry";
import { legacySeedRegistry } from "@/lib/credit-dispute/recipients/registry";
import type { TemplateApproval } from "@/lib/credit-dispute/approvals/template-approvals";
import { revokeTemplateApproval } from "@/lib/credit-dispute/approvals/template-approvals";
import { approvalsForCurrentWording, verifiedRegistry } from "@/lib/credit-dispute/testing/c3-fixtures";

/**
 * C3 through the REAL server actions:
 *   - C3-011: no verified recipient -> NEEDS_INFORMATION, nothing written
 *   - C3-013/014: gate open but wording unapproved / revoked / changed -> refused
 *   - the round records recipient id+version and the template fingerprint
 *   - C3-020: stale approve / sent / response / evidence review / follow-up are
 *     refused from a page that loaded an older version; a writer that lands
 *     between read and write is caught by compare-and-swap
 * The CROA gate is stubbed OPEN in this file only (state.gateOpen).
 */

const state = vi.hoisted(() => ({ ssr: null as unknown, gateOpen: true }));

vi.mock("@/lib/supabase-server", () => ({ createSSRClient: async () => state.ssr }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));
vi.mock("../../../../../shared/compliance-gates/gate", async (orig) => {
  const real = await orig<typeof import("../../../../../shared/compliance-gates/gate")>();
  return {
    ...real,
    requireGate: (id: Parameters<typeof real.requireGate>[0]) => (state.gateOpen ? undefined : real.requireGate(id)),
    isGateOpen: (id: Parameters<typeof real.isGateOpen>[0]) => (state.gateOpen ? true : real.isGateOpen(id)),
  };
});

import {
  authorizeFollowUpRound,
  generateDisputeRound,
  getDisputeClientVersioned,
  recordDisputeResponse,
  recordRoundSent,
  reviewDisputeRound,
  reviewEvidenceDocument,
} from "./actions";
import { CONFLICT_ERROR } from "@/lib/credit-dispute/data/errors";
import { templateFingerprint } from "@/lib/credit-dispute/approvals/template-approvals";

const ID = "c1000000-0000-4000-8000-000000000003";

const fixture = (): StoredClient => ({
  profile: { id: ID, fullName: "Fixture Customer", currentAddress: { street: "1 St", city: "C", state: "VA", zip: "22150" } },
  source: "myfreescorenow",
  negativeItems: [
    { id: "i1", bureau: "experian", itemType: "charge_off", furnisherName: "Example Bank", accountNumberMasked: "****1111", reportedBalanceCents: 120000, dateOfFirstDelinquency: "2025-06-01", currentRound: 0, status: "draft" } as NegativeItem,
  ],
  disputeRounds: [],
  importedAt: "2026-09-01T00:00:00.000Z",
  assessments: { i1: { accuracy: "inaccurate", basis: "wrong_balance" } },
  assertions: [
    {
      id: "a1", negativeItemId: "i1", category: "BALANCE_INCORRECT", basis: "wrong_balance",
      statement: "The balance is $400 more than I owe; my March statement shows the payment.",
      originalStatement: "The balance is $400 more than I owe; my March statement shows the payment.",
      source: "customer", customerConfirmed: true, evidenceIds: [],
      confirmation: { confirmedAt: "2026-09-20T00:00:00.000Z", actor: "customer:u", channel: "customer_portal", statementHash: "h", category: "BALANCE_INCORRECT", negativeItemId: "i1" },
      recordedBy: "customer:u", recordedAt: "2026-09-20T00:00:00.000Z", status: "active",
    },
  ],
  evidence: [
    { id: "ev1", kind: "other", description: "March statement", negativeItemId: "i1", source: "customer", uploadedBy: "customer:u", uploadedAt: "2026-09-20T00:00:00.000Z", reviewState: "pending_review" },
  ],
});

interface World {
  registry: RecipientVersion[];
  approvals: TemplateApproval[];
  /** Simulate another writer landing between our read and our write. */
  interleave?: () => void;
}

function db(user: RoleUser | null, rows: Record<string, StoredClient>, world: World) {
  const table: Record<string, { payload: StoredClient; updated_at: string }> = {};
  let tick = 1;
  for (const [id, payload] of Object.entries(rows)) table[id] = { payload: structuredClone(payload), updated_at: `v${tick++}` };
  const fake = makeFakeSupabase((call) => {
    if (call.table === "credit_recipients") return { data: world.registry.map((record) => ({ record })) };
    if (call.table === "credit_template_approvals") return { data: world.approvals.map((record) => ({ record })) };
    if (call.table !== "dispute_clients") return undefined;
    const eq = (col: string) => call.filters.find((f) => f[0] === "eq" && f[1] === col)?.[2] as string | undefined;
    const id = eq("id");
    if (call.op === "select" && id) return { data: table[id] ? { id, payload: table[id].payload, updated_at: table[id].updated_at } : null };
    if (call.op === "update" && id) {
      world.interleave?.();
      world.interleave = undefined;
      const row = table[id];
      if (!row || row.updated_at !== eq("updated_at")) return { data: [] };
      row.payload = (call.payload as { payload: StoredClient }).payload;
      row.updated_at = `v${tick++}`;
      return { data: [{ id }] };
    }
    return { error: null };
  }, { user });
  state.ssr = fake;
  const bump = () => {
    table[ID].updated_at = `v${tick++}`;
  };
  return { fake: fake as FakeSupabase, table, bump };
}

const world = (over: Partial<World> = {}): World => ({ registry: verifiedRegistry(), approvals: approvalsForCurrentWording(), ...over });

beforeEach(() => {
  state.gateOpen = true;
});

describe("C3-011: a letter needs a verified recipient", () => {
  it("an empty registry makes the item NEEDS_INFORMATION and writes nothing", async () => {
    const { fake } = db(OWNER, { [ID]: fixture() }, world({ registry: [] }));
    const g = await generateDisputeRound(ID);
    if (!g.ok) throw new Error(g.error);
    expect(g.data.kind).toBe("nothing_ready");
    const nd = g.data.plan.notDisputed.find((n) => n.negativeItemId === "i1")!;
    expect(nd.action).toBe("needs_information");
    expect(nd.missing?.map((m) => m.code)).toEqual(["recipient_missing"]);
    expect(g.data.plan.counts.letters).toBe(0);
    expect(writes(fake).filter((w) => w.op === "update")).toHaveLength(0);
  });

  it("the unverified legacy seed is not enough", async () => {
    db(OWNER, { [ID]: fixture() }, world({ registry: legacySeedRegistry() }));
    const g = await generateDisputeRound(ID);
    if (!g.ok) throw new Error(g.error);
    expect(g.data.kind).toBe("nothing_ready");
    expect(g.data.plan.notDisputed[0].missing?.map((m) => m.code)).toEqual(["recipient_unverified"]);
  });

  it("the recipient check runs before the gate: with the gate CLOSED, a missing recipient still reads as needs-information", async () => {
    state.gateOpen = false;
    db(OWNER, { [ID]: fixture() }, world({ registry: [] }));
    const g = await generateDisputeRound(ID);
    if (!g.ok) throw new Error(g.error);
    expect(g.data.kind).toBe("nothing_ready");
  });
});

describe("C3-013/014: template approval is required even with the gate open", () => {
  it("no approval -> template_unapproved, nothing written", async () => {
    const { fake } = db(OWNER, { [ID]: fixture() }, world({ approvals: [] }));
    const g = await generateDisputeRound(ID);
    if (!g.ok) throw new Error(g.error);
    expect(g.data).toMatchObject({ kind: "template_unapproved" });
    if (g.data.kind === "template_unapproved") expect(g.data.detail).toMatch(/initial_611: no approval/);
    expect(writes(fake).filter((w) => w.op === "update")).toHaveLength(0);
  });

  it("an approval for DIFFERENT wording does not count", async () => {
    const stale = approvalsForCurrentWording().map((a) => (a.templateId === "letter:initial_611" ? { ...a, contentHash: "f".repeat(64) } : a));
    db(OWNER, { [ID]: fixture() }, world({ approvals: stale }));
    const g = await generateDisputeRound(ID);
    if (!g.ok) throw new Error(g.error);
    expect(g.data).toMatchObject({ kind: "template_unapproved" });
    if (g.data.kind === "template_unapproved") expect(g.data.detail).toMatch(/wording changed/);
  });

  it("a revoked approval does not count", async () => {
    const revoked = revokeTemplateApproval(approvalsForCurrentWording(), "appr-initial_611", OWNER.email);
    db(OWNER, { [ID]: fixture() }, world({ approvals: revoked }));
    const g = await generateDisputeRound(ID);
    if (!g.ok) throw new Error(g.error);
    expect(g.data).toMatchObject({ kind: "template_unapproved" });
  });

  it("with the gate closed the answer is still 'gated' — approvals never open the gate", async () => {
    state.gateOpen = false;
    db(OWNER, { [ID]: fixture() }, world());
    const g = await generateDisputeRound(ID);
    if (!g.ok) throw new Error(g.error);
    expect(g.data.kind).toBe("gated");
  });

  it("an approved, addressed round records the recipient version and the exact fingerprint", async () => {
    const { table } = db(OWNER, { [ID]: fixture() }, world());
    const g = await generateDisputeRound(ID);
    if (!g.ok) throw new Error(g.error);
    expect(g.data.kind).toBe("stored");
    expect(table[ID].payload.disputeRounds[0]).toMatchObject({
      recipientId: "CRA:experian",
      recipientVersion: 1,
      templateFingerprint: templateFingerprint("initial_611"),
      status: "needs_review",
    });
  });
});

describe("C3-020: concurrency", () => {
  async function withDraft() {
    const w = world();
    const h = db(OWNER, { [ID]: fixture() }, w);
    const g = await generateDisputeRound(ID);
    if (!g.ok || g.data.kind !== "stored") throw new Error("setup");
    const v = await getDisputeClientVersioned(ID);
    if (!v.ok || !v.data) throw new Error("setup");
    return { ...h, w, roundId: h.table[ID].payload.disputeRounds[0].id, version: v.data.version! };
  }

  it("two tabs: approving from a page that loaded an older version is refused and changes nothing", async () => {
    const { table, roundId, version, bump } = await withDraft();
    bump(); // the other tab saved something
    const before = structuredClone(table[ID].payload);
    expect(await reviewDisputeRound(ID, roundId, { kind: "approve" }, version)).toEqual({ ok: false, error: CONFLICT_ERROR });
    expect(table[ID].payload).toEqual(before);
  });

  it("the current version is accepted", async () => {
    const { roundId, version } = await withDraft();
    expect((await reviewDisputeRound(ID, roundId, { kind: "approve" }, version)).ok).toBe(true);
  });

  it("stale 'sent', 'response', 'follow-up' and 'evidence review' are all refused", async () => {
    const { table, roundId, bump } = await withDraft();
    expect((await reviewDisputeRound(ID, roundId, { kind: "approve" })).ok).toBe(true);
    const seen = table[ID].updated_at;
    bump();
    const before = structuredClone(table[ID].payload);
    expect(await recordRoundSent(ID, roundId, { sentAt: "2026-09-21T10:00:00.000Z", method: "mail", recipient: "Experian" }, seen)).toEqual({ ok: false, error: CONFLICT_ERROR });
    expect(await recordDisputeResponse(ID, roundId, { outcome: "verified", summary: "x", receivedAt: "2026-09-21T15:00:00.000Z" }, seen)).toEqual({ ok: false, error: CONFLICT_ERROR });
    expect(await authorizeFollowUpRound(ID, roundId, "The response did not address the March payment on the statement.", seen)).toEqual({ ok: false, error: CONFLICT_ERROR });
    const rev = await reviewEvidenceDocument(ID, "ev1", "accepted", seen);
    expect(rev).toEqual({ ok: false, error: CONFLICT_ERROR });
    expect(table[ID].payload).toEqual(before);
  });

  it("a writer that lands between our read and our write (customer vs operator) is caught by compare-and-swap", async () => {
    const { table, roundId, w, bump } = await withDraft();
    w.interleave = bump; // e.g. the customer saved a statement mid-request
    const before = structuredClone(table[ID].payload);
    expect(await reviewDisputeRound(ID, roundId, { kind: "approve" })).toEqual({ ok: false, error: CONFLICT_ERROR });
    expect(table[ID].payload).toEqual(before);
  });

  it("an approval covers exactly the text it saw: editing afterwards needs a new approval before 'sent'", async () => {
    const { roundId } = await withDraft();
    expect((await reviewDisputeRound(ID, roundId, { kind: "approve" })).ok).toBe(true);
    // An edit after approval is refused outright (approved text is fixed) ...
    const edit = await reviewDisputeRound(ID, roundId, { kind: "edit", subject: "s", body: "a different body" } as never);
    expect(edit.ok).toBe(false);
  });
});
