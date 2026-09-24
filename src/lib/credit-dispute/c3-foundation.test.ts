import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addRecipientVersion,
  legacySeedRegistry,
  recipientIdFor,
  recipientTargetFor,
  resolveRecipient,
  validateAddress,
  verifyRecipientVersion,
} from "./recipients/registry";
import {
  APPROVABLE_TEMPLATES,
  checkTemplateApproval,
  normalisedSpecimen,
  recordTemplateApproval,
  revokeTemplateApproval,
  templateFingerprint,
  type TemplateApproval,
} from "./approvals/template-approvals";
import { templateSpecimen } from "./letters/generator";
import {
  assertStatusOnlyPayload,
  buildCreditStatusPayload,
  creditStatusFor,
  CREDIT_STATUS_CONTRACT_VERSION,
  opaqueCaseRef,
} from "./ghl/status-contract";
import { caseQueueRow } from "./engine/case-state";
import type { StoredClient } from "./data/store";
import type { NegativeItem, NegativeItemType } from "./types";

/**
 * C3 foundation, pure parts:
 *   C3-011/012 recipient registry     — nothing is verified automatically
 *   C3-013/014 template approvals     — approving wording A never approves wording B
 *   C3-016/017 GHL status contract    — status only, never case facts
 */

const T0 = "2026-09-22T00:00:00.000Z";
const T1 = "2026-10-01T00:00:00.000Z";
const OWNER = "owner@example.test";
const SALT = "test-salt-0123456789abcdef";

describe("recipient registry (C3-011/012)", () => {
  it("seeds the old hard-coded addresses as UNVERIFIED, so they cannot address a letter yet", () => {
    const reg = legacySeedRegistry(T0);
    expect(reg).toHaveLength(4);
    expect(reg.every((v) => v.verification.status === "unverified" && v.source === "legacy_code_seed")).toBe(true);
    const r = resolveRecipient(reg, "CRA:experian", T1);
    expect(r).toEqual({ ok: false, code: "recipient_unverified", recipientId: "CRA:experian" });
  });

  it("a missing recipient is reported as missing, not guessed", () => {
    expect(resolveRecipient([], "FURNISHER:example-bank", T1)).toMatchObject({ ok: false, code: "recipient_missing" });
  });

  it("a model-suggested address stays unverified until a PERSON verifies it with a method", () => {
    let reg = addRecipientVersion([], { type: "FURNISHER", key: "Example Bank", name: "Example Bank", address: { line1: "PO Box 1", city: "Wilmington", state: "de", zip: "19801" }, source: "model_suggested" }, "ai:assistant", T0);
    expect(reg[0].verification.status).toBe("unverified");
    expect(reg[0].address.state).toBe("DE");
    expect(resolveRecipient(reg, "FURNISHER:example-bank", T1)).toMatchObject({ code: "recipient_unverified" });
    for (const bot of ["ai:x", "agent:y", "aixmos:z", "system:c3-seed", "AIXMOS-worker", ""]) {
      expect(() => verifyRecipientVersion(reg, "FURNISHER:example-bank", 1, "verified", "looked it up", bot, T0)).toThrow(/person/);
    }
    expect(() => verifyRecipientVersion(reg, "FURNISHER:example-bank", 1, "verified", "ok", OWNER, T0)).toThrow(/how the address was checked/);
    reg = verifyRecipientVersion(reg, "FURNISHER:example-bank", 1, "verified", "matched the furnisher's dispute page", OWNER, T0);
    const r = resolveRecipient(reg, "FURNISHER:example-bank", T1);
    expect(r.ok).toBe(true);
  });

  it("a rejected version is refused", () => {
    const reg = verifyRecipientVersion(legacySeedRegistry(T0), "CRA:equifax", 1, "rejected", "address is out of date", OWNER, T0);
    expect(resolveRecipient(reg, "CRA:equifax", T1)).toMatchObject({ code: "recipient_rejected" });
  });

  it("a new address is a new version; the old one is closed, never edited or removed", () => {
    let reg = verifyRecipientVersion(legacySeedRegistry(T0), "CRA:experian", 1, "verified", "bureau dispute page", OWNER, T0);
    const before = JSON.stringify(reg.find((v) => v.version === 1)!.address);
    reg = addRecipientVersion(reg, { type: "CRA", key: "experian", name: "Experian", address: { line1: "P.O. Box 9701", city: "Allen", state: "TX", zip: "75013" }, source: "public_record", effectiveFrom: "2026-09-25T00:00:00.000Z" }, OWNER, "2026-09-25T00:00:00.000Z");
    const v1 = reg.find((v) => v.recipientId === "CRA:experian" && v.version === 1)!;
    expect(JSON.stringify(v1.address)).toBe(before);
    expect(v1.effectiveTo).toBe("2026-09-25T00:00:00.000Z");
    // Before the change the verified v1 still applies; after it, v2 is unverified so nothing is addressed.
    expect(resolveRecipient(reg, "CRA:experian", "2026-09-24T00:00:00.000Z")).toMatchObject({ ok: true });
    expect(resolveRecipient(reg, "CRA:experian", T1)).toMatchObject({ ok: false, code: "recipient_unverified" });
  });

  it("refuses placeholder and malformed addresses", () => {
    expect(validateAddress({ line1: "[ADDRESS — LOOKUP REQUIRED]", city: "X", state: "VA", zip: "22150" })).toMatch(/placeholder/);
    expect(validateAddress({ line1: "1 St", city: "X", state: "Virginia", zip: "22150" })).toMatch(/two-letter/);
    expect(validateAddress({ line1: "1 St", city: "X", state: "VA", zip: "2215" })).toMatch(/ZIP/);
    expect(validateAddress({ line1: "1 St", city: "X", state: "VA", zip: "22150-1234" })).toBeNull();
  });

  it("routes each round type to an explicit recipient type (no fuzzy matching)", () => {
    const i = { bureau: "transunion", furnisherName: "Acme  Collections, LLC" } as Pick<NegativeItem, "bureau" | "furnisherName">;
    expect(recipientTargetFor("initial_611", i)).toEqual({ type: "CRA", recipientId: "CRA:transunion" });
    expect(recipientTargetFor("method_of_verification", i).recipientId).toBe("CRA:transunion");
    expect(recipientTargetFor("furnisher_623", i).recipientId).toBe("FURNISHER:acme-collections-llc");
    expect(recipientTargetFor("fdcpa_validation", i).recipientId).toBe("COLLECTOR:acme-collections-llc");
    expect(recipientTargetFor("cfpb_escalation", i).recipientId).toBe("OTHER_APPROVED:cfpb");
    // A near-miss name is a different recipient, not a match.
    expect(recipientIdFor("FURNISHER", "Acme Collection LLC")).not.toBe(recipientTargetFor("furnisher_623", i).recipientId);
  });
});

