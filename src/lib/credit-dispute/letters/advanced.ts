import type { CreditProfile, DisputeLetter, NegativeItem } from "../types";
import { BUREAU_ADDRESSES } from "../types";

function formatDate(d?: string): string {
  if (!d) return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatAddress(addr: { street: string; city: string; state: string; zip: string }): string {
  return `${addr.street}\n${addr.city}, ${addr.state} ${addr.zip}`;
}

function clientBlock(profile: CreditProfile): string {
  return `${profile.fullName}
${formatAddress(profile.currentAddress)}
${profile.dateOfBirth ? `Date of Birth: ${formatDate(profile.dateOfBirth)}` : ""}
${profile.ssnLast4 ? `SSN (last 4): XXX-XX-${profile.ssnLast4}` : ""}`.trim();
}

function itemBlock(item: NegativeItem): string {
  return [
    `Creditor/Furnisher: ${item.furnisherName}`,
    item.accountNumberMasked ? `Account: ${item.accountNumberMasked}` : null,
    item.reportedBalanceCents ? `Balance: $${(item.reportedBalanceCents / 100).toFixed(2)}` : null,
    item.dateOfFirstDelinquency ? `DOFD: ${formatDate(item.dateOfFirstDelinquency)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

// ─── Intent to Litigate — FCRA §616/617 ──────────────────────────────

export function generateIntentToLitigate(
  profile: CreditProfile,
  item: NegativeItem,
  roundNumber: number,
  priorAttempts: string[]
): DisputeLetter {
  const bureau = item.bureau;
  const recipient = BUREAU_ADDRESSES[bureau].name;
  const recipientAddress = BUREAU_ADDRESSES[bureau].address;
  const attempts = priorAttempts.map((a, i) => `${i + 1}. ${a}`).join("\n");

  const body = `${formatDate(new Date().toISOString())}

${recipient}
${formatAddress(recipientAddress)}

RE: FINAL NOTICE — FCRA Violation — Intent to Pursue Legal Remedies
Consumer: ${profile.fullName}
${item.accountNumberMasked ? `Account: ${item.accountNumberMasked}` : ""}

To Whom It May Concern:

This is my FINAL written notice before pursuing legal remedies under the Fair Credit Reporting Act, 15 U.S.C. §§ 1681n and 1681o.

DISPUTED ITEM:
${itemBlock(item)}

PRIOR DISPUTE ATTEMPTS (ALL UNRESOLVED):
${attempts}

YOUR VIOLATIONS:
You have willfully failed to comply with the FCRA by:
1. Failing to conduct a reasonable reinvestigation under §611(a)(1)(A)
2. Failing to delete inaccurate or unverifiable information under §611(a)(5)(A)
3. Failing to provide method of verification under §611(a)(6)(B)(iii)
4. Continuing to report information you cannot verify as accurate and complete

STATUTORY DAMAGES AVAILABLE:
Under 15 U.S.C. § 1681n, I am entitled to actual damages, statutory damages of $100 to $1,000 per violation, punitive damages, attorney's fees, and court costs for willful noncompliance.

Under 15 U.S.C. § 1681o, I am entitled to actual damages, attorney's fees, and court costs for negligent noncompliance.

FINAL DEMAND:
Delete the above-referenced item from my credit file within 15 days of receipt of this letter. Failure to comply will result in filing a complaint with the CFPB and consulting counsel regarding civil litigation.

This letter is sent without prejudice to any and all rights and remedies available at law or in equity.

Sincerely,

${clientBlock(profile)}

CC: Consumer Financial Protection Bureau
CC: State Attorney General — Consumer Protection Division`;

  return {
    subject: `FINAL NOTICE — FCRA Violation — ${item.furnisherName}`,
    body,
    recipient,
    recipientAddress,
    roundType: "intent_to_litigate",
    bureau,
    roundNumber,
    responseDueDays: 15,
  };
}

// ─── Metro-2 Violation Dispute ─────────────────────────────────────────

export function generateMetro2Dispute(
  profile: CreditProfile,
  item: NegativeItem,
  roundNumber: number,
  violations: string[]
): DisputeLetter {
  const bureau = item.bureau;
  const recipient = BUREAU_ADDRESSES[bureau].name;
  const recipientAddress = BUREAU_ADDRESSES[bureau].address;
  const violationList = violations.map((v, i) => `${i + 1}. ${v}`).join("\n");

  const body = `${formatDate(new Date().toISOString())}

${recipient}
${formatAddress(recipientAddress)}

RE: Metro-2 Format Violation — Demand for Deletion
Consumer: ${profile.fullName}

To Whom It May Concern:

I am disputing the following tradeline based on violations of the CDIA Metro-2 Credit Reporting Resource Guide, which all furnishers must comply with when reporting to consumer reporting agencies:

${itemBlock(item)}

METRO-2 VIOLATIONS IDENTIFIED:
${violationList}

Under the FCRA, credit reporting agencies have a duty under §611(a)(5)(A) to delete information that cannot be verified as accurate. Data reported in violation of Metro-2 format standards is, by definition, inaccurate and must be deleted or corrected.

I demand immediate deletion of this tradeline from my credit file. Provide written confirmation within 30 days.

Sincerely,

${clientBlock(profile)}`;

  return {
    subject: `Metro-2 Violation — ${item.furnisherName} — Demand for Deletion`,
    body,
    recipient,
    recipientAddress,
    roundType: "factual_confrontation",
    bureau,
    roundNumber,
    responseDueDays: 30,
  };
}

// ─── Cease and Desist (Collections) ────────────────────────────────────

export function generateCeaseAndDesist(
  profile: CreditProfile,
  item: NegativeItem,
  roundNumber: number,
  collectorAddress?: { street: string; city: string; state: string; zip: string }
): DisputeLetter {
  const addr = collectorAddress ?? {
    street: "[COLLECTOR ADDRESS]",
    city: "",
    state: "",
    zip: "",
  };

  const body = `${formatDate(new Date().toISOString())}

${item.furnisherName}
${formatAddress(addr)}

RE: CEASE AND DESIST — FDCPA §805(c)
Consumer: ${profile.fullName}

To Whom It May Concern:

Pursuant to the Fair Debt Collection Practices Act, 15 U.S.C. § 1692c(c), you are hereby notified to CEASE AND DESIST all communication with me regarding the alleged debt referenced below.

${itemBlock(item)}

Additionally:
1. CEASE reporting this account to all credit reporting agencies until validated
2. CEASE all collection activity pending validation under §809
3. CEASE all telephone calls, letters, and electronic communications

Any further contact after receipt of this letter will be documented and may constitute an FDCPA violation subject to statutory damages under §813.

This notice is effective immediately upon receipt.

Sincerely,

${clientBlock(profile)}

SENT VIA CERTIFIED MAIL — RETURN RECEIPT REQUESTED`;

  return {
    subject: `CEASE AND DESIST — ${item.furnisherName}`,
    body,
    recipient: item.furnisherName,
    recipientAddress: addr,
    roundType: "fdcpa_validation",
    bureau: item.bureau,
    roundNumber,
    responseDueDays: 0,
  };
}
