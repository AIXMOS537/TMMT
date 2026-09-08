/**
 * The one door every customer-bound message goes through.
 *
 * Three checks, in order, and the first failure wins:
 *  1. A2P compliance gate (shared/compliance-gates/sms-gate): BLOCK throws,
 *     HOLD (un-approved marketing) is "not allowed".
 *  2. Do-not-contact list (public.do_not_contact_numbers, keyed by the last
 *     ten digits). A read failure is treated as "not allowed" — silence is
 *     the safe default for a compliance check that could not run.
 *  3. Per-lead opt-out (incoming_leads.opted_out for this phone + org).
 *
 * Callers: the Twilio sender, the GHL conversation sender, and the inbound
 * SMS route (its TwiML reply is an outbound message even though it never
 * touches a send API). src/lib/owner-approval-enforcement.test.ts makes that
 * structural: an outbound path that does not reference this gate fails CI.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertSmsAllowed, type SmsType } from '../../shared/compliance-gates/sms-gate'
import { createServiceSupabase } from '@/lib/agent/supabase-server'

export type OutboundCheckArgs = {
  /** Client able to read do_not_contact_numbers and incoming_leads. Defaults to the service client. */
  db?: SupabaseClient | null
  /** Destination phone in any format; only the last ten digits are matched. */
  phone?: string | null
  /** Org whose lead record holds the opt-out flag. Omit to skip the opt-out check. */
  organizationId?: string | null
  /** Use-case/vertical for the A2P gate, e.g. "rentals" | "credit_repair" | "funding". */
  vertical?: string
  /** Carrier message class. Defaults to transactional — the safe default. */
  type?: SmsType
  /** True only after an owner has explicitly approved a marketing send. */
  ownerApproved?: boolean
}

export type OutboundReason = 'ok' | 'gate_hold' | 'dnc' | 'dnc_unverified' | 'opted_out'

export type OutboundDecision = {
  allowed: boolean
  reason: OutboundReason
  /** Audit flags for agent_messages.compliance_flags. */
  flags: string[]
}

/** Last ten digits, or null when there are fewer than ten. */
export function phone10(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : null
}

/**
 * The A2P vertical for an organization. The gate's restricted set is named by
 * use case (see config/identity.config.json → compliance.sms_restricted_verticals),
 * and organizations do not yet carry that field, so the partner slug is the
 * best available proxy. An org that matches nothing is unrestricted — which is
 * today's behaviour, made explicit. Remediation plan F-02b tracks the column.
 */
export function orgSmsVertical(org: { partnerAppSlug?: string | null } | null | undefined): string {
  return org?.partnerAppSlug?.trim() ?? ''
}

export async function assertOutboundAllowed(args: OutboundCheckArgs): Promise<OutboundDecision> {
  // 1. A2P gate. BLOCK throws SmsBlockedError; that is deliberate — a restricted
  //    marketing send is a programming error, not a runtime condition.
  const gate = assertSmsAllowed({
    vertical: args.vertical ?? '',
    type: args.type ?? 'transactional',
    owner_approved: args.ownerApproved,
  })
  if (gate.decision === 'HOLD') {
    return { allowed: false, reason: 'gate_hold', flags: ['gate_hold'] }
  }
  const flags = ['gate_allow']

  const p10 = phone10(args.phone)
  if (!p10) return { allowed: true, reason: 'ok', flags }

  const db = args.db ?? createServiceSupabase()

  // 2. Do-not-contact. Fail closed on a read error.
  const dnc = await db
    .from('do_not_contact_numbers')
    .select('phone10')
    .eq('phone10', p10)
    .limit(1)
    .maybeSingle()
  if (dnc.error) {
    console.warn('[outbound-gate] do_not_contact_numbers read failed; refusing to send:', dnc.error.message)
    return { allowed: false, reason: 'dnc_unverified', flags: [...flags, 'dnc_unverified'] }
  }
  if (dnc.data) return { allowed: false, reason: 'dnc', flags: [...flags, 'dnc'] }
  flags.push('dnc_clear')

  // 3. Per-lead opt-out for this org. No lead row = nothing to honour.
  if (args.organizationId && args.phone) {
    const lead = await db
      .from('incoming_leads')
      .select('opted_out')
      .eq('organization_id', args.organizationId)
      .eq('phone_e164', args.phone)
      .limit(1)
      .maybeSingle()
    if (lead.error) {
      console.warn('[outbound-gate] incoming_leads read failed; refusing to send:', lead.error.message)
      return { allowed: false, reason: 'opted_out', flags: [...flags, 'optout_unverified'] }
    }
    if (lead.data?.opted_out) return { allowed: false, reason: 'opted_out', flags: [...flags, 'opted_out'] }
  }

  return { allowed: true, reason: 'ok', flags }
}
