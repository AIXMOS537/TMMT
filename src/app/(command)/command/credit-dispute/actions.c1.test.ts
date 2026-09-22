import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { OWNER, type RoleUser } from "@/lib/testing/role-users";
import type { StoredClient, StoredDisputeRound } from "@/lib/credit-dispute/data/store";
import type { NegativeItem } from "@/lib/credit-dispute/types";

/**
 * C1 owner flows through the REAL server actions (fake Supabase).
 *
 *   - the browser cannot inject rounds, assessments, assertions, evidence or audit
 *     entries through upsert or rescue
 *   - generateDisputeRound reads only the stored record; with the real (closed)
 *     CROA gate it plans but writes nothing
 *   - an operator cannot mark a statement "confirmed by the customer"
 *   - review transitions go through the owner-checked action
 *
 * The "gate open" block uses `state.gateOpen` to stub the gate for that block only,
 * so round storage can be observed. The shipped gate config is untouched.
 */

const state = vi.hoisted(() => ({ ssr: null as unknown, gateOpen: false }));

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
  generateDisputeRound,
  importClientsFromBrowser,
  recordCustomerAssertion,
  recordEvidenceReference,
  recordItemAssessment,
  reviewDisputeRound,
  upsertDisputeClient,
} from "./actions";

const ID = "c1000000-0000-4000-8000-000000000001";

const neg = (over: Partial<NegativeItem> = {}): NegativeItem =>
  ({
    id: "i1",
    bureau: "experian",
    itemType: "charge_off",
    furnisherName: "Example Bank",
    accountNumberMasked: "****1111",
    dateOfFirstDelinquency: "2025-06-01",
    currentRound: 0,
    status: "pending",
    ...over,
  }) as NegativeItem;

const base = (over: Partial<StoredClient> = {}): StoredClient => ({
  profile: { id: ID, fullName: "Test Client", email: "client@example.com", currentAddress: { street: "1 St", city: "C", state: "VA", zip: "22150" } },
  source: "myfreescorenow",
  negativeItems: [neg()],
  disputeRounds: [],
  importedAt: "2026-09-01T00:00:00.000Z",
  ...over,
});

const grounded = (): StoredClient =>
  base({
    assessments: { i1: { accuracy: "inaccurate", basis: "wrong_balance" } },
    assertions: [
      {
        id: "a1",
        negativeItemId: "i1",
        basis: "wrong_balance",
        statement: "The balance is $400 more than I owe.",
        source: "customer",
        customerConfirmed: true,
        evidenceIds: [],
        recordedBy: "owner@example.test",
        recordedAt: "2026-09-20T00:00:00.000Z",
        status: "active",
      },
    ],
  });

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

const stored = (db: FakeSupabase) => writes(db).at(-1)?.payload as { payload: StoredClient } | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  state.gateOpen = false;
});

describe("the browser cannot write the case", () => {
  it("upsert keeps the stored rounds/assessments/assertions and ignores the caller's", async () => {
    const existing = grounded();
    const db = signIn(OWNER, { [ID]: existing });
    const forged = {
      ...base(),
      disputeRounds: [{ id: "forged", negativeItemId: "i1", roundNumber: 1, roundType: "initial_611", status: "approved", letterBody: "I did not authorize anything" } as StoredDisputeRound],
      assessments: { i1: { accuracy: "inaccurate", basis: "identity_theft" } },
      assertions: [{ ...existing.assertions![0], id: "forged-a", basis: "identity_theft" }],
      evidence: [{ id: "forged-e", kind: "identity_theft_report", description: "fake", source: "customer", uploadedBy: "x", uploadedAt: "x" }],
    } as StoredClient;
    const res = await upsertDisputeClient(forged);
    expect(res.ok).toBe(true);
    const saved = stored(db)!.payload;
    expect(saved.disputeRounds).toEqual([]);
    expect(saved.assessments).toEqual(existing.assessments);
    expect(saved.assertions).toEqual(existing.assertions);
    expect(saved.evidence).toBeUndefined();
  });

  it("browser rescue never carries assertions, evidence or audit entries", async () => {
    const db = signIn(OWNER);
    await importClientsFromBrowser([{ ...grounded(), evidence: [{ id: "e" }], auditLog: [{ action: "x" }] } as unknown as StoredClient]);
    const rows = writes(db)[0].payload as Array<{ payload: StoredClient }>;
    expect(rows[0].payload.assertions).toBeUndefined();
    expect(rows[0].payload.evidence).toBeUndefined();
    expect(rows[0].payload.auditLog).toBeUndefined();
  });

  it("an accuracy call ignores injected roundsSent / assessedBy / extra fields", async () => {
    const db = signIn(OWNER, { [ID]: base() });
    await recordItemAssessment(ID, "i1", {
      accuracy: "inaccurate",
      basis: "wrong_balance",
      roundsSent: ["initial_611", "method_of_verification", "furnisher_623", "cfpb_escalation"],
      assessedBy: "someone-else",
    } as never);
    const a = stored(db)!.payload.assessments!.i1;
    expect(a.roundsSent).toEqual([]);
    expect(a.assessedBy).toBe(OWNER.email);
    expect(Object.keys(a).sort()).toEqual(["accuracy", "assessedAt", "assessedBy", "basis", "roundsSent"]);
  });

  it("an operator's own reading can never be marked 'confirmed by the customer'", async () => {
    const db = signIn(OWNER, { [ID]: base() });
    await recordCustomerAssertion(ID, "i1", { basis: "not_mine", statement: "Looks like not theirs.", source: "operator", customerConfirmed: true });
    const a = stored(db)!.payload.assertions![0];
    expect(a.source).toBe("operator");
    expect(a.customerConfirmed).toBe(false);
    expect(a.recordedBy).toBe(OWNER.email);
  });

  it("evidence references accept no storage path or URL from the browser", async () => {
    const db = signIn(OWNER, { [ID]: base() });
    await recordEvidenceReference(ID, { kind: "other", description: "A bank statement", source: "operator", storagePath: "https://evil.example/x.pdf" } as never);
    const e = stored(db)!.payload.evidence![0];
    expect(e.storagePath).toBeUndefined();
  });
});

