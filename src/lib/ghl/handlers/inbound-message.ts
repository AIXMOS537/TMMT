/**
 * Lead-net inbound-message handler (docs/LEAD-NET-SPEC.md §4).
 *
 * When GHL forwards an inbound customer message (SMS/FB/etc.), start a reply
 * clock: a GHL task on the contact due in 1 hour, plus a quiet Slack ping so
 * the front desk sees it without polling. This is the "Nick Bing fix" — an
 * unanswered customer message can no longer sit silently.
 *
 * Best-effort everywhere: a failure here must never 500 the webhook.
 */
import { createGhlContactTask } from "@/lib/ghl/client";
import { notifySlack } from "@/lib/notify";

export interface InboundMessagePayload {
  contactId: string;
  body?: string;
  contactName?: string;
  messageType?: string;
}

/** Loose shape check for GHL inbound-message webhook payloads. */
export function isInboundMessagePayload(
  body: Record<string, unknown>
): body is Record<string, unknown> & InboundMessagePayload {
  const type = typeof body.type === "string" ? body.type : "";
  const direction = typeof body.direction === "string" ? body.direction : "";
  const hasContact = typeof body.contactId === "string" && body.contactId.length > 0;
  return (
    hasContact &&
    (type === "InboundMessage" || direction.toLowerCase() === "inbound")
  );
}

export async function handleInboundMessage(
  payload: InboundMessagePayload
): Promise<{ status: number; body: Record<string, unknown> }> {
  const who = payload.contactName?.trim() || payload.contactId;
  const preview = (payload.body ?? "").slice(0, 140);

  await createGhlContactTask({
    contactId: payload.contactId,
    title: `Reply to ${who} (inbound ${payload.messageType ?? "message"})`,
    body: `Lead-net reply clock — answer within 1 hour. Message: "${preview}"`,
    dueAt: new Date(Date.now() + 60 * 60 * 1000),
  }).catch(() => {});

  await notifySlack(
    `💬 Inbound ${payload.messageType ?? "message"} from ${who}: "${preview}" — reply clock started (1h). GHL → Conversations.`
  );

  return { status: 200, body: { ok: true, handled: "inbound-message" } };
}
