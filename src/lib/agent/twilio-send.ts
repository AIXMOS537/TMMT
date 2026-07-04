import Twilio from 'twilio'
import { isRateLimited } from '@/lib/rate-limit'

export interface SendSmsArgs {
  from: string
  to: string
  body: string
  organizationId?: string
  twilioAccountSid?: string
  twilioAuthToken?: string
}

export class TwilioRateLimitedError extends Error {
  constructor(public organizationId: string) {
    super(`Twilio send rate-limited for organization=${organizationId}`)
    this.name = 'TwilioRateLimitedError'
  }
}

/** Thrown when OWNER_APPROVAL_ENFORCE is on: the SMS was queued for the owner
 *  console instead of sent. The caller should treat this as "held, not failed". */
export class OwnerApprovalPendingError extends Error {
  constructor(public actionId: string) {
    super(`Outbound SMS queued for owner approval (action=${actionId}) — not sent.`)
    this.name = 'OwnerApprovalPendingError'
  }
}

/**
 * Per-tenant outbound SMS rate cap. Twilio's API limit is ~1 msg/sec/from,
 * but bursting from one tenant can exhaust shared connections and starve
 * other tenants. Hold each tenant to 30 sends/minute = 1800/hour, plenty
 * for legitimate sales-agent traffic. Pass organizationId to gate by org.
 * Calls without an org id (eg ad-hoc tooling) bypass — they're rare and
 * not on the inbound path.
 */
export async function sendSms(args: SendSmsArgs): Promise<{ sid: string }> {
  // Owner-approval gate (root CLAUDE.md §2). When enforcement is on, a customer
  // message never sends inline — it's recorded as a pending gated action and
  // surfaced in the /approvals console, where an owner approves before it goes.
  // Lazy import keeps the server-only persistence layer off the module graph
  // when the flag is off (default), so nothing changes until it's switched on.
  if (process.env.OWNER_APPROVAL_ENFORCE === '1') {
    const { recordPendingAction } = await import('@/lib/approvals')
    const action = await recordPendingAction(
      'customer_message',
      {
        channel: 'sms',
        from: args.from,
        to: args.to,
        body: args.body,
        organizationId: args.organizationId ?? null,
      },
      args.organizationId ?? 'b3-sms-agent',
    )
    throw new OwnerApprovalPendingError(action.id)
  }

  const sid = args.twilioAccountSid ?? process.env.TWILIO_ACCOUNT_SID
  const tok = args.twilioAuthToken ?? process.env.TWILIO_AUTH_TOKEN
  if (!sid || !tok) throw new Error('Twilio credentials missing (SID or AUTH_TOKEN)')

  if (args.organizationId) {
    if (isRateLimited(`twilio-send:${args.organizationId}`, { windowMs: 60_000, maxHits: 30 })) {
      throw new TwilioRateLimitedError(args.organizationId)
    }
  }

  const client = Twilio(sid, tok)
  const msg = await client.messages.create({ from: args.from, to: args.to, body: args.body })
  return { sid: msg.sid }
}
