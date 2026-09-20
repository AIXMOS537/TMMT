/**
 * Consent to be contacted — the fifth check, and the one we could not make.
 *
 * The other four checks in the outbound gate answer "has this person told us to
 * stop?". None of them answer "did this person ever say yes?". That is the gap
 * this closes, and it is the one a carrier actually asks about.
 *
 * THREE MODES, because switching straight to enforcement would be reckless.
 * Measured on the live table: about 7% of 883 leads came through a form we
 * control; 69% have source 'unknown'. Turning on enforcement today would block
 * roughly nine in ten contacts overnight — including people who genuinely did
 * consent, whose paperwork simply predates the column.
 *
 *   'off'      — no check. Today's behaviour, stated explicitly.
 *   'shadow'   — evaluate, FLAG, and allow. This is the default: it tells you
 *                exactly what enforcement would cost before it costs it.
 *   'enforce'  — no consent record, no send.
 *
 * Shadow mode is not a fudge. It is the difference between "we think most of
 * the list is fine" and a number. The flag it raises is written onto the
 * message record, so the answer accumulates from real traffic rather than from
 * a migration everyone argues about.
 *
 * Set with CONTACT_CONSENT_MODE. Unset means shadow, because a mode you forgot
 * to configure should measure, not silently do nothing and not silently break
 * everything.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const CONSENT_SOURCES = [
  'web_form',
  'sms_double_optin',
  'verbal_recorded',
  'written',
  'imported_claimed',
] as const
export type ConsentSource = (typeof CONSENT_SOURCES)[number]

export type ConsentMode = 'off' | 'shadow' | 'enforce'

export function consentMode(raw = process.env.CONTACT_CONSENT_MODE): ConsentMode {
  const t = (raw ?? '').trim().toLowerCase()
  if (t === 'off' || t === 'enforce') return t
  return 'shadow'
}

export type ConsentDecision = {
  /** Whether the send may proceed. In shadow mode this is always true. */
  allowed: boolean
  /** Whether a consent record actually exists. Independent of `allowed`. */
  hasConsent: boolean
  mode: ConsentMode
  flags: string[]
}

/**
 * `hasConsent` and `allowed` are deliberately separate fields. Collapsing them
 * is how a shadow mode turns into a lie: the caller needs to know both "may I
 * send" and "would this have been blocked", and one boolean cannot carry both.
 */
export async function checkConsent(
  db: SupabaseClient,
  args: { organizationId?: string | null; phone?: string | null; mode?: ConsentMode },
): Promise<ConsentDecision> {
  const mode = args.mode ?? consentMode()
  if (mode === 'off') {
    return { allowed: true, hasConsent: false, mode, flags: ['consent_check_off'] }
  }

  // Without an org and a phone there is no row to look at. Unknown, not consented.
  if (!args.organizationId || !args.phone) {
    return {
      allowed: mode !== 'enforce',
      hasConsent: false,
      mode,
      flags: [mode === 'enforce' ? 'consent_missing' : 'consent_missing_shadow'],
    }
  }

  const { data, error } = await db
    .from('incoming_leads')
    .select('consent_source, consent_at')
    .eq('organization_id', args.organizationId)
    .eq('phone_e164', args.phone)
    .limit(1)
    .maybeSingle()

  // A check that cannot run has not passed. In enforce mode that refuses; in
  // shadow it is flagged so an unreadable column shows up as a real number
  // rather than as silence.
  if (error) {
    console.warn('[consent] lookup failed:', error.message)
    return {
      allowed: mode !== 'enforce',
      hasConsent: false,
      mode,
      flags: ['consent_unverified'],
    }
  }

  const row = data as { consent_source: string | null; consent_at: string | null } | null
  const hasConsent = Boolean(row?.consent_source && row.consent_at)

  if (hasConsent) return { allowed: true, hasConsent: true, mode, flags: ['consent_ok'] }

  return {
    allowed: mode !== 'enforce',
    hasConsent: false,
    mode,
    flags: [mode === 'enforce' ? 'consent_missing' : 'consent_missing_shadow'],
  }
}
