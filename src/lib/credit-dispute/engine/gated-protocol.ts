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
 * `ProtocolRunResult` so `addDisputeRounds()` and the stored round records keep
 * working unchanged — plus a `notDisputed` list, which is the part that is worth
 * putting on screen.
 *
 * WHAT CHANGES ON SCREEN
 *
 * Fewer letters, and a reason attached to every item that did not get one. On a
 * fresh import that will usually mean ZERO letters and a list of items awaiting an
 * accuracy call — which is correct. Nobody has looked at them yet.
 *
 * That is the intended behaviour, not a regression. A dispute with no recorded
 * factual basis is the kind that comes back verified.
 */

import type { CreditProfile, NegativeItem } from "../types";
import {
  DEFAULT_DISPUTE_POLICY,
  inferAssessment,
  type DisputePolicyConfig,
  type ItemAssessment,
} from "../policy/dispute-policy";
import { renderPacket } from "../letters/render-from-decision";
import type { DisputeLetterBatch, ProtocolRunResult } from "./protocol";

export interface GatedRunResult extends ProtocolRunResult {
  /** Items deliberately not disputed, with a client-readable reason. */
  notDisputed: Array<{
    negativeItemId: string;
    furnisherName: string;
    reason: string;
    nextStep?: string;
  }>;
  counts: { letters: number; coach: number; hold: number; refuse: number };
  /** One line for the desk header. */
  summary: string;
}

/**
 * Run the protocol with the accuracy gate in front of it.
 *
 * `assessments` are keyed by negative-item id. Anything missing falls back to
 * `inferAssessment()`, which reads the isInaccurate / isOutdated / isUnverifiable
 * flags the import already sets — and returns "unknown" when nothing has been
 * ticked, so the gate holds rather than guessing.
 */
export function runGatedDisputeProtocol(
  profile: CreditProfile,
  items: NegativeItem[],
  assessments: Record<string, ItemAssessment> = {},
  cfg: DisputePolicyConfig = DEFAULT_DISPUTE_POLICY
): GatedRunResult {
  const active = items.filter((i) => i.status !== "removed" && i.status !== "closed");

  const resolved: Record<string, ItemAssessment> = {};
  for (const item of active) {
    resolved[item.id] = assessments[item.id] ?? inferAssessment(item);
  }

  const packet = renderPacket(profile, active, resolved, cfg);

  const lettersGenerated: DisputeLetterBatch[] = packet.letters.map(({ item, rendered }) => ({
    negativeItemId: item.id,
    furnisherName: item.furnisherName,
    bureau: item.bureau,
    roundNumber: rendered.roundNumber,
    roundType: rendered.roundType,
    letter: rendered.letter,
    // Generated, not sent. It becomes "sent" when a human actually mails it.
    status: "draft",
  }));

  const nextActions: string[] = [];

  if (packet.counts.hold > 0) {
    nextActions.push(
      `${packet.counts.hold} item(s) need an accuracy call before anything can be disputed`
    );
  }
  if (packet.counts.coach > 0) {
    nextActions.push(
      `${packet.counts.coach} item(s) are accurate — coach on behaviour and time, do not dispute`
    );
  }

  if (lettersGenerated.length === 0) {
    if (packet.counts.hold === 0 && packet.counts.coach === 0) {
      nextActions.push("No pending disputes — schedule a re-pull in 30-45 days");
    }
  } else {
    nextActions.push(`Review and send ${lettersGenerated.length} dispute letter(s)`);
    nextActions.push("Mail via certified mail with return receipt");
    nextActions.push("Log tracking numbers against the dispute rounds");
    nextActions.push("Set 30-day follow-up reminders");

    // Grouped by who the letter is actually aimed at, which is the thing that
    // changes how it gets sent.
    const byTarget: Record<string, number> = {};
    for (const { rendered } of packet.letters) {
      byTarget[rendered.target] = (byTarget[rendered.target] ?? 0) + 1;
    }
    for (const [target, n] of Object.entries(byTarget)) {
      nextActions.push(`${n} to the ${target}`);
    }
  }

  const bits = [`${packet.counts.letters} letter${packet.counts.letters === 1 ? "" : "s"}`];
  if (packet.counts.coach) bits.push(`${packet.counts.coach} to coach`);
  if (packet.counts.hold) bits.push(`${packet.counts.hold} awaiting an accuracy call`);
  if (packet.counts.refuse) bits.push(`${packet.counts.refuse} declined`);

  return {
    profileId: profile.id,
    itemsProcessed: active.length,
    lettersGenerated,
    nextActions,
    notDisputed: packet.notDisputed.map(({ item, reason, nextStep }) => ({
      negativeItemId: item.id,
      furnisherName: item.furnisherName,
      reason,
      nextStep,
    })),
    counts: packet.counts,
    summary: bits.join(" · "),
  };
}
