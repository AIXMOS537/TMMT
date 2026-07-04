import Twilio from 'twilio'
import { isRateLimited } from '@/lib/rate-limit'
import { assertSmsAllowed, SmsBlockedError, type SmsType } from '../../../shared/compliance-gates/sms-gate'

export interface SendSmsArgs {
  from: string
  to: string
  body: string
  organizationId?: string
  twilioAccountSid?: string
  twilioAuthToken?: string
  /** Use-case/vertical, e.g. "rentals" | "credit_repair" | "funding". Drives the SMS compliance gate. */
  vertical?: string
  /** Carrier message class. Defaults to "transactional" — the safe default. */
  type?: SmsType
  /** True only after an owner has explicitly approved a marketing send. */
  ownerApproved?: boolean
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
  // Compliance gate FIRST (shared/compliance-gates/sms-gate). BLOCKs promotional
  // SMS for A2P-restricted verticals (credit/funding/debt/lending) — throws
  // SmsBlockedError — and HOLDs un-approved marketing. Transactional is the safe
  // default, so callers that don't pass vertical/type are unaffected.
  const gate = assertSmsAllowed({
    vertical: args.vertical ?? '',
    type: args.type ?? 'transactional',
    owner_approved: args.ownerApproved,
  })
  if (gate.decision === 'HOLD') {
    throw new SmsBlockedError(gate.reason)
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
