import "server-only";

import { logMemoryEvent } from "@/lib/memory";
import {
  getEscalationChannel,
  isWithinWorkingHours,
  isDoNotContact,
} from "@/lib/channels";

/**
 * Escalate to the owner's work cell (the Mac M1 "top-tier assistant" line).
 *
 * Respects the channel topology: only the escalation channel is used, only
 * within its working hours (unless forced), and a do_not_contact number (the
 * personal line) is NEVER messaged. Transport is pluggable — a Tailscale-exposed
 * iMessage bridge (IMESSAGE_BRIDGE_URL) if configured, otherwise the escalation
 * is recorded in the brain as queued. Fail-open: never throws to the caller.
 */
export interface EscalateResult {
  ok: boolean;
  delivered: boolean;
  queued?: boolean;
  to?: string;
  reason?: string;
}

export async function escalateToOwner(
  text: string,
  opts?: { force?: boolean }
): Promise<EscalateResult> {
  try {
    const ch = await getEscalationChannel();
    if (!ch?.phone) {
      await logMemoryEvent({
        action: "owner_escalation_unconfigured",
        source: "system",
        actorKind: "system",
        actorLabel: "escalation",
        summary: "Owner escalation requested but no work-cell channel configured",
        details: { text },
      });
      return { ok: true, delivered: false, queued: true, reason: "no escalation channel" };
    }

    // Hard guard: never contact a do_not_contact number (the personal line).
    if (await isDoNotContact(ch.phone)) {
      return { ok: true, delivered: false, to: ch.phone, reason: "channel is do_not_contact" };
    }

    const within = isWithinWorkingHours(ch.working_hours);
    if (!within && !opts?.force) {
      await logMemoryEvent({
        action: "owner_escalation_queued",
        source: "system",
        actorKind: "system",
        actorLabel: "escalation",
        summary: `Owner escalation queued (outside working hours): ${text}`,
        details: { to: ch.phone, text },
      });
      return { ok: true, delivered: false, queued: true, to: ch.phone, reason: "outside working hours" };
    }

    let delivered = false;
    const bridge = process.env.IMESSAGE_BRIDGE_URL;
    if (bridge) {
      try {
        const res = await fetch(bridge, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(process.env.IMESSAGE_BRIDGE_TOKEN
              ? { authorization: `Bearer ${process.env.IMESSAGE_BRIDGE_TOKEN}` }
              : {}),
          },
          body: JSON.stringify({ to: ch.phone, text }),
        });
        delivered = res.ok;
      } catch {
        delivered = false;
      }
    }

    await logMemoryEvent({
      action: "owner_escalation",
      source: "system",
      actorKind: "system",
      actorLabel: "escalation",
      summary: `Owner escalation${delivered ? " delivered" : " (queued)"}: ${text}`,
      details: {
        to: ch.phone,
        text,
        delivered,
        transport: bridge ? "imessage_bridge" : "none",
      },
    });

    return {
      ok: true,
      delivered,
      queued: !delivered,
      to: ch.phone,
      reason: delivered ? undefined : "no transport configured (recorded as queued)",
    };
  } catch (err) {
    console.error("[escalate] threw:", (err as Error).message);
    return { ok: false, delivered: false, reason: (err as Error).message };
  }
}
