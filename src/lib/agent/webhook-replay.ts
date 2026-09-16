/**
 * App-side replay pre-check for signed webhooks (T-02b).
 *
 * Signature verification alone cannot stop a replay: Cal.com's HMAC carries no
 * timestamp and no nonce, and Stripe re-delivers the same `event.id` on retry
 * inside its 5-minute tolerance. Both routes already write one `audit_events`
 * row per processed event with the provider's stable id in `payload`, so that
 * row doubles as the idempotency record — the same F-01 shape as the Twilio
 * `MessageSid` in `agent_messages.metadata`.
 *
 * Two layers:
 *   soft — this lookup, run BEFORE any side effect (lead update, audit row);
 *   hard — the unique partial indexes in
 *          `supabase/migrations/20260909204306_audit_events_webhook_replay_indexes.sql`
 *          (APPLIED 2026-09-09) make the second audit INSERT fail with 23505
 *          when two deliveries race past the lookup. They only stop the audit
 *          row; the lead update before it has already run.
 *
 * Fails OPEN on a lookup error, and LOUDLY. Failing closed would turn any
 * error that repeats, like the missing column below, into dropping every
 * booking and payment. Cal.com's retries cannot be relied on, and Stripe
 * retries for three days and then may disable the endpoint. Processing a
 * duplicate is close to harmless: Cal sets the same `agent_status`, Stripe
 * sets `CLOSED` again and moves `closed_at` later, and the index drops the
 * second audit row. What a silent fail-open costs is that nobody sees the
 * guard is off. C-20: the lookup selected `created_at`, which `audit_events`
 * does not have (the column is `ts`, see ./audit-events-columns.ts), so every
 * call failed open from the day T-02b shipped with only a `console.warn`. A
 * lookup error now also reports `webhook-replay` through `src/lib/degraded.ts`,
 * so it shows up in `/api/health` and Sentry.
 *
 * `seenSyncEvent` (T-02c) is the same pre-check against `sync_events`, the
 * row the Airtable verified-lead webhook already writes. That route's key
 * (Airtable record id + crm_sync_records id) legitimately recurs — the sync
 * record is upserted in place and reset to pending on every GHL stage change,
 * then re-verified — so the caller pairs the lookup with the record's current
 * status and there is deliberately NO unique index behind it.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { clearDegraded, reportDegraded } from '@/lib/degraded'

export interface WebhookReplayKey {
  organizationId: string
  /** The audit action the route emits for this event, e.g. `cal.booking_created`. */
  action: string
  /** The `payload` field that holds the provider's stable id, e.g. `booking_uid`. */
  keyField: string
  /** The provider's id for this delivery. */
  key: string
}

export async function seenWebhookEvent(db: SupabaseClient, k: WebhookReplayKey): Promise<boolean> {
  const { data, error } = await db
    .from('audit_events')
    .select('ts')
    .eq('organization_id', k.organizationId)
    .eq('action', k.action)
    .eq(`payload->>${k.keyField}`, k.key)
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[webhook-replay] lookup failed, processing anyway', { action: k.action, message: error.message })
    reportDegraded('webhook-replay', error.message, { action: k.action, code: error.code })
    return false
  }
  clearDegraded('webhook-replay')
  return Boolean(data)
}

export interface SyncEventReplayKey {
  /** `sync_events.source`, e.g. `airtable`. */
  source: string
  /** `sync_events.event_type`, e.g. `record.verified`. */
  eventType: string
  /** The provider's record id the route stores in `sync_events.external_id`. */
  externalId: string
  /** The `crm_sync_records.id` the event was logged against. */
  syncRecordId: string
}

/** True when a `sync_events` row for this (source, type, external id, sync record) already exists. Fails OPEN. */
export async function seenSyncEvent(db: SupabaseClient, k: SyncEventReplayKey): Promise<boolean> {
  const { data, error } = await db
    .from('sync_events')
    .select('external_id')
    .eq('source', k.source)
    .eq('event_type', k.eventType)
    .eq('external_id', k.externalId)
    .eq('sync_record_id', k.syncRecordId)
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[webhook-replay] sync_events lookup failed, processing anyway', {
      source: k.source, eventType: k.eventType, message: error.message,
    })
    return false
  }
  return Boolean(data)
}
