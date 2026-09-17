/**
 * Replay protection for Bella's mid-call webhook.
 *
 * The hole: `POST /api/agent/voice/ghl` authenticates with a STATIC shared
 * secret in a header — not an HMAC over the body — so anyone who captures one
 * valid request can resend that exact body forever. And these actions have real
 * effects: book_handoff writes a lead and books, escalate_human pages a person,
 * qualify_lead and tag_vertical mutate the contact. A replayed book_handoff is
 * a fake booking; a replayed escalate_human is a phone ringing for a call that
 * ended yesterday.
 *
 * Why this is not just a call to the existing seenWebhookEvent(): that guard
 * keys on a stable provider event id, and GHL Voice AI custom actions do not
 * document one. So this takes the key it can get, best first, and NO DECISION
 * IS NEEDED UP FRONT:
 *
 *   1. `call_id` if the custom action sends one (add "call_id":"{{call.id}}"
 *      to the five action bodies in the GHL console). Exact, no time window,
 *      correct forever. This is the good key.
 *   2. Otherwise `contact_id` within a short window. Weaker — it also swallows
 *      a genuine second identical action on the same call — but it stops a
 *      naive replay, and it needs nothing configured.
 *
 * The fallback is deliberately narrow: same contact AND same action AND inside
 * the window. A caller who rings back tomorrow is not suppressed.
 *
 * This file also closes a second gap found on the way in: the voice handler
 * emitted NO audit events at all. There was no trail of what Bella did on a
 * call, which is both a compliance gap on its own and the reason there was
 * nothing for a replay check to look at.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/** How long two identical actions on one contact are treated as the same event. */
export const VOICE_REPLAY_WINDOW_SECONDS = 120

export const voiceAuditAction = (action: string) => `voice.${action}`

export type VoiceReplayKey = {
  organizationId: string
  action: string
  callId?: string | null
  contactId?: string | null
  now?: Date
}

export type VoiceReplayVerdict = {
  seen: boolean
  /** Which key decided it — useful in logs and worth knowing in a report. */
  keyed: 'call_id' | 'contact_window' | 'none'
}

/**
 * Fails OPEN on a lookup error, matching webhook-replay.ts. Dropping a real
 * mid-call action because of a database blip would break a live conversation
 * with a customer on the line; processing a duplicate is the lesser harm. The
 * warning makes the blip diagnosable.
 */
export async function seenVoiceEvent(
  db: SupabaseClient,
  k: VoiceReplayKey,
): Promise<VoiceReplayVerdict> {
  const auditAction = voiceAuditAction(k.action)

  // 1. The good key.
  const callId = (k.callId ?? '').trim()
  if (callId) {
    const { data, error } = await db
      .from('audit_events')
      .select('id')
      .eq('organization_id', k.organizationId)
      .eq('action', auditAction)
      .eq('payload->>call_id', callId)
      .limit(1)
      .maybeSingle()
    if (error) {
      console.warn('[voice-replay] call_id lookup failed, processing anyway:', error.message)
      return { seen: false, keyed: 'call_id' }
    }
    return { seen: Boolean(data), keyed: 'call_id' }
  }

  // 2. The fallback.
  const contactId = (k.contactId ?? '').trim()
  if (!contactId) return { seen: false, keyed: 'none' }

  const since = new Date((k.now ?? new Date()).getTime() - VOICE_REPLAY_WINDOW_SECONDS * 1000)
  const { data, error } = await db
    .from('audit_events')
    .select('id')
    .eq('organization_id', k.organizationId)
    .eq('action', auditAction)
    .eq('payload->>contact_id', contactId)
    .gte('created_at', since.toISOString())
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[voice-replay] contact-window lookup failed, processing anyway:', error.message)
    return { seen: false, keyed: 'contact_window' }
  }
  return { seen: Boolean(data), keyed: 'contact_window' }
}
