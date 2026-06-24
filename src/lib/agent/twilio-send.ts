import Twilio from 'twilio'
import { isRateLimited } from '@/lib/rate-limit'
import { assertSmsAllowed, type SmsType } from '@shared/compliance-gates/sms-gate'

export interface SendSmsArgs {
  from: string
  to: string
  body: string
  /**
   * A2P SMS class for the sending org (e.g. "rentals", "credit_repair").
   * Use a2pSmsClassForSlug() from the vertical registry to derive it.
   */
  vertical: string
  /** Carrier message class. Marketing always needs prior owner approval. */
  smsType: SmsType
  /** Set true only after an owner has explicitly approved this send. */
  ownerApproved?: boolean
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

/**
 * Per-tenant outbound SMS rate cap. Twilio's API limit is ~1 msg/sec/from,
 * but bursting from one tenant can exhaust shared connections and starve
 * other tenants. Hold each tenant to 30 sends/minute = 1800/hour, plenty
 * for legitimate sales-agent traffic. Pass organizationId to gate by org.
 * Calls without an org id (eg ad-hoc tooling) bypass — they're rare and
 * not on the inbound path.
 */
export async function sendSms(args: SendSmsArgs): Promise<{ sid: string }> {
  // Compliance gate FIRST — before credentials, rate limit, or network.
  // Throws SmsBlockedError on a prohibited send (e.g. promotional SMS to a
  // restricted credit/funding vertical). Marketing without owner approval
  // returns HOLD here; callers must route HOLD to the owner-approval queue
  // rather than calling sendSms.
  const gate = assertSmsAllowed({
    vertical: args.vertical,
    type: args.smsType,
    owner_approved: args.ownerApproved,
  })
  if (gate.decision === 'HOLD') {
    throw new Error(
      'SMS HELD: marketing send requires owner approval before reaching sendSms. ' +
        'Route it through the owner-approval gate first.'
    )
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
