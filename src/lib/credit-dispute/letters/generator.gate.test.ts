import { describe, it, expect } from "vitest";
import { generateLetter } from "./generator";
import { ComplianceGateError } from "../../../../shared/compliance-gates/gate";
import gatesConfig from "../../../../shared/compliance-gates/gates.config.json";
import type { CreditProfile, NegativeItem, DisputeRoundType } from "../types";

/**
 * A gate is only real once you have watched it refuse.
 *
 * This engine generates addressed dispute letters — initial 611, method of
 * verification, factual confrontation, furnisher 623, FDCPA validation, CFPB
 * escalation, intent to litigate. Producing one for a consumer IS the regulated
 * act under CROA 15 U.S.C. §1679a, and CLAIMS_AUDIT.md records all seven legal
 * gates as CLOSED: no attorney-approved suite, no VDACS registration, no bond.
 *
 * The server actions behind /command/credit-dispute are owner-only. That is an
 * ACCESS control and it is not this gate: it stops another user reaching the
 * screen, it does nothing about whether TMMT may lawfully perform the act at all.
 *
 * These tests fail the moment someone removes the requireGate() call, and they
 * also fail if the gate is flipped true without the paperwork — which is the
 * point. If you are here because this suite went red after flipping the flag,
 * that flip needs an attorney's sign-off recorded first.
 */

const profile: CreditProfile = {
  id: "test-profile",
  fullName: "Test Consumer",
  address: { street: "1 Test St", city: "Richmond", state: "VA", zip: "23219" },
} as unknown as CreditProfile;

const item: NegativeItem = {
  id: "item-1",
  creditor: "Test Furnisher",
  accountNumber: "1234",
  bureau: "experian",
  type: "collection",
} as unknown as NegativeItem;

const EVERY_ROUND: DisputeRoundType[] = [
  "initial_611",
  "method_of_verification",
  "factual_confrontation",
  "furnisher_623",
  "fdcpa_validation",
  "cfpb_escalation",
];

describe("CROA gate on the dispute letter engine", () => {
  it("the gate this engine depends on is still closed", () => {
    // If this fails the flag was flipped. That is an owner + attorney decision,
    // not a code change — see root CLAUDE.md §3.
    expect(gatesConfig.gates.croa_contracts_attorney_approved.value).toBe(false);
  });

  it("refuses to generate a letter, for every round type", () => {
    for (const roundType of EVERY_ROUND) {
      expect(
        () => generateLetter(roundType, profile, item, 1),
        `${roundType} was generated while the CROA gate is closed`,
      ).toThrow(ComplianceGateError);
    }
  });

  it("names the gate and what clears it, so the refusal is not a mystery", () => {
    let caught: unknown;
    try {
      generateLetter("initial_611", profile, item, 1);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ComplianceGateError);
    const msg = String((caught as Error).message);
    expect(msg).toContain("croa_contracts_attorney_approved");
    // The operator should be told the condition, not just "denied".
    expect(msg.toLowerCase()).toContain("clears when");
  });

  it("refuses BEFORE doing any work — no letter body is built and thrown away", () => {
    // A gate that runs after generation would still have produced the artefact in
    // memory. Passing deliberately malformed input proves the gate fires first:
    // if generation ran at all, this would fail on the bad input instead.
    expect(() =>
      generateLetter("initial_611", null as unknown as CreditProfile, null as unknown as NegativeItem, 1),
    ).toThrow(ComplianceGateError);
  });
});
