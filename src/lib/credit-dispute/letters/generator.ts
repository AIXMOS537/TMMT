import type {
  CreditBureau,
  CreditProfile,
  DisputeLetter,
  DisputeRoundType,
  NegativeItem,
  NegativeItemType,
} from "../types";
import { BUREAU_ADDRESSES } from "../types";
import { generateIntentToLitigate } from "./advanced";
import { requireGate } from "../../../../shared/compliance-gates/gate";

/**
 * Thrown when a template would have to invent a fact to be written.
 *
 * C1: every template used to have a fallback — "I received a response indicating
 * the item was verified", "Initial FCRA dispute sent", "CFPB complaint filed", "The
 * reported information does not match my records". Each of those states something
 * in the customer's name that nobody recorded. A missing fact is now a refusal the
 * desk can show as NEEDS_INFORMATION, never filler prose.
 */
export class LetterFactsMissingError extends Error {
  readonly missing: string[];
  constructor(roundType: DisputeRoundType, missing: string[]) {
    super(`Cannot write ${roundType}: missing ${missing.join(", ")}. Nothing is invented to fill the gap.`);
    this.name = "LetterFactsMissingError";
    this.missing = missing;
  }
}

/** A verified recipient from the registry (C3). */
export interface RecipientBlock {
  name: string;
  address: { street: string; city: string; state: string; zip: string };
}

/**
 * Address the letter to a registry recipient (C3-011). Replaces the header block the
 * template built from its legacy constants, and the letter's recipient fields, so
 * the address a letter states is the verified one — not a hard-coded guess.
 */
function withRecipient(letter: DisputeLetter, to: RecipientBlock): DisputeLetter {
  const oldBlock = `${letter.recipient}\n${formatAddress(letter.recipientAddress)}`;
  const newBlock = `${to.name}\n${formatAddress(to.address)}`;
  // Test for the block, not for a changed body: a verified address that matches the
  // legacy constant leaves the text identical and is still correctly addressed.
  if (!letter.body.includes(oldBlock)) {
    if (letter.roundType !== "cfpb_escalation") {
      throw new Error(`Could not address ${letter.roundType} to the registry recipient.`);
    }
    return { ...letter, recipient: to.name, recipientAddress: to.address };
  }
  const body = letter.body.replace(oldBlock, newBlock);
  return { ...letter, body, recipient: to.name, recipientAddress: to.address };
}

function enclosuresLine(enclosures?: string[]): string {
  return enclosures && enclosures.length > 0 ? `\n\nEnclosures: ${enclosures.join("; ")}` : "";
}

