import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";
import type { StoredClient } from "@/lib/credit-dispute/data/store";
import type { NegativeItem } from "@/lib/credit-dispute/types";

/**
 * C2 customer actions (DEVELOPMENT ONLY feature).
 *
 *   - off unless CREDIT_CENTER_CUSTOMER=1: no query at all when off
 *   - anonymous -> login
 *   - a customer reaches ONLY the case whose payload.customerUserId is their own
 *     user id; a row with any other link is refused even if the database returns it
 *   - cannot draft against another case's item, confirm someone else's statement,
 *     or attach to another item / statement
 *   - writes are rate-limited and compare-and-swap on updated_at
 *   - uploads refused (before storage) when uploads are off or the file is invalid
 */

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const state = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  service: null as unknown,
  limited: false,
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/supabase-server", () => ({
  createSSRClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));
vi.mock("@/lib/supabase-service", () => ({ createServiceRoleClient: () => state.service }));
vi.mock("@/lib/rate-limit-durable", () => ({ isRateLimitedDurable: async () => state.limited }));

import { confirmMyStatement, draftMyStatement, getMyCreditCase, getMyDocumentLink, uploadMyDocument } from "./actions";

const neg = (id: string, furnisherName: string): NegativeItem =>
  ({ id, bureau: "experian", itemType: "charge_off", furnisherName, currentRound: 0, status: "draft" }) as NegativeItem;

const caseOf = (owner: string, over: Partial<StoredClient> = {}): StoredClient => ({
  profile: { id: `client-${owner.slice(0, 4)}`, fullName: `Customer ${owner.slice(0, 4)}`, ssnLast4: "9876", currentAddress: { street: "1 St", city: "C", state: "VA", zip: "1" } },
  source: "myfreescorenow",
  negativeItems: [neg(`item-${owner.slice(0, 4)}`, `Lender for ${owner.slice(0, 4)}`)],
  disputeRounds: [],
  importedAt: "2026-09-01T00:00:00.000Z",
  customerUserId: owner,
  ...over,
});

let rows: Array<{ id: string; payload: StoredClient; updated_at: string }>;
let updateRows: number;

function service(): FakeSupabase {
  state.service = makeFakeSupabase(
    (call) => {
      if (call.table !== "dispute_clients") return undefined;
      if (call.op === "select") {
        const link = call.filters.find((f) => f[0] === "eq" && f[1] === "payload->>customerUserId")?.[2];
        // Simulate a buggy/over-broad query too: return rows even if the link is wrong
        // when the test asks for it by seeding such rows.
        return { data: rows.filter((r) => r.payload.customerUserId === link || r.id.startsWith("leak-")) };
      }
      if (call.op === "update") return { data: Array.from({ length: updateRows }, () => ({ id: "x" })) };
      return { error: null };
    },
    { storageRespond: (c) => (c.op === "createSignedUrl" ? { data: { signedUrl: `https://signed.example/${String(c.args[0])}` }, error: null } : { data: { path: "p" }, error: null }) }
  );
  return state.service as FakeSupabase;
}

beforeEach(() => {
  process.env.CREDIT_CENTER_CUSTOMER = "1";
  delete process.env.CREDIT_EVIDENCE_UPLOADS;
  state.user = { id: USER_A, email: "a@example.test" };
  state.limited = false;
  updateRows = 1;
  rows = [
    { id: "client-aaaa", payload: caseOf(USER_A), updated_at: "v1" },
    { id: "client-bbbb", payload: caseOf(USER_B), updated_at: "v1" },
  ];
});
afterEach(() => {
  delete process.env.CREDIT_CENTER_CUSTOMER;
  delete process.env.CREDIT_EVIDENCE_UPLOADS;
});

const lastPayload = (db: FakeSupabase) => (writes(db).at(-1)?.payload as { payload: StoredClient }).payload;

