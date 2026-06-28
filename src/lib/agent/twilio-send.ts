import Twilio from 'twilio'
import { isRateLimited } from '@/lib/rate-limit'
import { evaluateSmsCompliance, type SmsMessageType } from '@/lib/agent/sms-compliance-gate'

export interface SendSmsArgs {
  from: string
  to: string
  body: string
  organizationId?: string
  twilioAccountSid?: string
  twilioAuthToken?: string
  /** Vertical slug or compliance category — gates restricted-vertical promotional SMS. */
  vertical?: string | null
  /** Defaults to "transactional" (safe). "marketing" on a restricted vertical is blocked. */
  messageType?: SmsMessageType
  /**
   * Owner approval for THIS send. Per the owner-approval gate (CLAUDE.md §2), no
   * customer-facing message goes out without it: a "marketing" send requires
   * ownerApproved === true or it is HELD (throws). Transactional sends don't.
   */
  ownerApproved?: boolean
}

export class TwilioRateLimitedError extends Error {
  constructor(public organizationId: string) {
    super(`Twilio send rate-limited for organization=${organizationId}`)
    this.name = 'TwilioRateLimitedError'
  }
}

export class SmsComplianceBlockedError extends Error {
  constructor(public reason: string) {
    super(`SMS blocked by compliance gate: ${reason}`)
    this.name = 'SmsComplianceBlockedError'
  }
}

export class SmsOwnerApprovalRequiredError extends Error {
  constructor(public reason: string) {
    super(`SMS held for owner approval: ${reason}`)
    this.name = 'SmsOwnerApprovalRequiredError'
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
  // Owner-approval + A2P/CROA gate, enforced at send-time:
  //  • BLOCK → promotional SMS on a restricted vertical (carrier + CROA): refuse.
  //  • HOLD  → a marketing message awaiting owner approval: refuse until approved.
  // Marketing sends require explicit owner approval (CLAUDE.md §2); transactional
  // sends (the safe default) do not.
  const gate = evaluateSmsCompliance({
    vertical: args.vertical,
    messageType: args.messageType,
    requiresOwnerApproval: args.messageType === 'marketing',
    ownerApproved: args.ownerApproved,
  })
  if (gate.decision === 'BLOCK') throw new SmsComplianceBlockedError(gate.reason)
  if (gate.decision === 'HOLD') throw new SmsOwnerApprovalRequiredError(gate.reason)

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
