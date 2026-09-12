/**
 * The one door every customer-bound EMAIL goes through.
 *
 * Same shape and same order as src/lib/outbound-gate.ts, which does this for
 * SMS. Four checks, first failure wins, and every failure mode fails CLOSED:
 *
 *   1. Compliance gate  — the shared A2P gate, so a restricted vertical cannot
 *      quietly switch channel from SMS to email to get around its own hold.
 *      This is the whole reason email is not just a new notify() function.
 *   2. Do-not-contact   — public.do_not_contact_emails. A read error refuses
 *      the send. Silence is the safe answer for a check that could not run.
 *   3. Per-lead opt-out — incoming_leads.opted_out, same as the SMS lane.
 *   4. Quiet hours      — 9pm-8am local.
 *
 * On quiet hours, honestly: TCPA quiet hours govern calls and texts, not email,
 * and CAN-SPAM imposes none. We apply them anyway because the order was that
 * email follows the same rules as SMS, and because an 11pm sales email is a
 * complaint waiting to happen. It is stricter than the law requires, which is
 * the direction to be wrong in. It only applies when we know a phone for the
 * contact — without one there is no defensible local timezone to judge, and
 * inventing one would be worse than skipping the check.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertSmsAllowed, type SmsType } from '../../../shared/compliance-gates/sms-gate'
import { createServiceRoleClient } from '@/lib/supabase-service'
import { isQuietHours } from '@/lib/agent/compliance/quiet-hours'
import { normalizeEmail } from './dnc'

export type EmailCheckArgs = {
  db?: SupabaseClient | null
  /** Destination address. Normalised before any comparison. */
  email?: string | null
  /** Phone for this contact, if known. Only used to pick a timezone for quiet hours. */
  phone?: string | null
  organizationId?: string | null
  vertical?: string
  type?: SmsType
  ownerApproved?: boolean
  /** Injected for tests. Defaults to now. */
  now?: Date
}

export type EmailOutboundReason =
  | 'ok'
  | 'gate_hold'
  | 'bad_address'
  | 'dnc'
  | 'dnc_unverified'
  | 'opted_out'
  | 'quiet_hours'

export type EmailOutboundDecision = {
  allowed: boolean
  reason: EmailOutboundReason
  flags: string[]
}

export async function assertEmailAllowed(args: EmailCheckArgs): Promise<EmailOutboundDecision> {
  // 1. Compliance gate. BLOCK throws (a restricted marketing send is a bug, not
  //    a runtime condition); HOLD is an un-approved marketing send.
  const gate = assertSmsAllowed({
    vertical: args.vertical ?? '',
    type: args.type ?? 'transactional',
    owner_approved: args.ownerApproved,
  })
  if (gate.decision === 'HOLD') {
    return { allowed: false, reason: 'gate_hold', flags: ['gate_hold'] }
  }
  const flags = ['gate_allow']

  // An unparseable address cannot be checked against the block list, so it
  // cannot be cleared either. Refuse rather than send somewhere unverifiable.
  const norm = normalizeEmail(args.email)
  if (!norm) return { allowed: false, reason: 'bad_address', flags: [...flags, 'bad_address'] }

  const db = args.db ?? createServiceRoleClient()

  // 2. Do-not-contact. Fail closed on a read error — including the error you
  //    get while the staged migration is unapplied and the table does not exist.
  const dnc = await db
    .from('do_not_contact_emails')
    .select('email_norm')
    .eq('email_norm', norm)
    .limit(1)
    .maybeSingle()
  if (dnc.error) {
    console.warn('[email-gate] do_not_contact_emails read failed; refusing to send:', dnc.error.message)
    return { allowed: false, reason: 'dnc_unverified', flags: [...flags, 'dnc_unverified'] }
  }
  if (dnc.data) return { allowed: false, reason: 'dnc', flags: [...flags, 'dnc'] }
  flags.push('dnc_clear')

  // 3. Per-lead opt-out. An opt-out is a person saying stop, not a person
  //    saying stop texting — so it suppresses this channel too.
  if (args.organizationId && norm) {
    const lead = await db
      .from('incoming_leads')
      .select('opted_out')
      .eq('organization_id', args.organizationId)
      .eq('email', norm)
      .limit(1)
      .maybeSingle()
    if (lead.error) {
      console.warn('[email-gate] incoming_leads read failed; refusing to send:', lead.error.message)
      return { allowed: false, reason: 'opted_out', flags: [...flags, 'optout_unverified'] }
    }
    if (lead.data?.opted_out) {
      return { allowed: false, reason: 'opted_out', flags: [...flags, 'opted_out'] }
    }
  }

  // 4. Quiet hours, only when a phone gives us a real timezone to judge by.
  if (args.phone && isQuietHours(args.phone, args.now ?? new Date())) {
    return { allowed: false, reason: 'quiet_hours', flags: [...flags, 'quiet_hours'] }
  }

  return { allowed: true, reason: 'ok', flags }
}
