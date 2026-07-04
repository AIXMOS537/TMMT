import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * ENFORCEMENT: the owner-approval gate (CLAUDE.md §2) is an absolute rule —
 * "no customer-facing message and no financial action may execute without
 * explicit owner approval." This test makes that structural, not aspirational:
 * any code that OUTBOUND-sends an SMS or moves money via Stripe MUST reference
 * an owner-approval / compliance check. Add such a path without the gate and
 * this test (and CI) fails.
 *
 * Scope is precise to avoid false positives:
 *  - SMS send  = a file that imports the `twilio` SDK AND calls `.messages.create`
 *    (the Anthropic client also has `.messages.create`, so we require the twilio
 *    import to disambiguate).
 *  - Move money = a file that imports `stripe` AND calls an OUTBOUND money op
 *    (charges/paymentIntents/transfers/payouts/refunds .create). Inbound webhooks
 *    (`webhooks.constructEvent`) are not money moves and are not flagged.
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

// Any of these count as "routed through the owner-approval / compliance gate".
// assertSmsAllowed = the canonical shared gate (shared/compliance-gates/sms-gate).
const GATE = /assertSmsAllowed|SmsBlockedError|assertApproved|ownerApproved|owner_approved|owner-approval-gate|shared\/compliance-gates/;

const importsTwilio = /from\s+['"]twilio['"]|require\(\s*['"]twilio['"]\s*\)/;
const importsStripe = /from\s+['"]stripe['"]|from\s+['"]@stripe/;
const sendsSms = /\.messages\.create/;
const movesMoney = /\.(charges|paymentIntents|transfers|payouts|refunds)\.create/;

describe("owner-approval gate is enforced on every outbound send/pay path", () => {
  const files = walk(SRC).map((f) => ({ f, src: readFileSync(f, "utf8") }));

  it("every SMS-sending file routes through the owner-approval / compliance gate", () => {
    const offenders = files
      .filter(({ src }) => importsTwilio.test(src) && sendsSms.test(src) && !GATE.test(src))
      .map(({ f }) => f.replace(process.cwd() + "/", ""));
    expect(offenders, `SMS send without an owner-approval gate: ${offenders.join(", ")}`).toEqual([]);
  });

  it("every money-moving Stripe file routes through the owner-approval gate", () => {
    const offenders = files
      .filter(({ src }) => importsStripe.test(src) && movesMoney.test(src) && !GATE.test(src))
      .map(({ f }) => f.replace(process.cwd() + "/", ""));
    expect(offenders, `Stripe money move without an owner-approval gate: ${offenders.join(", ")}`).toEqual([]);
  });
});