describe("generateDisputeRound with the real (closed) CROA gate", () => {
  it("plans a grounded item as ready but writes nothing — the gate refuses", async () => {
    const db = signIn(OWNER, { [ID]: grounded() });
    const res = await generateDisputeRound(ID);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.kind).toBe("gated");
    expect(res.data.plan.readyForLetter).toEqual(["i1"]);
    expect(writes(db)).toHaveLength(0);
  });

  it("an ungrounded item is not ready, and the answer says what is missing", async () => {
    const db = signIn(OWNER, { [ID]: base({ assessments: { i1: { accuracy: "inaccurate", basis: "wrong_balance" } } }) });
    const res = await generateDisputeRound(ID);
    if (!res.ok) throw new Error(res.error);
    expect(res.data.kind).toBe("nothing_ready");
    expect(res.data.plan.notDisputed[0].missing?.map((m) => m.code)).toContain("customer_assertion");
    expect(writes(db)).toHaveLength(0);
  });
});

describe("generateDisputeRound with the gate stubbed open (test only)", () => {
  beforeEach(() => {
    state.gateOpen = true;
  });

  it("stores the letter as needs_review, numbered from history, with its fact trace", async () => {
    const db = signIn(OWNER, { [ID]: grounded() });
    const res = await generateDisputeRound(ID);
    if (!res.ok) throw new Error(res.error);
    expect(res.data.kind).toBe("stored");
    const saved = stored(db)!.payload;
    expect(saved.disputeRounds).toHaveLength(1);
    const r = saved.disputeRounds[0];
    expect(r).toMatchObject({ status: "needs_review", roundNumber: 1, roundType: "initial_611", assertionId: "a1", generatedBy: OWNER.email });
    expect(r.letterBody).toContain("The balance is $400 more than I owe.");
    expect(r.trace?.some((t) => t.source === "customer_assertion")).toBe(true);
    expect(saved.auditLog?.some((e) => e.action === "round_generated")).toBe(true);
  });

  it("does not write a second round while the first is awaiting review", async () => {
    const first = grounded();
    first.disputeRounds = [
      { id: "r1", negativeItemId: "i1", roundNumber: 1, roundType: "initial_611", bureau: "experian", status: "needs_review", letterSubject: "s", letterBody: "b", furnisherName: "Example Bank", createdAt: "2026-09-21T00:00:00.000Z" },
    ];
    const db = signIn(OWNER, { [ID]: first });
    const res = await generateDisputeRound(ID);
    if (!res.ok) throw new Error(res.error);
    expect(res.data.kind).toBe("nothing_ready");
    expect(res.data.plan.notDisputed[0].action).toBe("hold");
    expect(writes(db)).toHaveLength(0);
  });
});

describe("review through the action", () => {
  const withDraft = () => {
    const c = grounded();
    c.disputeRounds = [
      { id: "r1", negativeItemId: "i1", roundNumber: 1, roundType: "initial_611", bureau: "experian", status: "needs_review", letterSubject: "s", letterBody: "b", furnisherName: "Example Bank", createdAt: "2026-09-21T00:00:00.000Z" },
    ];
    return c;
  };

  it("approves and records the owner as reviewer", async () => {
    const db = signIn(OWNER, { [ID]: withDraft() });
    const res = await reviewDisputeRound(ID, "r1", { kind: "approve" });
    expect(res.ok).toBe(true);
    const r = stored(db)!.payload.disputeRounds[0];
    expect(r.status).toBe("approved");
    expect(r.review?.reviewedBy).toBe(OWNER.email);
  });

  it("refuses an unknown review action", async () => {
    const db = signIn(OWNER, { [ID]: withDraft() });
    expect(await reviewDisputeRound(ID, "r1", { kind: "send" } as never)).toEqual({ ok: false, error: "Unknown review action." });
    expect(writes(db)).toHaveLength(0);
  });

  it("refuses to approve a round twice", async () => {
    const c = withDraft();
    c.disputeRounds[0].status = "approved";
    const db = signIn(OWNER, { [ID]: c });
    const res = await reviewDisputeRound(ID, "r1", { kind: "approve" });
    expect(res.ok).toBe(false);
    expect(writes(db)).toHaveLength(0);
  });
});
