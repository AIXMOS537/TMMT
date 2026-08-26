/**
 * Thin wrappers around handoffToHuman with the exact voice reason strings.
 * Callers must not await — same fire-and-forget + .catch(() => undefined) as before.
 */
import { handoffToHuman } from "@/lib/agent/handoff";
import type { OrgContext } from "@/lib/agent/tenant";

function recentFromSnippet(
  transcriptSnippet?: string
): Array<{ direction: "in"; body: string }> {
  return transcriptSnippet ? [{ direction: "in", body: transcriptSnippet }] : [];
}

export function triggerBookedHandoff(args: {
  org: OrgContext;
  leadId: string;
  phone: string;
  transcriptSnippet?: string;
}): Promise<void> {
  return handoffToHuman({
    org: args.org,
    leadId: args.leadId,
    phone: args.phone,
    reason: "bella_voice_booked",
    recentMessages: recentFromSnippet(args.transcriptSnippet),
  }).catch(() => undefined);
}

export function triggerVoiceEscalation(args: {
  org: OrgContext;
  contactId: string;
  phone: string;
  transcriptSnippet?: string;
}): Promise<void> {
  return handoffToHuman({
    org: args.org,
    leadId: args.contactId,
    phone: args.phone,
    reason: "voice_escalation",
    recentMessages: recentFromSnippet(args.transcriptSnippet),
  }).catch(() => undefined);
}
