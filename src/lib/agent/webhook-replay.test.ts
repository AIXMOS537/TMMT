import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFakeSupabase, type FakeSupabase } from '@/lib/testing/fake-supabase'
import { auditEventsColumnError, unknownAuditEventsColumn } from '@/lib/testing/audit-events-schema'
import { AUDIT_EVENTS_COLUMNS } from './audit-events-columns'
import { seenWebhookEvent, type WebhookReplayKey } from './webhook-replay'

/**
 * C-20 regression. The route tests answer `audit_events` lookups no matter
 * which column they name, so `.select('created_at')` passed there while
 * production answers that column with 42703, which the guard treats as "not seen".
 *
 * `strictAuditEvents` does what PostgREST does: a column that is not in
 * AUDIT_EVENTS_COLUMNS (verified read-only on production 2026-09-16, recorded
 * by hand, not auto-synced) gets the 42703 error. A lookup that names a wrong
 * column now returns `false` for an event that IS stored, and the hit test
 * below fails.
 */
const ORG = '11111111-1111-4111-8111-111111111111'
const KEY: WebhookReplayKey = { organizationId: ORG, action: 'cal.booking_created', keyField: 'booking_uid', key: 'bk_c20' }

type Row = { ts: string; organization_id: string; action: string; payload: Record<string, unknown> }
const stored: Row = { ts: '2026-09-16T00:00:00.000Z', organization_id: ORG, action: 'cal.booking_created', payload: { booking_uid: 'bk_c20' } }

const known = new Set<string>(AUDIT_EVENTS_COLUMNS)

function strictAuditEvents(rows: Row[]): FakeSupabase {
  return makeFakeSupabase((call) => {
    if (call.table !== 'audit_events') return undefined
    const schemaError = auditEventsColumnError(call)
    if (schemaError) return schemaError
    const match = rows.find((r) =>
      call.filters.every(([m, col, value]) => {
        if (m !== 'eq') return true
        const c = String(col)
        if (c.startsWith('payload->>')) return r.payload[c.slice('payload->>'.length)] === value
        return (r as Record<string, unknown>)[c] === value
      }),
    )
    const cols = (call.columns ?? '').split(',').map((c) => c.trim())
    return { data: match ? Object.fromEntries(cols.map((c) => [c, (match as Record<string, unknown>)[c]])) : null }
  })
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('seenWebhookEvent against the real audit_events columns (C-20)', () => {
  it('pins the production column list: the timestamp is ts, there is no created_at', () => {
    expect([...AUDIT_EVENTS_COLUMNS]).toEqual(['id', 'ts', 'organization_id', 'hardware_uuid', 'ip', 'action', 'payload'])
    expect(known.has('created_at')).toBe(false)
  })

  it('names only columns that exist, in the select and in every filter', async () => {
    const db = strictAuditEvents([])
    await seenWebhookEvent(db, KEY)
    const [call] = db.calls
    expect(call.columns).toBe('ts')
    expect(unknownAuditEventsColumn(call)).toBeUndefined()
  })

  it('finds a stored event, so the replay is caught (was: 42703, treated as not seen)', async () => {
    const db = strictAuditEvents([stored])
    await expect(seenWebhookEvent(db, KEY)).resolves.toBe(true)
  })

  it('first delivery is not seen; once its audit row is recorded, the same provider event is seen', async () => {
    const rows: Row[] = []
    const db = strictAuditEvents(rows)
    await expect(seenWebhookEvent(db, KEY)).resolves.toBe(false)
    rows.push(stored) // what emitAudit writes after the side effect
    await expect(seenWebhookEvent(db, KEY)).resolves.toBe(true)
  })

  it('returns false for an event it has not seen', async () => {
    await expect(seenWebhookEvent(strictAuditEvents([stored]), { ...KEY, key: 'bk_other' })).resolves.toBe(false)
    await expect(seenWebhookEvent(strictAuditEvents([stored]), { ...KEY, organizationId: '22222222-2222-4222-8222-222222222222' })).resolves.toBe(false)
  })
})

describe('seenWebhookEvent on a lookup error', () => {
  // Pins CURRENT behaviour, intentional for now. It is not a decision that
  // fail-open is the right long-term policy: fail-open vs retry/quarantine/
  // fail-closed per webhook class (payments vs bookings) is open (C-20,
  // docs/REMEDIATION_PLAN.md).
  it('treats the error as "not seen" (fails open) and logs a warning', async () => {
    const db = makeFakeSupabase((call) =>
      call.table === 'audit_events' ? { error: { code: '42703', message: 'column audit_events.created_at does not exist' } } : undefined)
    await expect(seenWebhookEvent(db, KEY)).resolves.toBe(false)
    expect(console.warn).toHaveBeenCalledWith('[webhook-replay] lookup failed, processing anyway', {
      action: 'cal.booking_created', message: 'column audit_events.created_at does not exist',
    })
  })
})
