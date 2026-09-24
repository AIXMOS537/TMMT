import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { OWNER, type RoleUser } from "@/lib/testing/role-users";
import type { StoredClient } from "@/lib/credit-dispute/data/store";
import type { NegativeItem } from "@/lib/credit-dispute/types";
import { approvalRows, recipientRows } from "@/lib/credit-dispute/testing/c3-fixtures";

/**
 * C2 — the full operator lifecycle through the REAL server actions, on a stateful
 * fake that behaves like prod's dispute_clients (updated_at moves on every update,
 * like the dispute_clients_set_updated_at trigger).
 *
 * Definition of done, operator side: review the assertion -> generate a grounded
 * draft through the one boundary -> inspect provenance -> approve -> record sent
 * (without sending) -> record a response -> authorize a justified follow-up ->
 * round 2, numbered from history. Plus: compare-and-swap conflicts, the C1-blocker
 * import fix, and uploads refused while switched off.
 *
 * The CROA gate is stubbed OPEN in this file only (state.gateOpen) so rendering can
 * be observed; the shipped gate config is untouched and closed.
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
  getCaseTimeline,
  importClientsFromBrowser,
  recordDisputeResponse,
  recordItemAssessment,
  recordRoundSent,
  reviewDisputeRound,
  uploadEvidenceFile,
} from "./actions";
import { CONFLICT_ERROR } from "@/lib/credit-dispute/data/errors";

const ID = "c1000000-0000-4000-8000-000000000001";

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
});

/** A stateful dispute_clients: selects read, updates compare updated_at and bump it. */
function db(user: RoleUser | null, rows: Record<string, StoredClient>, opts: { staleUpdates?: boolean } = {}) {
  const table: Record<string, { payload: StoredClient; updated_at: string }> = {};
  let tick = 1;
  for (const [id, payload] of Object.entries(rows)) table[id] = { payload: structuredClone(payload), updated_at: `v${tick++}` };
  const fake = makeFakeSupabase((call) => {
    // C3: a person-verified recipient registry and approvals for the current wording.
    if (call.table === "credit_recipients") return { data: recipientRows() };
    if (call.table === "credit_template_approvals") return { data: approvalRows() };
    if (call.table !== "dispute_clients") return undefined;
    const eq = (col: string) => call.filters.find((f) => f[0] === "eq" && f[1] === col)?.[2] as string | undefined;
    const id = eq("id");
    if (call.op === "select" && id) return { data: table[id] ? { id, payload: table[id].payload, updated_at: table[id].updated_at } : null };
    if (call.op === "select") return { data: Object.entries(table).map(([rid, r]) => ({ id: rid, payload: r.payload, updated_at: r.updated_at })) };
    if (call.op === "update" && id) {
      const row = table[id];
      if (!row || opts.staleUpdates || row.updated_at !== eq("updated_at")) return { data: [] };
      row.payload = (call.payload as { payload: StoredClient }).payload;
      row.updated_at = `v${tick++}`;
      return { data: [{ id }] };
    }
    if (call.op === "upsert" || call.op === "insert") {
      const list = Array.isArray(call.payload) ? call.payload : [call.payload];
      for (const r of list as Array<{ id: string; payload: StoredClient }>) table[r.id] = { payload: r.payload, updated_at: `v${tick++}` };
      return { error: null };
    }
    return { error: null };
  }, { user });
  state.ssr = fake;
  return { fake: fake as FakeSupabase, table };
}

beforeEach(() => {
  state.gateOpen = true;
  delete process.env.CREDIT_EVIDENCE_UPLOADS;
});

