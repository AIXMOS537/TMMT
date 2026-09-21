/**
 * Owner-approval hold for AI-generated customer replies.
 *
 * The operating rule (config/identity.config.json → compliance.owner_approval_gate)
 * is "required for all customer-facing and financial actions". The outbound
 * gate only holds `marketing` sends, and an AI reply to an inbound SMS is
 * `transactional`, so until this module AI text went straight to the customer.
 *
 * Default: HOLD. The AI reply is stored as a draft (agent_messages, flag
 * `held_owner_approval`) and nothing is sent.
 *
 * `B3_AUTO_REPLY_ORGS` is a comma-separated list of organization ids that the
 * owner has explicitly authorised for automatic AI replies. Empty or unset
 * means no organization. There is no wildcard. Being a house org, having an
 * active licence, a Twilio number or budget left does NOT make an org
 * eligible; only this list does.
 *
 * The list authorises the auto-reply CAPABILITY only. It bypasses nothing:
 * communication control, the opted-out guard, the outbound gate
 * (do-not-contact, A2P), the kill switch, the licence, the spend cap, content
 * safety and quiet hours all still run before a reply can leave. Credit or
 * lending interactions must not be put on the list until a purpose/capability
 * control exists (C-21 audit).
 *
 * Fixed compliance acknowledgements (STOP / START) are not AI replies and are
 * never held here; see compliance/communication-control.ts and the route.
 */
export function autoReplyAuthorizedOrgs(raw: string | undefined = process.env.B3_AUTO_REPLY_ORGS): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((id) => id.trim().toLowerCase())
      .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)),
  )
}

export function isAutoReplyAuthorized(organizationId: string, raw?: string): boolean {
  return autoReplyAuthorizedOrgs(raw).has(organizationId.trim().toLowerCase())
}
