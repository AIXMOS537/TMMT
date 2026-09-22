/**
 * Letter renderer — the only sanctioned path from a decision to a letter.
 *
 * WHERE THIS SITS
 *
 *   dispute-policy.ts   decides WHETHER a letter should exist, and on what ground
 *   THIS FILE           turns a "dispute" decision into an actual letter
 *   letters/generator   renders the statutory language for one round
 *
 * The generator is good at what it does and is not being replaced. What it cannot
 * do is refuse. Called directly it will happily produce a six-round campaign
 * against a correctly-reported account, because nothing in it asks whether the
 * item is actually wrong.
 *
 * So this module is the seam. It takes a DisputeDecision and either renders the
 * letters or explains, in language safe to show a client, why it is not going to.
 *
 * THREE THINGS IT DOES THAT THE GENERATOR DOES NOT
 *
 * 1. It refuses. `coach`, `hold` and `refuse` decisions produce guidance, not paper.
 *
 * 2. It states the actual ground. The generator's default hedge is "I have reason
 *    to believe this item may be inaccurate, incomplete, or unverifiable" — which
 *    is what a bureau sees ten thousand times a week. A specific factual basis and
 *    its citation is what makes a dispute answerable.
 *
 * 3. It screens its own output. Every rendered letter is checked against the
 *    theories quarantined in docs/knowledge/QUARANTINE-disputed-legal-theories.md.
 *    If one ever leaks back in — through a template edit, a merge, a well-meaning
 *    paste — rendering fails loudly rather than posting it to a bureau in a
 *    client's name.
 */

import { generateLetter } from "./generator";
import type {
  CreditProfile,
  DisputeLetter,
  DisputeRoundType,
  NegativeItem,
} from "../types";
import {
  DEFAULT_DISPUTE_POLICY,
  decideForItem,
  routeFor,
  type DisputeDecision,
  type DisputePolicyConfig,
  type FactualBasis,
  type ItemAssessment,
} from "../policy/dispute-policy";
import { REPORT_DERIVED_BASES, type DecisionContext, type MissingFact } from "../policy/assertion";

/** Bump when any template or statement text changes, so every stored round says which wording it used. */
export const LETTER_TEMPLATE_VERSION = "c1-2026-09-22";

/**
 * Where one fact in a letter came from. Every sentence that asserts something in
 * the customer's name has one of these, so a reviewer can check it against its
 * source before anything is sent.
 */
export interface FactTrace {
  text: string;
  source:
    | "report_field" // dates, balance, account reference from the imported report
    | "customer_assertion" // the customer's own words, confirmed by them
    | "basis_statement" // the fixed sentence for a ground, allowed only with a confirmed assertion
    | "evidence" // a document on file
    | "round_history"; // our own stored rounds and recorded responses
  ref: string;
}

// ---------------------------------------------------------------------------
// How each ground is stated in the letter
//
// One sentence per ground, written as a factual assertion the client can stand
// behind. Deliberately plain: no "under penalty of perjury", no boilerplate
// distress claims, no demands for damages. The statute does the work.
// ---------------------------------------------------------------------------

const BASIS_STATEMENT: Record<FactualBasis, string> = {
  not_mine:
    "This account does not belong to me. I have never held an account with this creditor.",
  identity_theft:
    "This account is the result of identity theft. An identity theft report has been filed and is available on request.",
  never_late:
    "The payments on this account were made on time. The late payment history reported is incorrect.",
  wrong_balance: "The balance reported on this account is incorrect.",
  wrong_dates:
    "The dates reported on this account are incorrect, including the date of first delinquency.",
  wrong_status:
    "The status reported on this account is incorrect and does not reflect the actual state of the account.",
  duplicate:
    "This debt is reported more than once on my file. The duplicate entry overstates my obligations.",
  obsolete:
    "This item is older than the period for which it may lawfully be reported.",
  paid_in_full_reported_unpaid:
    "This account was paid in full and is still being reported as owing a balance.",
  settled_reported_unsettled:
    "This account was settled and is still being reported as outstanding.",
  included_in_bankruptcy:
    "This debt was included in and discharged through bankruptcy, and should not be reported as an active balance.",
  no_permissible_purpose:
    "I did not authorise this inquiry and gave no written instruction permitting it.",
  reinserted_without_notice:
    "This item was previously deleted from my file and has been reinserted. I did not receive notice of the reinsertion within five business days.",
  dispute_not_notated:
    "I disputed this account and it has not been marked as disputed, which it should have been within 30 days.",
  unverifiable:
    "This item was reported as verified. I am requesting the method of verification, because the information does not match my records.",
};

