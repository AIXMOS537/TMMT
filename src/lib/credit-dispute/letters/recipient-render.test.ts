import { describe, expect, it, vi } from "vitest";

/**
 * C3-011 — the production render path addresses a letter only to a VERIFIED
 * registry recipient. The CROA gate is stubbed OPEN in this file only so the
 * letter can be read; the real gate stays closed (gate-coverage.test.ts).
 */
vi.mock("../../../../shared/compliance-gates/gate", async (orig) => {
  const real = await orig<typeof import("../../../../shared/compliance-gates/gate")>();
  return { ...real, requireGate: () => undefined, isGateOpen: () => true };
});

import type { CreditProfile, NegativeItem, NegativeItemType } from "../types";
import type { CustomerAssertion } from "../policy/assertion";
import { renderFromDecision } from "./render-from-decision";
import { addRecipientVersion, legacySeedRegistry, verifyRecipientVersion } from "../recipients/registry";

const T0 = "2026-09-22T00:00:00.000Z";
const AT = "2026-10-01T00:00:00.000Z";
const OWNER = "owner@example.test";

const profile: CreditProfile = { id: "p1", fullName: "Jordan Ellis", currentAddress: { street: "12 Example Way", city: "Springfield", state: "VA", zip: "22150" } };
const item = { id: "i1", bureau: "experian", itemType: "charge_off" as NegativeItemType, furnisherName: "Example Bank", accountNumberMasked: "****1111", currentRound: 0, status: "pending" } as unknown as NegativeItem;
const assertion: CustomerAssertion = { id: "a1", negativeItemId: "i1", basis: "wrong_balance", statement: "The balance is $400 more than I owe.", source: "customer", customerConfirmed: true, evidenceIds: [], recordedBy: OWNER, recordedAt: T0, status: "active" };

const render = (registry: Parameters<typeof renderFromDecision>[3] extends infer O ? O extends { registry?: infer R } ? R : never : never) =>
  renderFromDecision(profile, item, { accuracy: "inaccurate", basis: "wrong_balance" }, { context: { assertion }, registry, at: AT });

describe("letters are addressed from the registry", () => {
  it("an unverified seed writes no letter and reports recipient_unverified", () => {
    const r = render(legacySeedRegistry(T0));
    expect(r.kind).toBe("no_letter");
    if (r.kind === "no_letter") expect(r.missing?.map((m) => m.code)).toContain("recipient_unverified");
  });

  it("an empty registry reports recipient_missing", () => {
    const r = render([]);
    expect(r.kind).toBe("no_letter");
    if (r.kind === "no_letter") expect(r.missing?.map((m) => m.code)).toContain("recipient_missing");
  });

  it("a verified version addresses the letter and is recorded on it", () => {
    const reg = verifyRecipientVersion(legacySeedRegistry(T0), "CRA:experian", 1, "verified", "bureau dispute page", OWNER, T0);
    const r = render(reg);
    expect(r.kind).toBe("letter");
    if (r.kind !== "letter") return;
    expect(r.rendered.recipientId).toBe("CRA:experian");
    expect(r.rendered.recipientVersion).toBe(1);
    expect(r.rendered.letter.body).toContain("Experian\nP.O. Box 4500\nAllen, TX 75013");
  });

  it("a verified NEW address replaces the hard-coded one in the letter text", () => {
    let reg = addRecipientVersion([], { type: "CRA", key: "experian", name: "Experian Dispute Center", address: { line1: "P.O. Box 9701", city: "Allen", state: "TX", zip: "75013" }, source: "public_record", effectiveFrom: T0 }, OWNER, T0);
    reg = verifyRecipientVersion(reg, "CRA:experian", 1, "verified", "bureau dispute page", OWNER, T0);
    const r = render(reg);
    expect(r.kind).toBe("letter");
    if (r.kind !== "letter") return;
    expect(r.rendered.letter.body).toContain("Experian Dispute Center\nP.O. Box 9701\nAllen, TX 75013");
    expect(r.rendered.letter.body).not.toContain("P.O. Box 4500");
    expect(r.rendered.letter.recipientAddress.street).toBe("P.O. Box 9701");
  });
});
