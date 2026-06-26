/**
 * shared/compliance-gates/gate.ts
 *
 * Hard compliance enforcement. Every gated feature MUST call requireGate()
 * before executing. If the gate is false, this THROWS and the feature cannot run.
 *
 * Do not catch-and-ignore these errors. Do not default gates to true.
 * See root CLAUDE.md section 3.
 */

import gatesConfig from "./gates.config.json";

export type GateKey =
  | "croa_contracts_attorney_approved"
  | "vdacs_registered_bonded"
  | "no_advance_fee_billing_enforced"
  | "sbf_broker_registered"
  | "cpn_and_rented_tradelines_blocked"
  | "securities_counsel_cleared_fund"
  | "multistate_matrix_cleared";

export class ComplianceGateError extends Error {
  constructor(public gate: GateKey, public detail: string) {
    super(
      `COMPLIANCE GATE BLOCKED: "${gate}" is not cleared. ` +
        `This feature is disabled until the required legal step is complete. ${detail}`
    );
    this.name = "ComplianceGateError";
  }
}

export function isGateOpen(gate: GateKey): boolean {
  return gatesConfig.gates[gate]?.value === true;
}

/**
 * Call at the top of any code path that performs a legally gated action.
 * Throws ComplianceGateError if the gate is closed.
 */
export function requireGate(gate: GateKey): void {
  const g = gatesConfig.gates[gate];
  if (!g) throw new ComplianceGateError(gate, "Unknown gate key.");
  if (g.value !== true) {
    throw new ComplianceGateError(gate, `Clears when: ${g.clears_when}`);
  }
}

/**
 * The permanent prohibition. Call on every intake/dispute record.
 * Rejects CPNs and rented/bought tradelines. This must NEVER pass them through.
 */
export function assertNoCpnOrRentedTradelines(payload: string): void {
  const banned = [
    /\bCPN\b/i,
    /credit privacy number/i,
    /credit profile number/i,
    /\bSCN\b/i,
    /secondary credit number/i,
    /rent(ed|al)?\s+tradeline/i,
    /buy\s+(a\s+)?tradeline/i,
    /primary\s+tradeline\s+(for sale|purchase)/i,
    /file\s+segregation/i,
  ];
  for (const re of banned) {
    if (re.test(payload)) {
      throw new ComplianceGateError(
        "cpn_and_rented_tradelines_blocked",
        `Detected prohibited content matching ${re}. This is federal fraud territory and is permanently banned. Reject and flag for owner review.`
      );
    }
  }
}
