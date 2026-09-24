/**
 * Gated protocol run — the console's replacement for `runDisputeProtocol`.
 *
 * WHY
 *
 * `runDisputeProtocol()` walks every active item through AGGRESSIVE_FCRA_PROTOCOL
 * and produces a letter for each. It never asks whether the item is actually
 * wrong, so the console has been able to generate a six-round campaign against a
 * correctly-reported account with one click.
 *
 * This runs the same shape of job through the policy gate first. Same
 * `ProtocolRunResult` so the stored round records keep working — plus a
 * `notDisputed` list, which is the part that is worth putting on screen.
 *
 * C1: there are now two entry points.
 *   planDisputeRound()        decisions only. Never renders, never touches the CROA
 *                             gate. Safe to run any time; it is what tells the desk
 *                             which facts are missing.
 *   runGatedDisputeProtocol() plan + render. Rendering is behind the CROA gate.
 * Both take the per-item DecisionContext (assertion, evidence, stored history), and
 * both are called ONLY from the server actions — never from a browser bundle.
 */

import type { CreditProfile, NegativeItem } from "../types";
import {
  DEFAULT_DISPUTE_POLICY,
  decideForItem,
  inferAssessment,
  type DisputeDecision,
  type DisputePolicyConfig,
  type ItemAssessment,
} from "../policy/dispute-policy";
import type { DecisionContext, MissingFact } from "../policy/assertion";
import { renderPacket, type RenderedLetter } from "../letters/render-from-decision";
import type { Registry } from "../recipients/registry";
import type { DisputeLetterBatch, ProtocolRunResult } from "./protocol";

export type RunCounts = { letters: number; coach: number; hold: number; needs_information: number; refuse: number };

export interface NotDisputed {
  negativeItemId: string;
  furnisherName: string;
  action: string;
  reason: string;
  nextStep?: string;
  missing?: MissingFact[];
}

export interface GatedRunResult extends ProtocolRunResult {
  /** Items deliberately not disputed, with a client-readable reason. */
  notDisputed: NotDisputed[];
  counts: RunCounts;
  /** One line for the desk header. */
  summary: string;
  /** Rendered letters with their fact trace, for the stored round. */
  rendered: Array<{ negativeItemId: string; rendered: RenderedLetter }>;
}

export interface PlanResult {
  decisions: Array<{ item: NegativeItem; decision: DisputeDecision }>;
  notDisputed: NotDisputed[];
  readyForLetter: string[];
  counts: RunCounts;
  summary: string;
}

function activeItems(items: NegativeItem[]): NegativeItem[] {
  return items.filter((i) => i.status !== "removed" && i.status !== "closed");
}

function resolveAssessments(active: NegativeItem[], assessments: Record<string, ItemAssessment>) {
  const resolved: Record<string, ItemAssessment> = {};
  for (const item of active) resolved[item.id] = assessments[item.id] ?? inferAssessment(item);
  return resolved;
}

function summaryLine(c: RunCounts, readyLabel = "letter"): string {
  const bits = [`${c.letters} ${readyLabel}${c.letters === 1 ? "" : "s"}`];
  if (c.needs_information) bits.push(`${c.needs_information} awaiting a fact`);
  if (c.coach) bits.push(`${c.coach} to coach`);
  if (c.hold) bits.push(`${c.hold} on hold`);
  if (c.refuse) bits.push(`${c.refuse} declined`);
  return bits.join(" · ");
}

/** Decisions only. No letter, no gate. */
export function planDisputeRound(
  items: NegativeItem[],
  assessments: Record<string, ItemAssessment> = {},
  contexts: Record<string, DecisionContext> = {},
  cfg: DisputePolicyConfig = DEFAULT_DISPUTE_POLICY
): PlanResult {
  const active = activeItems(items);
  const resolved = resolveAssessments(active, assessments);
  const counts: RunCounts = { letters: 0, coach: 0, hold: 0, needs_information: 0, refuse: 0 };
  const decisions = active.map((item) => ({ item, decision: decideForItem(item, resolved[item.id], cfg, contexts[item.id]) }));
  const notDisputed: NotDisputed[] = [];
  const readyForLetter: string[] = [];
  for (const { item, decision } of decisions) {
    if (decision.action === "dispute") {
      counts.letters += 1;
      readyForLetter.push(item.id);
    } else {
      counts[decision.action] += 1;
      notDisputed.push({
        negativeItemId: item.id,
        furnisherName: item.furnisherName,
        action: decision.action,
        reason: decision.rationale,
        nextStep: decision.nextStep,
        missing: decision.missing,
      });
    }
  }
  return { decisions, notDisputed, readyForLetter, counts, summary: summaryLine(counts, "ready for a letter") };
}

/**
 * Run the protocol with the accuracy gate in front of it, and render.
 *
 * `assessments` are keyed by negative-item id. Anything missing falls back to
 * `inferAssessment()`, which (since C1) never unlocks a letter on its own.
 */
export function runGatedDisputeProtocol(
  profile: CreditProfile,
  items: NegativeItem[],
  assessments: Record<string, ItemAssessment> = {},
  cfg: DisputePolicyConfig = DEFAULT_DISPUTE_POLICY,
  contexts: Record<string, DecisionContext> = {},
  registry?: Registry,
  at?: string
): GatedRunResult {
  const active = activeItems(items);
  const resolved = resolveAssessments(active, assessments);
  const packet = renderPacket(profile, active, resolved, cfg, contexts, registry, at);

  const lettersGenerated: DisputeLetterBatch[] = packet.letters.map(({ item, rendered }) => ({
    negativeItemId: item.id,
    furnisherName: item.furnisherName,
    bureau: item.bureau,
    roundNumber: rendered.roundNumber,
    roundType: rendered.roundType,
    letter: rendered.letter,
    // Generated, not sent, not even approved. A person reviews it first.
    status: "needs_review",
  }));

  const nextActions: string[] = [];
  if (packet.counts.needs_information > 0) {
    nextActions.push(`${packet.counts.needs_information} item(s) are waiting on a fact before anything can be written`);
  }
  if (packet.counts.coach > 0) {
    nextActions.push(`${packet.counts.coach} item(s) are accurate — coach on behaviour and time, do not dispute`);
  }
  if (lettersGenerated.length > 0) {
    nextActions.push(`Review ${lettersGenerated.length} draft letter(s): check every fact against its source, then approve, return or cancel`);
  } else if (packet.counts.hold === 0 && packet.counts.coach === 0 && packet.counts.needs_information === 0) {
    nextActions.push("No pending disputes — schedule a re-pull in 30-45 days");
  }

  const notDisputed: NotDisputed[] = packet.notDisputed.map(({ item, reason, nextStep, missing, action }) => ({
    negativeItemId: item.id,
    furnisherName: item.furnisherName,
    action,
    reason,
    nextStep,
    missing,
  }));

  return {
    profileId: profile.id,
    itemsProcessed: active.length,
    lettersGenerated,
    nextActions,
    notDisputed,
    counts: packet.counts,
    summary: summaryLine(packet.counts),
    rendered: packet.letters.map(({ item, rendered }) => ({ negativeItemId: item.id, rendered })),
  };
}