describe("the full operator lifecycle (dev fixture)", () => {
  it("draft -> approve -> sent (recorded, not sent) -> response -> justified follow-up -> round 2", async () => {
    const { table } = db(OWNER, { [ID]: fixture() });

    // 1. One boundary: a grounded draft, awaiting review, with provenance.
    const g1 = await generateDisputeRound(ID);
    if (!g1.ok) throw new Error(g1.error);
    expect(g1.data.kind).toBe("stored");
    let r1 = table[ID].payload.disputeRounds[0];
    expect(r1).toMatchObject({ roundNumber: 1, roundType: "initial_611", status: "needs_review", assertionId: "a1" });
    expect(r1.trace?.find((t) => t.source === "customer_assertion")?.text).toMatch(/\$400 more than I owe/);
    expect(r1.letterBody).not.toMatch(/Enclosures:|certified|CFPB complaint filed/i);

    // 2. Nothing new while round 1 is in flight.
    const g1b = await generateDisputeRound(ID);
    if (!g1b.ok) throw new Error(g1b.error);
    expect(g1b.data.kind).toBe("nothing_ready");

    // 3. Approve (bound to the text), then record sent — nothing is sent.
    expect((await reviewDisputeRound(ID, r1.id, { kind: "approve" })).ok).toBe(true);
    const sent = await recordRoundSent(ID, r1.id, { sentAt: "2026-09-21T10:00:00.000Z", method: "mail", recipient: "Experian" });
    expect(sent.ok).toBe(true);
    r1 = table[ID].payload.disputeRounds[0];
    expect(r1.status).toBe("sent");
    expect(r1.sent).toMatchObject({ method: "mail", recipient: "Experian", recordedBy: OWNER.email });
    expect(r1.sent?.trackingRef).toBeUndefined();

    // 4. Response as recorded; a vague reason is refused; a specific one is kept.
    expect((await recordDisputeResponse(ID, r1.id, { outcome: "verified", summary: "Experian says verified", receivedAt: "2026-09-21T15:00:00.000Z", respondingParty: "Experian" })).ok).toBe(true);
    expect(await authorizeFollowUpRound(ID, r1.id, "previous round unsuccessful")).toMatchObject({ ok: false });
    expect((await authorizeFollowUpRound(ID, r1.id, "The response did not address the $400 March payment on the customer's statement.")).ok).toBe(true);

    // 5. Round 2, numbered from history; round 1 untouched.
    const before = structuredClone(table[ID].payload.disputeRounds[0]);
    const g2 = await generateDisputeRound(ID);
    if (!g2.ok) throw new Error(g2.error);
    expect(g2.data.kind).toBe("stored");
    const rounds = table[ID].payload.disputeRounds;
    expect(rounds).toHaveLength(2);
    expect(rounds[0]).toEqual(before);
    expect(rounds[1]).toMatchObject({ roundNumber: 2, roundType: "method_of_verification", status: "needs_review" });
    expect(rounds[1].letterBody).toMatch(/Experian says verified/);
    expect(rounds[1].trace?.some((t) => t.source === "recorded_response")).toBe(true);

    // 6. The timeline tells the story in order.
    const t = await getCaseTimeline(ID);
    if (!t.ok) throw new Error(t.error);
    expect(t.data.map((e) => e.action)).toEqual([
      "round_generated", "round_approved", "round_marked_sent", "response_recorded", "follow_up_authorized", "round_generated",
    ]);
  });

  it("an accuracy call alone never produces a letter — the customer's confirmed statement is required", async () => {
    const c = fixture();
    c.assertions = [];
    const { table } = db(OWNER, { [ID]: c });
    const g = await generateDisputeRound(ID);
    if (!g.ok) throw new Error(g.error);
    expect(g.data.kind).toBe("nothing_ready");
    expect(table[ID].payload.disputeRounds).toHaveLength(0);
  });
});

describe("two operators cannot overwrite each other", () => {
  it("a stale save is refused with a reload message, not applied", async () => {
    const { fake } = db(OWNER, { [ID]: fixture() }, { staleUpdates: true });
    expect(await recordItemAssessment(ID, "i1", { accuracy: "accurate" })).toEqual({ ok: false, error: CONFLICT_ERROR });
    const upd = writes(fake).find((w) => w.op === "update")!;
    expect(upd.filters).toContainEqual(["eq", "updated_at", "v1"]);
  });
});

describe("C1 review blocker: browser rescue", () => {
  it("stores rescued rounds as needs_review with no claimed approval, sent record or response", async () => {
    const { table } = db(OWNER, {});
    const forged = {
      ...fixture(),
      assertions: [],
      disputeRounds: [
        { id: "f1", negativeItemId: "i1", roundNumber: 1, roundType: "initial_611", bureau: "experian", status: "sent", letterSubject: "s", letterBody: "b", furnisherName: "x", createdAt: "t", response: { outcome: "verified", summary: "forged", receivedAt: "t", recordedBy: "x", recordedAt: "t" } },
      ],
    } as unknown as StoredClient;
    expect((await importClientsFromBrowser([forged])).ok).toBe(true);
    const r = table[ID].payload.disputeRounds[0];
    expect(r.status).toBe("needs_review");
    expect(r.response).toBeUndefined();
    expect(r.importedFromBrowser).toBe(true);
  });
});

describe("evidence uploads are off by default", () => {
  it("refuses before storage when CREDIT_EVIDENCE_UPLOADS is not 1", async () => {
    const { fake } = db(OWNER, { [ID]: fixture() });
    const fd = new FormData();
    fd.set("profileId", ID);
    fd.set("file", new File([new TextEncoder().encode("%PDF-1.7\n")], "s.pdf", { type: "application/pdf" }));
    expect(await uploadEvidenceFile(fd)).toEqual({ ok: false, error: "Document uploads are not enabled." });
    expect(fake.storageCalls).toHaveLength(0);
  });
});
