/**
 * CFPB-required disclaimer rule engine for the AI sales agent.
 * Hardcoded triggers from COMPLIANCE_DISCLAIMERS.md and project_phase_9_credit_funding memory.
 * Tenant overlay can ADD to the trigger set but NEVER remove core compliance.
 */
const CREDIT_TRIGGER = /\b(credit\s*(score|report)?|approval)\b/i
const FUNDING_TRIGGER = /\b(funding|loan|fund(ed|ing)?|capital|approved\s+for)\b/i
const BLOCKING_PATTERN = /\b(guaranteed|definitely|surely|absolutely)\b.*\b(approv\w*|fund\w*|get the (loan|funding|capital))\b|\byou will (get|receive|be approved)\b/i

const CREDIT_DISCLAIMER = ' Credit decisions are made by lenders, not us. Results vary.'
const FUNDING_DISCLAIMER = ' Funding amounts are estimates; actual amounts depend on lender review.'

export interface DisclaimerResult {
  body: string
  flags: string[]
}

export function applyDisclaimers(body: string): DisclaimerResult {
  let out = body
  const flags: string[] = []
  if (CREDIT_TRIGGER.test(body)) { out += CREDIT_DISCLAIMER; flags.push('cfpb_credit_disclaimer_appended') }
  if (FUNDING_TRIGGER.test(body)) { out += FUNDING_DISCLAIMER; flags.push('cfpb_funding_disclaimer_appended') }
  return { body: out, flags }
}

export function hasBlockingPhrase(body: string): boolean {
  return BLOCKING_PATTERN.test(body)
}