describe("switched off", () => {
  it("answers Not available and issues no query when CREDIT_CENTER_CUSTOMER is not 1", async () => {
    delete process.env.CREDIT_CENTER_CUSTOMER;
    const db = service();
    expect(await getMyCreditCase()).toEqual({ ok: false, error: "Not available." });
    expect(await draftMyStatement({ negativeItemId: "item-aaaa", category: "NOT_MINE", statement: "Not my account at all." })).toEqual({ ok: false, error: "Not available." });
    expect(db.calls).toHaveLength(0);
  });
});

describe("who you are", () => {
  it("sends anonymous callers to login before any query", async () => {
    state.user = null;
    const db = service();
    await expect(getMyCreditCase()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(db.calls).toHaveLength(0);
  });

  it("finds the case by YOUR user id only — never by email or a browser parameter", async () => {
    const db = service();
    const r = await getMyCreditCase();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.clientId).toBe("client-aaaa");
    expect(r.data.items.map((i) => i.id)).toEqual(["item-aaaa"]);
    const filters = db.calls[0].filters.map((f) => `${f[0]}:${String(f[1])}`);
    expect(filters).toContain("eq:payload->>customerUserId");
    expect(filters.some((f) => f.includes("email"))).toBe(false);
  });

  it("refuses a row whose link is not exactly this user, even if the database returns it", async () => {
    rows = [{ id: "leak-1", payload: caseOf(USER_B), updated_at: "v1" }];
    service();
    expect(await getMyCreditCase()).toEqual({ ok: false, error: "No credit case is linked to your account yet." });
  });

  it("a user with no linked case sees nothing", async () => {
    state.user = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", email: "c@example.test" };
    service();
    expect(await getMyCreditCase()).toEqual({ ok: false, error: "No credit case is linked to your account yet." });
  });

  it("the view carries no SSN or other customers' data", async () => {
    service();
    const r = await getMyCreditCase();
    expect(JSON.stringify(r)).not.toMatch(/9876|bbbb/);
  });
});

describe("assertions", () => {
  it("drafts a statement for your own item, recorded as yours", async () => {
    const db = service();
    const r = await draftMyStatement({ negativeItemId: "item-aaaa", category: "BALANCE_INCORRECT", statement: "The balance is $300 higher than my last statement." });
    expect(r.ok).toBe(true);
    const a = lastPayload(db).assertions![0];
    expect(a).toMatchObject({ status: "draft", source: "customer", recordedBy: `customer:${USER_A}`, category: "BALANCE_INCORRECT" });
  });

  it("cannot draft against another customer's item", async () => {
    const db = service();
    const r = await draftMyStatement({ negativeItemId: "item-bbbb", category: "NOT_MINE", statement: "This is not my account at all." });
    expect(r).toEqual({ ok: false, error: "Unknown item." });
    expect(writes(db)).toHaveLength(0);
  });

  it("cannot confirm a statement you did not write (an operator's, or another customer's)", async () => {
    rows[0].payload.assertions = [
      { id: "op-1", negativeItemId: "item-aaaa", basis: "not_mine", statement: "Operator note", source: "operator", customerConfirmed: false, evidenceIds: [], recordedBy: "owner@x", recordedAt: "t", status: "draft" },
      { id: "other-1", negativeItemId: "item-aaaa", category: "NOT_MINE", statement: "Written by B", source: "customer", customerConfirmed: false, evidenceIds: [], recordedBy: `customer:${USER_B}`, recordedAt: "t", status: "draft" },
    ];
    const db = service();
    expect(await confirmMyStatement("op-1")).toEqual({ ok: false, error: "Statement not found." });
    expect(await confirmMyStatement("other-1")).toEqual({ ok: false, error: "Statement not found." });
    expect(await confirmMyStatement("does-not-exist")).toEqual({ ok: false, error: "Statement not found." });
    expect(writes(db)).toHaveLength(0);
  });

  it("confirms your own draft and records the confirmation event", async () => {
    rows[0].payload.assertions = [
      { id: "mine", negativeItemId: "item-aaaa", category: "NOT_MINE", statement: "Never had this account.", originalStatement: "Never had this account.", source: "customer", customerConfirmed: false, evidenceIds: [], recordedBy: `customer:${USER_A}`, recordedAt: "t", status: "draft" },
    ];
    const db = service();
    expect((await confirmMyStatement("mine")).ok).toBe(true);
    const a = lastPayload(db).assertions!.find((x) => x.id === "mine")!;
    expect(a.status).toBe("active");
    expect(a.confirmation).toMatchObject({ channel: "customer_portal", actor: `customer:${USER_A}` });
  });

  it("is rate-limited", async () => {
    state.limited = true;
    const db = service();
    expect(await draftMyStatement({ negativeItemId: "item-aaaa", category: "NOT_MINE", statement: "Never had this account." })).toEqual({ ok: false, error: "Too many changes. Try again later." });
    expect(writes(db)).toHaveLength(0);
  });

  it("does not overwrite a case that changed since it was loaded", async () => {
    updateRows = 0;
    const db = service();
    const r = await draftMyStatement({ negativeItemId: "item-aaaa", category: "NOT_MINE", statement: "Never had this account." });
    expect(r).toEqual({ ok: false, error: "Your case changed. Reload and try again." });
    const upd = writes(db).find((w) => w.op === "update")!;
    expect(upd.filters).toContainEqual(["eq", "updated_at", "v1"]);
  });
});