describe("template approvals are bound to exact wording (C3-013/014)", () => {
  const fp = templateFingerprint("initial_611");
  const approve = (list: TemplateApproval[] = [], over: Partial<Parameters<typeof recordTemplateApproval>[1]> = {}) =>
    recordTemplateApproval(list, { id: "appr-611-a", roundType: "initial_611", fingerprint: fp, reference: "COUNSEL-2026-001", approver: OWNER, ...over }, fp, T0);

  it("the fingerprint is stable across days (the letter date is not part of it)", () => {
    expect(normalisedSpecimen("initial_611")).toContain("[DATE]");
    expect(templateFingerprint("initial_611")).toBe(fp);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("every template has its own fingerprint", () => {
    const all = APPROVABLE_TEMPLATES.map((rt) => templateFingerprint(rt));
    expect(new Set(all).size).toBe(all.length);
  });

  it("intent_to_litigate cannot be approved on this path at all", () => {
    expect(APPROVABLE_TEMPLATES).not.toContain("intent_to_litigate");
    expect(() => approve([], { roundType: "intent_to_litigate" })).toThrow(/Unknown template/);
  });

  it("no approval → refused", () => {
    expect(checkTemplateApproval([], "initial_611", fp, { now: T1 })).toEqual({ ok: false, reason: "no_approval" });
  });

  it("approving version A does not approve version B — even a one-character punctuation change", () => {
    const list = approve();
    expect(checkTemplateApproval(list, "initial_611", fp, { now: T1 }).ok).toBe(true);
    const edited = (rt: Parameters<typeof templateSpecimen>[0]) => templateSpecimen(rt).replace("To Whom It May Concern:", "To Whom It May Concern;");
    const fpB = templateFingerprint("initial_611", edited);
    expect(fpB).not.toBe(fp);
    expect(checkTemplateApproval(list, "initial_611", fpB, { now: T1 })).toEqual({ ok: false, reason: "wording_changed" });
    // And an approval of 611 never covers a different template.
    expect(checkTemplateApproval(list, "method_of_verification", templateFingerprint("method_of_verification"), { now: T1 })).toEqual({ ok: false, reason: "no_approval" });
  });

  it("cannot record an approval for wording that is not the code's current wording", () => {
    expect(() => recordTemplateApproval([], { id: "appr-x-001", roundType: "initial_611", fingerprint: "0".repeat(64), reference: "COUNSEL-1", approver: OWNER }, fp, T0)).toThrow(/different wording/);
  });

  it("only a person can approve or revoke, with a real reference", () => {
    for (const bot of ["ai:model", "agent:credit", "aixmos:desk", "system:cron"]) {
      expect(() => approve([], { approver: bot })).toThrow(/person/);
    }
    expect(() => approve([], { reference: "ok" })).toThrow(/reference/);
    const list = approve();
    expect(() => revokeTemplateApproval(list, "appr-611-a", "agent:x", T1)).toThrow(/person/);
  });

  it("revoked, expired, review-overdue and out-of-scope approvals are refused", () => {
    const revoked = revokeTemplateApproval(approve(), "appr-611-a", OWNER, T1);
    expect(revoked[0]).toMatchObject({ status: "revoked", revokedBy: OWNER });
    expect(checkTemplateApproval(revoked, "initial_611", fp, { now: T1 })).toEqual({ ok: false, reason: "revoked" });

    const expiring = approve([], { expiresAt: "2026-09-30T00:00:00.000Z" });
    expect(checkTemplateApproval(expiring, "initial_611", fp, { now: T1 })).toEqual({ ok: false, reason: "expired" });

    const review = approve([], { reviewBy: "2026-09-30T00:00:00.000Z" });
    expect(checkTemplateApproval(review, "initial_611", fp, { now: T1 })).toEqual({ ok: false, reason: "review_overdue" });

    const va = approve([], { jurisdictions: ["VA"] });
    expect(checkTemplateApproval(va, "initial_611", fp, { now: T1, jurisdiction: "VA" }).ok).toBe(true);
    expect(checkTemplateApproval(va, "initial_611", fp, { now: T1, jurisdiction: "CA" })).toEqual({ ok: false, reason: "out_of_scope" });
    expect(checkTemplateApproval(va, "initial_611", fp, { now: T1 })).toEqual({ ok: false, reason: "out_of_scope" });
  });

  it("approvals are append-only: a duplicate id is refused and revocation keeps the record", () => {
    const list = approve();
    expect(() => approve(list)).toThrow(/already exists/);
    expect(revokeTemplateApproval(list, "appr-611-a", OWNER, T1)).toHaveLength(1);
  });
});

describe("GHL status-only contract (C3-016/017)", () => {
  const item = { id: "i1", bureau: "experian", itemType: "charge_off" as NegativeItemType, furnisherName: "Example Bank", currentRound: 0, status: "pending" } as unknown as NegativeItem;
  const client: StoredClient = {
    profile: { id: "case-123", fullName: "Jordan Ellis", ssnLast4: "1234", dateOfBirth: "1990-01-01", currentAddress: { street: "12 Example Way", city: "Springfield", state: "VA", zip: "22150" } },
    source: "myfreescorenow",
    negativeItems: [item],
    disputeRounds: [],
    importedAt: T0,
    assertions: [{ id: "a1", negativeItemId: "i1", basis: "wrong_balance", statement: "The balance is $400 more than I owe.", source: "customer", customerConfirmed: true, evidenceIds: [], recordedBy: OWNER, recordedAt: T0, status: "active" }],
  };

  it("builds exactly {contract, caseRef, status, asOf} and nothing from the case", () => {
    const p = buildCreditStatusPayload(client, caseQueueRow(client, 0), SALT, T1);
    expect(Object.keys(p).sort()).toEqual(["asOf", "caseRef", "contract", "status"]);
    expect(p.contract).toBe(CREDIT_STATUS_CONTRACT_VERSION);
    const wire = JSON.stringify(p);
    for (const leak of ["Jordan", "Ellis", "1234", "1990", "Example Bank", "$400", "balance", "case-123", "Springfield", "experian"]) {
      expect(wire).not.toContain(leak);
    }
  });

  it("the case reference is opaque, salted and stable", () => {
    const a = opaqueCaseRef("case-123", SALT);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(opaqueCaseRef("case-123", SALT)).toBe(a);
    expect(opaqueCaseRef("case-123", `${SALT}x`)).not.toBe(a);
    expect(() => opaqueCaseRef("case-123", "short")).toThrow(/salt/);
  });

  it("refuses any extra key, a smuggled value, or an unknown status", () => {
    const good = buildCreditStatusPayload(client, caseQueueRow(client, 0), SALT, T1);
    expect(() => assertStatusOnlyPayload({ ...good, statement: "The balance is $400 more than I owe." })).toThrow(/may not carry: statement/);
    expect(() => assertStatusOnlyPayload({ ...good, tradelines: [] })).toThrow(/tradelines/);
    expect(() => assertStatusOnlyPayload({ ...good, caseRef: "case-123" })).toThrow(/opaque/);
    expect(() => assertStatusOnlyPayload({ ...good, status: "Jordan disputes Example Bank" })).toThrow(/Unknown status/);
    expect(() => assertStatusOnlyPayload({ ...good, asOf: "SSN 123-45-6789" })).toThrow(/asOf/);
    expect(() => assertStatusOnlyPayload({ ...good, contract: "credit-status/2" })).toThrow(/contract/);
    expect(() => assertStatusOnlyPayload([good])).toThrow(/object/);
  });

  it("labels come from state only", () => {
    expect(creditStatusFor({ ...client, closedAt: T1 }, caseQueueRow(client, 0))).toBe("CASE_COMPLETED");
    expect(creditStatusFor(client, caseQueueRow(client, 1))).toBe("DOCUMENTS_NEEDED");
    expect(creditStatusFor(client, caseQueueRow(client, 0))).toBe("CASE_IN_PROGRESS");
  });
});

describe("C3-018 boundaries (structural)", () => {
  const root = process.cwd();
  const read = (p: string) => readFileSync(join(root, p), "utf8");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [relative(root, p).replace(/\\/g, "/")] : [];
    });
  const importsOf = (src: string) => [...src.matchAll(/^\s*import[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);

  it("the GHL status contract talks to nothing: no GHL client, no network, no database", () => {
    const src = read("src/lib/credit-dispute/ghl/status-contract.ts");
    expect(importsOf(src).filter((i) => !["node:crypto", "../data/store", "../engine/case-state"].includes(i))).toEqual([]);
    expect(src).not.toMatch(/\bfetch\(|axios|leadconnector|gohighlevel|supabase|process\.env/i);
  });

  it("nothing outside tests uses the GHL status contract yet (design only, not wired to any sync)", () => {
    const users = walk(join(root, "src")).filter((f) => f !== "src/lib/credit-dispute/ghl/status-contract.ts" && /credit-dispute\/ghl\/status-contract/.test(read(f)));
    expect(users).toEqual([]);
  });

  it("registry and approvals are pure: no database, network or environment access", () => {
    for (const f of ["src/lib/credit-dispute/recipients/registry.ts", "src/lib/credit-dispute/approvals/template-approvals.ts"]) {
      const src = read(f);
      expect(src, f).not.toMatch(/supabase|\bfetch\(|process\.env/);
    }
  });

  it("no AIXMOS / agent code can reach approvals, recipients or the CROA gate", () => {
    const agentFiles = walk(join(root, "src")).filter((f) => /(^|\/)(aixmos|agents?)(\/|[-_.])/i.test(f));
    const reach = agentFiles.filter((f) => /credit-dispute\/(approvals|recipients)|recordTemplateApproval|verifyRecipientVersion|croa_contracts_attorney_approved/.test(read(f)));
    expect(reach).toEqual([]);
  });

  it("the shipped CROA gate is still closed", () => {
    const cfg = JSON.parse(read("shared/compliance-gates/gates.config.json")) as { gates: Record<string, { value: boolean }> };
    expect(cfg.gates.croa_contracts_attorney_approved.value).toBe(false);
  });
});