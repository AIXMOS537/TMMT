import Twilio from 'twilio'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isRateLimited } from '@/lib/rate-limit'
import { SmsBlockedError, type SmsType } from '../../../shared/compliance-gates/sms-gate'
import { assertOutboundAllowed } from '@/lib/outbound-gate'

export interface SendSmsArgs {
  from: string
  to: string
  body: string
  organizationId?: string
  /** Client for the do-not-contact / opt-out reads. Defaults to the service client. */
  db?: SupabaseClient | null
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
  // Outbound gate FIRST (src/lib/outbound-gate → shared/compliance-gates/sms-gate).
  // BLOCKs promotional SMS for A2P-restricted verticals (credit/funding/debt/
  // lending) — throws SmsBlockedError — HOLDs un-approved marketing, and refuses
  // numbers on the do-not-contact list or leads that opted out of this org.
  // Transactional is the safe default, so callers that don't pass vertical/type
  // are unaffected by the A2P part; the DNC/opt-out part applies to every send.
  const gate = await assertOutboundAllowed({
    db: args.db,
    phone: args.to,
    organizationId: args.organizationId,
    vertical: args.vertical ?? '',
    type: args.type ?? 'transactional',
    ownerApproved: args.ownerApproved,
  })
  if (!gate.allowed) {
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