describe("documents", () => {
  const pdf = () => new File([new Uint8Array([...new TextEncoder().encode("%PDF-1.7\n"), 1, 2])], "statement.pdf", { type: "application/pdf" });
  const form = (over: Record<string, string | File> = {}) => {
    const fd = new FormData();
    fd.set("file", pdf());
    fd.set("negativeItemId", "item-aaaa");
    for (const [k, v] of Object.entries(over)) fd.set(k, v);
    return fd;
  };

  it("refuses uploads while CREDIT_EVIDENCE_UPLOADS is off — nothing reaches storage", async () => {
    const db = service();
    expect(await uploadMyDocument(form())).toEqual({ ok: false, error: "Document uploads are not enabled." });
    expect(db.storageCalls).toHaveLength(0);
  });

  it("refuses an invalid file before storage", async () => {
    process.env.CREDIT_EVIDENCE_UPLOADS = "1";
    const db = service();
    const html = new File([new TextEncoder().encode("<html><script>x</script></html>")], "statement.pdf", { type: "application/pdf" });
    expect((await uploadMyDocument(form({ file: html }))).ok).toBe(false);
    expect(db.storageCalls).toHaveLength(0);
  });

  it("cannot attach to another customer's item or someone else's statement", async () => {
    process.env.CREDIT_EVIDENCE_UPLOADS = "1";
    rows[0].payload.assertions = [
      { id: "theirs", negativeItemId: "item-aaaa", category: "NOT_MINE", statement: "x", source: "customer", customerConfirmed: false, evidenceIds: [], recordedBy: `customer:${USER_B}`, recordedAt: "t", status: "draft" },
    ];
    const db = service();
    expect(await uploadMyDocument(form({ negativeItemId: "item-bbbb" }))).toEqual({ ok: false, error: "Item not found." });
    expect(await uploadMyDocument(form({ assertionId: "theirs" }))).toEqual({ ok: false, error: "Statement not found." });
    expect(db.storageCalls).toHaveLength(0);
  });

  it("stores a valid file under a server-built key and records it as the customer's, pending review", async () => {
    process.env.CREDIT_EVIDENCE_UPLOADS = "1";
    const db = service();
    const r = await uploadMyDocument(form({ description: "Bank statement for March" }));
    expect(r.ok).toBe(true);
    const up = db.storageCalls.find((c) => c.op === "upload")!;
    expect(up.bucket).toBe("credit-evidence");
    expect(String(up.args[0])).toMatch(/^no-org\/client-aaaa\/evid-[0-9a-f-]+\.pdf$/);
    expect(String(up.args[0])).not.toContain("statement");
    const e = lastPayload(db).evidence![0];
    expect(e).toMatchObject({ source: "customer", reviewState: "pending_review", mime: "application/pdf", fileName: "statement.pdf", uploadedBy: `customer:${USER_A}` });
    expect(e.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("C3-020: a write from a tab that loaded an older version is refused before anything is stored", async () => {
    process.env.CREDIT_EVIDENCE_UPLOADS = "1";
    const db = service();
    expect(await uploadMyDocument(form({ seenVersion: "v0" }))).toEqual({ ok: false, error: "Your case changed. Reload and try again." });
    expect(await draftMyStatement({ negativeItemId: "item-aaaa", category: "NOT_MINE", statement: "Never had this account.", seenVersion: "v0" })).toEqual({ ok: false, error: "Your case changed. Reload and try again." });
    expect(await confirmMyStatement("anything", "v0")).toEqual({ ok: false, error: "Your case changed. Reload and try again." });
    expect(db.storageCalls).toHaveLength(0);
    expect(writes(db)).toHaveLength(0);
    // The current version passes the check.
    expect((await draftMyStatement({ negativeItemId: "item-aaaa", category: "NOT_MINE", statement: "Never had this account.", seenVersion: "v1" })).ok).toBe(true);
  });

  it("removes the stored object if the case save fails", async () => {
    process.env.CREDIT_EVIDENCE_UPLOADS = "1";
    updateRows = 0;
    const db = service();
    expect((await uploadMyDocument(form())).ok).toBe(false);
    expect(db.storageCalls.map((c) => c.op)).toEqual(["upload", "remove"]);
  });
});

describe("C3-010: a customer reads back only their own documents", () => {
  const mine = { id: "ev-mine", kind: "other" as const, description: "March statement", negativeItemId: "item-aaaa", storagePath: "no-org/client-aaaa/evid-1.pdf", source: "customer" as const, uploadedBy: `customer:${USER_A}`, uploadedAt: "t" };

  beforeEach(() => {
    process.env.CREDIT_EVIDENCE_UPLOADS = "1";
    rows[0].payload.evidence = [
      mine,
      // on my case, but uploaded by an operator
      { ...mine, id: "ev-operator", source: "operator" as const, uploadedBy: "owner@example.test" },
      // on my case, claims to be mine, but points into ANOTHER case's folder
      { ...mine, id: "ev-crosspath", storagePath: "no-org/client-bbbb/evid-9.pdf" },
      // a reference with no stored file
      { ...mine, id: "ev-nofile", storagePath: undefined },
    ];
    rows[1].payload.evidence = [{ ...mine, id: "ev-theirs", uploadedBy: `customer:${USER_B}`, storagePath: "no-org/client-bbbb/evid-2.pdf" }];
  });

  it("returns a short-lived download link for your own upload", async () => {
    const db = service();
    const r = await getMyDocumentLink("ev-mine");
    expect(r).toEqual({ ok: true, data: "https://signed.example/no-org/client-aaaa/evid-1.pdf" });
    const call = db.storageCalls.find((c) => c.op === "createSignedUrl")!;
    expect(call.bucket).toBe("credit-evidence");
    expect(call.args[1]).toBe(120);
    expect(call.args[2]).toEqual({ download: true });
  });

  it("refuses another customer's document, operator documents, cross-folder paths and missing files — same answer, no link", async () => {
    const db = service();
    for (const id of ["ev-theirs", "ev-operator", "ev-crosspath", "ev-nofile", "does-not-exist", ""]) {
      expect(await getMyDocumentLink(id)).toEqual({ ok: false, error: "Document not found." });
    }
    expect(db.storageCalls).toHaveLength(0);
  });

  it("gives no link while uploads are off, and nothing at all while the Credit Center is off", async () => {
    delete process.env.CREDIT_EVIDENCE_UPLOADS;
    service();
    expect(await getMyDocumentLink("ev-mine")).toEqual({ ok: false, error: "Document not available." });
    delete process.env.CREDIT_CENTER_CUSTOMER;
    const db = service();
    expect(await getMyDocumentLink("ev-mine")).toEqual({ ok: false, error: "Not available." });
    expect(db.calls).toHaveLength(0);
  });
});