function formatLetterDate(d?: string): string {
  if (!d) return "[DATE NOT PROVIDED]";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatAddress(addr: CreditProfile["currentAddress"]): string {
  return `${addr.street}\n${addr.city}, ${addr.state} ${addr.zip}`;
}

function clientBlock(profile: CreditProfile): string {
  return `${profile.fullName}
${formatAddress(profile.currentAddress)}
${profile.dateOfBirth ? `Date of Birth: ${formatLetterDate(profile.dateOfBirth)}` : ""}
${profile.ssnLast4 ? `SSN (last 4): XXX-XX-${profile.ssnLast4}` : ""}`.trim();
}

function itemDescription(item: NegativeItem): string {
  const parts = [
    `Creditor/Furnisher: ${item.furnisherName}`,
    item.accountNumberMasked ? `Account: ${item.accountNumberMasked}` : null,
    item.reportedBalanceCents
      ? `Reported Balance: $${(item.reportedBalanceCents / 100).toFixed(2)}`
      : null,
    item.dateReported ? `Date Reported: ${formatLetterDate(item.dateReported)}` : null,
    item.dateOfFirstDelinquency
      ? `Date of First Delinquency: ${formatLetterDate(item.dateOfFirstDelinquency)}`
      : null,
  ].filter(Boolean);
  return parts.join("\n");
}

function bureauName(bureau: CreditBureau): string {
  return BUREAU_ADDRESSES[bureau].name;
}

// ─── Round 1: Initial FCRA §611(a)(1)(A) Verification Demand ─────────

export function generateInitial611(
  profile: CreditProfile,
  item: NegativeItem,
  roundNumber: number,
  enclosures?: string[]
): DisputeLetter {
  if (!item.inaccuracyDetails?.trim()) {
    throw new LetterFactsMissingError("initial_611", ["the customer's stated problem with this item"]);
  }
  const bureau = item.bureau;
  const recipient = bureauName(bureau);
  const recipientAddress = BUREAU_ADDRESSES[bureau].address;

  const body = `${formatLetterDate(new Date().toISOString())}

${recipient}
${formatAddress(recipientAddress)}

RE: FCRA Dispute — Demand for Investigation and Verification
Consumer: ${profile.fullName}
${item.accountNumberMasked ? `Account Reference: ${item.accountNumberMasked}` : ""}

To Whom It May Concern:

Pursuant to the Fair Credit Reporting Act, 15 U.S.C. § 1681i(a)(1)(A), I am disputing the accuracy and completeness of the following information appearing on my consumer credit report:

${itemDescription(item)}

I am requesting that you conduct a reasonable reinvestigation of this account as required by law. Specifically, I demand that you:

1. Verify the accuracy of all reported information with the furnisher of this data;
2. Provide me with written confirmation of the results of your investigation within 30 days as required by 15 U.S.C. § 1681i(a)(5);
3. Delete any information that cannot be verified as accurate and complete;
4. Provide me with the name, address, and telephone number of each furnisher contacted during your investigation.

Specifically: ${item.inaccuracyDetails}

If you cannot verify this information through a reasonable investigation, you are required by law to delete it from my credit file immediately.

Please send written confirmation of your investigation results to the address below.

Sincerely,

${clientBlock(profile)}${enclosuresLine(enclosures)}`;

  return {
    subject: `FCRA Dispute — ${item.furnisherName} — Verification Demand`,
    body,
    recipient,
    recipientAddress,
    roundType: "initial_611",
    bureau,
    roundNumber,
    responseDueDays: 30,
  };
}

// ─── Round 2: Method of Verification (MOV) Demand ──────────────────────

export function generateMethodOfVerification(
  profile: CreditProfile,
  item: NegativeItem,
  roundNumber: number,
  priorResponseSummary?: string
): DisputeLetter {
  if (!priorResponseSummary?.trim() || roundNumber < 2) {
    throw new LetterFactsMissingError("method_of_verification", ["a recorded response to an earlier dispute"]);
  }
  const bureau = item.bureau;
  const recipient = bureauName(bureau);
  const recipientAddress = BUREAU_ADDRESSES[bureau].address;

  const body = `${formatLetterDate(new Date().toISOString())}

${recipient}
${formatAddress(recipientAddress)}

RE: Method of Verification Demand — FCRA §611(a)(6)(B)(iii)
Consumer: ${profile.fullName}
Prior Dispute Reference: Round ${roundNumber - 1}
${item.accountNumberMasked ? `Account: ${item.accountNumberMasked}` : ""}

To Whom It May Concern:

I previously disputed the following item on my credit report under FCRA §611(a)(1)(A):

${itemDescription(item)}

Your response indicated: "${priorResponseSummary}"

Pursuant to 15 U.S.C. § 1681i(a)(6)(B)(iii), I am formally requesting that you provide me with:

1. The METHOD OF VERIFICATION used to verify this disputed information;
2. The specific documents, records, or data reviewed during your investigation;
3. The name, address, and telephone number of any person contacted during the reinvestigation;
4. Copies of any documents relied upon to verify this account.

A generic statement that the item was "verified" does not satisfy your obligations under the FCRA. I am entitled to know exactly HOW you verified this information.

If you cannot provide a specific method of verification with supporting documentation, you must delete this item from my credit report immediately pursuant to 15 U.S.C. § 1681i(a)(5)(A).

Please respond within 15 days.

Sincerely,

${clientBlock(profile)}`;

  return {
    subject: `MOV Demand — ${item.furnisherName} — FCRA §611(a)(6)(B)(iii)`,
    body,
    recipient,
    recipientAddress,
    roundType: "method_of_verification",
    bureau,
    roundNumber,
    responseDueDays: 15,
  };
}

// ─── Round 3: Factual Confrontation ──────────────────────────────────

export function generateFactualConfrontation(
  profile: CreditProfile,
  item: NegativeItem,
  roundNumber: number,
  facts: string[],
  enclosures?: string[]
): DisputeLetter {
  const real = facts.map((f) => f.trim()).filter(Boolean);
  if (real.length === 0) {
    throw new LetterFactsMissingError("factual_confrontation", ["the specific facts the customer says are wrong"]);
  }
  const bureau = item.bureau;
  const recipient = bureauName(bureau);
  const recipientAddress = BUREAU_ADDRESSES[bureau].address;

  const factList = real.map((f, i) => `${i + 1}. ${f}`).join("\n");

  const body = `${formatLetterDate(new Date().toISOString())}

${recipient}
${formatAddress(recipientAddress)}

RE: Factual Dispute — Specific Inaccuracies Identified
Consumer: ${profile.fullName}

To Whom It May Concern:

I am disputing the following item on my ${bureauName(bureau)} credit report with specific factual inaccuracies:

${itemDescription(item)}

The following facts demonstrate this reporting is INACCURATE:

${factList}

Under FCRA §611(a)(5)(A), you are required to delete information that is found to be inaccurate or cannot be verified. The factual discrepancies listed above require immediate correction or deletion.

I demand deletion of this item within 30 days. Failure to conduct a reasonable reinvestigation and correct these inaccuracies may result in further action under FCRA §§616 and 617.

Sincerely,

${clientBlock(profile)}${enclosuresLine(enclosures)}`;

  return {
    subject: `Factual Dispute — ${item.furnisherName} — Specific Inaccuracies`,
    body,
    recipient,
    recipientAddress,
    roundType: "factual_confrontation",
    bureau,
    roundNumber,
    responseDueDays: 30,
  };
}

// ─── Round 4: FCRA §623 Direct Furnisher Dispute ─────────────────────

export function generateFurnisher623(
  profile: CreditProfile,
  item: NegativeItem,
  roundNumber: number,
  furnisherAddress?: { street: string; city: string; state: string; zip: string }
): DisputeLetter {
  if (!item.inaccuracyDetails?.trim()) {
    throw new LetterFactsMissingError("furnisher_623", ["the customer's stated problem with this item"]);
  }
  const addr = furnisherAddress ?? {
    street: "[FURNISHER ADDRESS — LOOKUP REQUIRED]",
    city: "",
    state: "",
    zip: "",
  };

  const body = `${formatLetterDate(new Date().toISOString())}

${item.furnisherName}
${formatAddress(addr)}

RE: Direct Dispute — FCRA §623(a)(8) — Duty to Investigate
Consumer: ${profile.fullName}
${item.accountNumberMasked ? `Account: ${item.accountNumberMasked}` : ""}

To Whom It May Concern:

Pursuant to 15 U.S.C. § 1681s-2(a)(8), as a furnisher of information to consumer reporting agencies, you have a duty to investigate disputes forwarded to you by credit reporting agencies.

I am also exercising my right under 15 U.S.C. § 1681s-2(b) to dispute the accuracy of information you are furnishing about me directly to you:

${itemDescription(item)}

Specific dispute: ${item.inaccuracyDetails}

As a furnisher, you are required to:
1. Conduct an investigation of the disputed information;
2. Review all relevant information provided by the consumer;
3. Report the results to the credit reporting agency;
4. Modify, delete, or permanently block the reporting of inaccurate information.

If you cannot verify the accuracy of this information, you must cease reporting it to all credit bureaus immediately.

Please confirm in writing within 30 days.

Sincerely,

${clientBlock(profile)}`;

  return {
    subject: `FCRA §623 Dispute — ${item.furnisherName}`,
    body,
    recipient: item.furnisherName,
    recipientAddress: addr,
    roundType: "furnisher_623",
    bureau: item.bureau,
    roundNumber,
    responseDueDays: 30,
  };
}

// ─── FDCPA §809 Collection Validation ────────────────────────────────

export function generateFdcpaValidation(
  profile: CreditProfile,
  item: NegativeItem,
  roundNumber: number,
  collectorAddress?: { street: string; city: string; state: string; zip: string }
): DisputeLetter {
  const addr = collectorAddress ?? {
    street: "[COLLECTOR ADDRESS — LOOKUP REQUIRED]",
    city: "",
    state: "",
    zip: "",
  };

  const body = `${formatLetterDate(new Date().toISOString())}

${item.furnisherName}
${formatAddress(addr)}

RE: Debt Validation Demand — FDCPA §809
Consumer: ${profile.fullName}
${item.accountNumberMasked ? `Reference: ${item.accountNumberMasked}` : ""}

To Whom It May Concern:

This letter concerns a debt your company is reporting on my consumer credit file. Pursuant to the Fair Debt Collection Practices Act, 15 U.S.C. § 1692g(b), I am requesting validation of this debt.

I dispute the validity of this debt and demand that you provide:

1. Verification of the debt amount;
2. The name and address of the original creditor;
3. Proof that you are licensed to collect in my state;
4. A copy of the original signed agreement creating the debt;
5. An accounting of all amounts claimed, including fees and interest;
6. Evidence that the statute of limitations has not expired.

Until you provide complete validation, cease all collection activity and cease reporting this account to any credit reporting agency.

This is a formal dispute. All collection activity must stop until validation is provided.

Sincerely,

${clientBlock(profile)}`;

  return {
    subject: `FDCPA Validation Demand — ${item.furnisherName}`,
    body,
    recipient: item.furnisherName,
    recipientAddress: addr,
    roundType: "fdcpa_validation",
    bureau: item.bureau,
    roundNumber,
    responseDueDays: 30,
  };
}

// ─── CFPB Escalation ─────────────────────────────────────────────────

export function generateCfpbEscalation(
  profile: CreditProfile,
  item: NegativeItem,
  roundNumber: number,
  priorAttempts: string[]
): DisputeLetter {
  const real = priorAttempts.map((a) => a.trim()).filter(Boolean);
  if (real.length === 0) {
    throw new LetterFactsMissingError("cfpb_escalation", ["the recorded history of earlier rounds and their responses"]);
  }
  const bureau = item.bureau;
  const attempts = real.map((a, i) => `${i + 1}. ${a}`).join("\n");

  const body = `CFPB COMPLAINT — CREDIT REPORTING

Consumer: ${profile.fullName}
${formatAddress(profile.currentAddress)}
${profile.email ? `Email: ${profile.email}` : ""}
${profile.phone ? `Phone: ${profile.phone}` : ""}

Company Being Complained About: ${bureauName(bureau)}
Product: Credit reporting
Issue: Incorrect information on your report

Description of Complaint:

I have disputed the following information on my credit report:

${itemDescription(item)}

Prior dispute attempts and the responses received (from my records):
${attempts}

I do not believe the responses above resolved the specific inaccuracy I identified.

I am requesting that the CFPB investigate this company's compliance with the Fair Credit Reporting Act and order correction or deletion of this inaccurate information.

Desired Resolution: Delete the inaccurate item from my credit report.

Submitted: ${formatLetterDate(new Date().toISOString())}`;

  return {
    subject: `CFPB Complaint — ${bureauName(bureau)} — ${item.furnisherName}`,
    body,
    recipient: "Consumer Financial Protection Bureau",
    recipientAddress: {
      street: "1700 G Street NW",
      city: "Washington",
      state: "DC",
      zip: "20552",
    },
    roundType: "cfpb_escalation",
    bureau,
    roundNumber,
    responseDueDays: 60,
  };
}

// ─── Letter router ─────────────────────────────────────────────────────

/**
 * THE CROA CHOKEPOINT.
 *
 * Every dispute letter in this module is reached through here — initial 611,
 * method-of-verification, factual confrontation, furnisher 623, FDCPA validation,
 * CFPB escalation and intent-to-litigate all route through the switch below, and
 * `protocol.ts` is the only external caller. So this is the one place the gate has
 * to sit for the whole engine to be covered.
 *
 * Producing an addressed dispute letter for a consumer IS the regulated act under
 * CROA 15 U.S.C. §1679a — not a tool around it. Root CLAUDE.md §3: "Do not write a
 * code path that performs a gated action outside its requireGate() wrapper."
 *
 * Until `croa_contracts_attorney_approved` is true, this throws ComplianceGateError
 * carrying the gate's own `clears_when` text, so the refusal explains itself rather
 * than looking like a bug. Owner-only access (requireOwner in the server actions) is
 * an access control; it is NOT this gate and never was.
 */
export function generateLetter(
  roundType: DisputeRoundType,
  profile: CreditProfile,
  item: NegativeItem,
  roundNumber: number,
  options?: {
    facts?: string[];
    priorResponseSummary?: string;
    priorAttempts?: string[];
    furnisherAddress?: { street: string; city: string; state: string; zip: string };
    /** Documents actually on file for this round. No default: nothing is claimed as enclosed. */
    enclosures?: string[];
    /** C3: the verified registry recipient. When given, it replaces the legacy constants. */
    recipient?: RecipientBlock;
  }
): DisputeLetter {
  requireGate("croa_contracts_attorney_approved");
  const letter = composeLetter(roundType, profile, item, roundNumber, options);
  return options?.recipient ? withRecipient(letter, options.recipient) : letter;
}

/**
 * A fixed SPECIMEN of one template, for fingerprinting its wording (C3-013/014).
 * Uses only the synthetic fixture below — it cannot address a real person — and
 * exists so an approval can be bound to the exact text it approved.
 */
export function templateSpecimen(roundType: DisputeRoundType): string {
  const profile: CreditProfile = {
    id: "specimen",
    fullName: "SPECIMEN CONSUMER",
    currentAddress: { street: "1 SPECIMEN ST", city: "SPECIMEN", state: "ZZ", zip: "00000" },
  };
  const item: NegativeItem = {
    id: "specimen-item",
    bureau: "experian",
    itemType: roundType === "fdcpa_validation" ? "collection" : "charge_off",
    furnisherName: "SPECIMEN FURNISHER",
    accountNumberMasked: "****0000",
    reportedBalanceCents: 100,
    dateReported: "2000-01-01",
    dateOfFirstDelinquency: "2000-01-01",
    inaccuracyDetails: "SPECIMEN FACT",
    currentRound: 0,
    status: "draft",
  };
  const l = composeLetter(roundType, profile, item, 2, {
    facts: ["SPECIMEN FACT"],
    priorResponseSummary: "SPECIMEN RESPONSE",
    priorAttempts: ["SPECIMEN ROUND"],
    enclosures: ["SPECIMEN ENCLOSURE"],
  });
  return `${l.subject}\n${l.body}`;
}

function composeLetter(
  roundType: DisputeRoundType,
  profile: CreditProfile,
  item: NegativeItem,
  roundNumber: number,
  options?: Parameters<typeof generateLetter>[4]
): DisputeLetter {
  switch (roundType) {
    case "initial_611":
      return generateInitial611(profile, item, roundNumber, options?.enclosures);
    case "method_of_verification":
      return generateMethodOfVerification(
        profile,
        item,
        roundNumber,
        options?.priorResponseSummary
      );
    case "factual_confrontation":
      return generateFactualConfrontation(
        profile,
        item,
        roundNumber,
        options?.facts ?? (item.inaccuracyDetails ? [item.inaccuracyDetails] : []),
        options?.enclosures
      );
    case "furnisher_623":
      return generateFurnisher623(profile, item, roundNumber, options?.furnisherAddress);
    case "fdcpa_validation":
      return generateFdcpaValidation(profile, item, roundNumber, options?.furnisherAddress);
    case "cfpb_escalation":
      return generateCfpbEscalation(
        profile,
        item,
        roundNumber,
        // C1: no invented history. The caller passes what the stored rounds say.
        options?.priorAttempts ?? []
      );
    case "intent_to_litigate": {
      const attempts = (options?.priorAttempts ?? []).filter((a) => a.trim());
      if (attempts.length === 0) {
        throw new LetterFactsMissingError("intent_to_litigate", ["the recorded history of earlier rounds"]);
      }
      return generateIntentToLitigate(profile, item, roundNumber, attempts);
    }
  }

  return generateInitial611(profile, item, roundNumber);
}

// ─── Auto-classify dispute strategy by item type ───────────────────────

export function recommendRoundSequence(itemType: NegativeItemType): DisputeRoundType[] {
  switch (itemType) {
    case "collection":
      return [
        "fdcpa_validation",
        "initial_611",
        "method_of_verification",
        "factual_confrontation",
        "furnisher_623",
        "cfpb_escalation",
      ];
    case "charge_off":
    case "late_payment":
      return [
        "initial_611",
        "method_of_verification",
        "factual_confrontation",
        "furnisher_623",
        "cfpb_escalation",
      ];
    case "hard_inquiry":
      return ["initial_611", "factual_confrontation", "cfpb_escalation"];
    case "bankruptcy":
    case "foreclosure":
    case "repossession":
      return [
        "initial_611",
        "factual_confrontation",
        "method_of_verification",
        "cfpb_escalation",
      ];
    default:
      return [
        "initial_611",
        "method_of_verification",
        "factual_confrontation",
        "furnisher_623",
        "cfpb_escalation",
      ];
  }
}
