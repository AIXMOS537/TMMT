/**
 * Write a STOP to the GLOBAL do-not-contact list.
 *
 * The gap this closes: `isOptOutMessage()` fires, the inbound route sets
 * `incoming_leads.opted_out` on that lead row, and that is where it stopped.
 * `public.do_not_contact_numbers` — the list `assertOutboundAllowed()` checks
 * on EVERY outbound message, for every org — was never written to by any code
 * path. Its 12 rows were all put there by hand.
 *
 * Why the per-lead flag is not enough:
 *   · it is scoped to one organization_id; another org can text the same person
 *   · the outbound opt-out check matches on (organization_id, phone_e164), so a
 *     re-imported lead — a NEW row, opted_out defaulting to false — reads clear
 *   · a person who says stop means stop, not "stop from this one record"
 *
 * Timing note, verified 2026-09-11: `agent_messages` holds ZERO rows, so this
 * inbound path has never processed a message in production and no opt-out has
 * actually been lost yet. That makes this a fix applied BEFORE the path carries
 * traffic, which is the right time to apply it, not a cleanup after harm.
 *
 * Live schema (checked, not assumed): do_not_contact_numbers is
 *   phone10 text NOT NULL PRIMARY KEY · reason text NULL · added_at timestamptz
 * There is NO `source` column. Provenance goes in `reason`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { phone10 } from '@/lib/outbound-gate'

export type RecordOptOutResult = {
  ok: boolean
  phone10: string | null
  /** Why it did not land, for the compliance flags on the message record. */
  error?: string
}

/**
 * Idempotent. A second STOP from the same number is a no-op, and deliberately
 * does NOT overwrite the original `reason` — the first record of why someone
 * is on this list is the one worth keeping.
 */
export async function recordGlobalOptOut(
  db: SupabaseClient,
  phone: string | null | undefined,
  reason = 'inbound STOP',
): Promise<RecordOptOutResult> {
  const p10 = phone10(phone)
  if (!p10) return { ok: false, phone10: null, error: 'unparseable_phone' }

  const { error } = await db
    .from('do_not_contact_numbers')
    .upsert({ phone10: p10, reason }, { onConflict: 'phone10', ignoreDuplicates: true })

  if (error) {
    // Loud on purpose. A compliance write that fails silently is how a
    // suppression list ends up looking complete while being empty.
    console.error('[opt-out] FAILED to add to do_not_contact_numbers:', p10, error.message)
    return { ok: false, phone10: p10, error: error.message }
  }
  return { ok: true, phone10: p10 }
}