// ---------------------------------------------------------------------------
// The safety net
//
// Phrases from the quarantined pack. If any appears in rendered output, something
// has gone wrong upstream and the letter must not be sent. Matched loosely and
// case-insensitively, because the point is to catch a paste, not to be clever.
// ---------------------------------------------------------------------------

export const BANNED_PHRASES: ReadonlyArray<{ pattern: RegExp; why: string }> = [
  { pattern: /under penalty of perjury/i, why: "swears a fact that may not be true, in the client's name" },
  { pattern: /estoppel by silence/i, why: "not an FCRA or FDCPA authority" },
  { pattern: /engelhardt/i, why: "1926 Missouri case that does not stand for this" },
  { pattern: /litigious consumer/i, why: "asserts a posture, not a fact" },
  { pattern: /in the process of taking legal action/i, why: "states litigation that has not been filed" },
  { pattern: /while in litigation per fcra/i, why: "describes an FCRA rule that does not exist" },
  { pattern: /1681a\s*\(?\s*2\s*\)?\s*\(?\s*B/i, why: "the social-security-number exclusion theory" },
  { pattern: /severe depression/i, why: "boilerplate distress claim asserted on the client's behalf" },
  { pattern: /1605\s*\(a\)/i, why: "misreads TILA's finance-charge definition" },
  { pattern: /owing\s+1,?000\s+per violation/i, why: "demands statutory damages in a dispute letter" },
];

/**
 * Throws if a letter contains quarantined language.
 *
 * Deliberately a throw rather than a returned warning: a letter that reaches a
 * bureau with this content in it is worse than no letter, so failing the render
 * is the correct outcome.
 */
export function assertNoBannedLanguage(letter: DisputeLetter): void {
  const haystack = `${letter.subject}\n${letter.body}`;
  for (const { pattern, why } of BANNED_PHRASES) {
    if (pattern.test(haystack)) {
      throw new Error(
        `Refusing to render: letter contains quarantined language (${pattern.source}) — ${why}. ` +
          `See docs/knowledge/QUARANTINE-disputed-legal-theories.md.`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface RenderedLetter {
  letter: DisputeLetter;
  /** The ground relied on. */
  basis: FactualBasis;
  /** Statute, and who it is aimed at. */
  citation: string;
  target: "bureau" | "furnisher" | "collector" | "court";
  /** Where this round sits in the sequence for this ground. */
  roundNumber: number;
  roundType: DisputeRoundType;
  /** Rounds still to come if this one does not resolve it. */
  remainingSequence: DisputeRoundType[];
  /** Source of every fact the letter states. */
  trace: FactTrace[];
  /** Assertion and evidence relied on, for the stored round. */
  assertionId?: string;
  evidenceIds: string[];
  templateVersion: string;
}

export type RenderResult =
  | { kind: "letter"; rendered: RenderedLetter; decision: DisputeDecision }
  | {
      kind: "no_letter";
      decision: DisputeDecision;
      /** What to tell the client, in plain words. */
      clientMessage: string;
      /** What the desk should do next. */
      nextStep?: string;
      /** Present when the gap is a missing fact. */
      missing?: MissingFact[];
    };

/** The stored history as the lines a CFPB / escalation letter may state. */
function historyLines(ctx: DecisionContext): string[] {
  return (ctx.history ?? []).map((h) => {
    const resp = h.response
      ? ` — response received ${h.response.receivedAt.slice(0, 10)}: ${h.response.outcome}${h.response.summary ? ` (${h.response.summary})` : ""}`
      : " — no response recorded";
    return `Round ${h.roundNumber}: ${h.roundType.replace(/_/g, " ")}${resp}`;
  });
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/**
 * Render the next letter for an item, or explain why there is not one.
 *
 * Takes a decision rather than making one, so the policy stays the single place
 * that decides. Pass `decision` when you already have it; omit it and this will
 * ask the policy itself.
 */
export function renderFromDecision(
  profile: CreditProfile,
  item: NegativeItem,
  assessment: ItemAssessment,
  opts: {
    decision?: DisputeDecision;
    cfg?: DisputePolicyConfig;
    /** Assertion, evidence and round history for this item (C1). */
    context?: DecisionContext;
    furnisherAddress?: { street: string; city: string; state: string; zip: string };
  } = {}
): RenderResult {
  const cfg = opts.cfg ?? DEFAULT_DISPUTE_POLICY;
  const ctx = opts.context ?? {};
  // Always decide here with the full context. A decision handed in from outside is
  // re-checked, so no caller can pass "dispute" past the policy.
  const decision = decideForItem(item, assessment, cfg, ctx);
  if (opts.decision && opts.decision.action !== decision.action) {
    return {
      kind: "no_letter",
      decision,
      clientMessage: "The decision passed in does not match the policy's own decision, so nothing was written.",
      nextStep: decision.nextStep,
      missing: decision.missing,
    };
  }

  if (decision.action !== "dispute") {
    return {
      kind: "no_letter",
      decision,
      clientMessage: decision.rationale,
      nextStep: decision.nextStep,
      missing: decision.missing,
    };
  }

  const basis = decision.basis;
  const sequence = decision.sequence ?? [];

  // Belt and braces. The policy should never emit "dispute" without both, but a
  // letter is not the place to discover that it did.
  if (!basis || sequence.length === 0) {
    return {
      kind: "no_letter",
      decision,
      clientMessage:
        "There is not enough recorded about this item to write a dispute that would hold up.",
      nextStep: "Record the specific factual reason before generating a letter.",
    };
  }

  const route = routeFor(basis);
  const roundType = sequence[0];
  // Numbered from the STORED history (C1), falling back to roundsSent for callers
  // that have no history yet.
  const roundNumber = (ctx.history?.length ?? assessment.roundsSent?.length ?? 0) + 1;

  // The facts a letter may state, each with its source. The fixed statement for a
  // ground is only used because the policy has already confirmed the customer
  // asserted exactly this ground (or, for obsolete, that the report's dates show it).
  // The operator's `basisNote` is an internal note and is NOT put in the letter.
  const trace: FactTrace[] = [];
  const assertion = ctx.assertion;
  if (REPORT_DERIVED_BASES.has(basis)) {
    trace.push({
      text: BASIS_STATEMENT[basis],
      source: "report_field",
      ref: item.dateOfFirstDelinquency ? "dateOfFirstDelinquency" : "dateReported",
    });
  } else {
    trace.push({ text: BASIS_STATEMENT[basis], source: "basis_statement", ref: `assertion:${assertion?.id ?? "?"}` });
    if (assertion?.statement?.trim()) {
      trace.push({ text: assertion.statement.trim(), source: "customer_assertion", ref: `assertion:${assertion.id}` });
    }
  }
  const evidence = (ctx.evidence ?? []).filter(
    (e) => e.negativeItemId === item.id || (assertion && (assertion.evidenceIds.includes(e.id) || e.assertionId === assertion.id))
  );
  for (const e of evidence) trace.push({ text: e.description, source: "evidence", ref: `evidence:${e.id}` });
  const priorAttempts = historyLines(ctx);
  for (const [i, line] of priorAttempts.entries()) {
    trace.push({ text: line, source: "round_history", ref: `round:${ctx.history?.[i]?.roundId ?? i}` });
  }
  const lastResponse = [...(ctx.history ?? [])].reverse().find((h) => h.response)?.response;

  const facts = trace.filter((t) => t.source === "basis_statement" || t.source === "customer_assertion" || t.source === "report_field").map((t) => t.text);

  // Not every round in the generator reads `facts` — `initial_611`, for one,
  // falls back to "The reported information does not match my records" unless
  // `item.inaccuracyDetails` is set. That default hedge is exactly what this
  // module exists to replace, so the ground is threaded through BOTH seams:
  // `facts` for the rounds that take it, and `inaccuracyDetails` for the rounds
  // that read the item. The item itself is copied, never mutated — callers hand
  // us records they still own.
  const itemWithGround: NegativeItem = {
    ...item,
    inaccuracyDetails: facts.join(" "),
  };

  const letter = generateLetter(roundType, profile, itemWithGround, roundNumber, {
    facts,
    priorResponseSummary: lastResponse
      ? `${lastResponse.outcome}${lastResponse.summary ? ` — ${lastResponse.summary}` : ""}`
      : undefined,
    priorAttempts,
    furnisherAddress: opts.furnisherAddress,
    enclosures: evidence.map((e) => e.description),
  });

  assertNoBannedLanguage(letter);

  return {
    kind: "letter",
    decision,
    rendered: {
      letter,
      basis,
      citation: route?.citation ?? "FCRA 15 U.S.C. 1681",
      target: route?.target ?? "bureau",
      roundNumber,
      roundType,
      remainingSequence: sequence.slice(1),
      trace,
      assertionId: assertion?.id,
      evidenceIds: evidence.map((e) => e.id),
      templateVersion: LETTER_TEMPLATE_VERSION,
    },
  };
}

// ---------------------------------------------------------------------------
// The desk packet
// ---------------------------------------------------------------------------

export interface DisputePacket {
  letters: Array<{ item: NegativeItem; rendered: RenderedLetter }>;
  /** Items that will not be disputed, and why. Shown to the client as-is. */
  notDisputed: Array<{ item: NegativeItem; reason: string; nextStep?: string; missing?: MissingFact[]; action: string }>;
  counts: { letters: number; coach: number; hold: number; needs_information: number; refuse: number };
}

/**
 * Render a whole profile in one pass.
 *
 * The `notDisputed` list is the part worth surfacing to a client. "We are not
 * disputing these four, and here is why" is a more honest conversation than
 * quietly disputing everything and reporting whatever survives.
 */
export function renderPacket(
  profile: CreditProfile,
  items: NegativeItem[],
  assessments: Record<string, ItemAssessment>,
  cfg: DisputePolicyConfig = DEFAULT_DISPUTE_POLICY,
  contexts: Record<string, DecisionContext> = {}
): DisputePacket {
  const letters: DisputePacket["letters"] = [];
  const notDisputed: DisputePacket["notDisputed"] = [];
  const counts = { letters: 0, coach: 0, hold: 0, needs_information: 0, refuse: 0 };

  for (const item of items) {
    const assessment = assessments[item.id] ?? { accuracy: "unknown" as const };
    const result = renderFromDecision(profile, item, assessment, { cfg, context: contexts[item.id] });

    if (result.kind === "letter") {
      letters.push({ item, rendered: result.rendered });
      counts.letters += 1;
    } else {
      notDisputed.push({
        item,
        reason: result.clientMessage,
        nextStep: result.nextStep,
        missing: result.missing,
        action: result.decision.action,
      });
      const a = result.decision.action;
      if (a === "coach" || a === "hold" || a === "refuse" || a === "needs_information") counts[a] += 1;
    }
  }

  return { letters, notDisputed, counts };
}

/** One-line summary for the desk header. */
export function describePacket(packet: DisputePacket): string {
  const { letters, coach, hold, needs_information, refuse } = packet.counts;
  const bits = [`${letters} letter${letters === 1 ? "" : "s"}`];
  if (coach) bits.push(`${coach} to coach`);
  if (needs_information) bits.push(`${needs_information} awaiting a fact`);
  if (hold) bits.push(`${hold} on hold`);
  if (refuse) bits.push(`${refuse} declined`);
  return bits.join(" · ");
}
