import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFakeSupabase, writes, type FakeDbCall, type FakeSupabase } from '@/lib/testing/fake-supabase'
import type { AuditEvent } from '@/lib/agent/audit'

/**
 * T-02 / T-02b: per-tenant Cal.com webhook. HMAC-SHA256(hex) over the raw body
 * in x-cal-signature-256 is verified by the route's own timing-safe check; org
 * lookup, licence guard, audit and the DB are doubles.
 *
 * The fake DB answers the replay lookup on `audit_events` from what the
 * (mocked) audit emitter has already been asked to write, so a second
 * delivery in the same test sees the first one's row.
 */
const h = vi.hoisted(() => ({
  resolveOrg: vi.fn(),
  guard: vi.fn(async () => undefined),
  audit: vi.fn(async () => undefined),
  createDb: vi.fn(),
}))
vi.mock('@/lib/agent/tenant', () => ({ resolveOrgBySlug: h.resolveOrg }))
vi.mock('@/lib/supabase-service', () => ({ createServiceRoleClient: h.createDb }))
vi.mock('@/lib/agent/audit', () => ({ emitAudit: h.audit }))
vi.mock('@/lib/agent/guard', () => ({
  guardOrganization: h.guard,
  LicenseDisabledError: class LicenseDisabledError extends Error {},
}))

import { POST } from './route'

const SLUG = 'acme-motors'
const ENV_KEY = 'CAL_WEBHOOK_SECRET_ACME_MOTORS'
const SECRET = 't02-cal-webhook-secret'
const ORG = { id: '11111111-1111-4111-8111-111111111111', name: 'Acme Motors', partnerAppSlug: SLUG }
const URL_ = `https://tmmt.example.com/api/agent/cal/webhook/${SLUG}`

const booking = {
  triggerEvent: 'BOOKING_CREATED',
  payload: { uid: 'bk_t02_1', attendees: [{ phone: '+15550004444', email: 'booked@example.com' }] },
}

const sign = (body: string, secret = SECRET) => createHmac('sha256', secret).update(body).digest('hex')

function request(body: string, sig?: string): Request {
  return new Request(URL_, {
    method: 'POST',
    headers: sig === undefined ? {} : { 'x-cal-signature-256': sig },
    body,
  })
}
const signedBody = (body: string) => request(body, sign(body))
const signed = (payload: unknown) => signedBody(JSON.stringify(payload))

const params = { params: Promise.resolve({ slug: SLUG }) }
let db: FakeSupabase

const auditCalls = () => (h.audit.mock.calls as unknown as Array<[AuditEvent]>).map(([e]) => e)
const replayLookups = () => db.calls.filter((c) => c.table === 'audit_events' && c.op === 'select')

/** The replay lookup is answered from the rows the audit emitter was asked to write. */
function auditBackedDb(fail = false): FakeSupabase {
  return makeFakeSupabase((call: FakeDbCall) => {
    if (call.table !== 'audit_events' || call.op !== 'select') return undefined
    if (fail) return { error: { message: 'boom' } }
    const org = call.filters.find(([m, col]) => m === 'eq' && col === 'organization_id')?.[2]
    const action = call.filters.find(([m, col]) => m === 'eq' && col === 'action')?.[2]
    const keyFilter = call.filters.find(([m, col]) => m === 'eq' && String(col).startsWith('payload->>'))
    const field = String(keyFilter?.[1]).slice('payload->>'.length)
    const hit = auditCalls().some(
      (e) => e.organizationId === org && e.action === action && e.payload?.[field] === keyFilter?.[2],
    )
    return { data: hit ? { created_at: '2026-09-08T00:00:00.000Z' } : null }
  })
}

beforeEach(() => {
  vi.stubEnv(ENV_KEY, SECRET)
  db = auditBackedDb()
  h.createDb.mockReset()
  h.createDb.mockReturnValue(db)
  h.resolveOrg.mockReset()
  h.resolveOrg.mockResolvedValue(ORG)
  h.guard.mockReset()
  h.guard.mockResolvedValue(undefined)
  h.audit.mockClear()
})

afterEach(() => vi.unstubAllEnvs())

describe('POST /api/agent/cal/webhook/[slug] — gate', () => {
  it('401 with no signature header; org never looked up, nothing written', async () => {
    const res = await POST(request(JSON.stringify(booking)), params)
    expect(res.status).toBe(401)
    expect(h.resolveOrg).not.toHaveBeenCalled()
    expect(h.createDb).not.toHaveBeenCalled()
  })

  it('401 on a signature made with the wrong secret', async () => {
    const body = JSON.stringify(booking)
    const res = await POST(request(body, sign(body, 'wrong-secret')), params)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'invalid signature' })
    expect(h.resolveOrg).not.toHaveBeenCalled()
    expect(h.createDb).not.toHaveBeenCalled()
    expect(h.audit).not.toHaveBeenCalled()
  })

  it('401 when the signed body is tampered', async () => {
    const good = JSON.stringify(booking)
    const tampered = JSON.stringify({ ...booking, payload: { ...booking.payload, attendees: [{ phone: '+15550009999' }] } })
    expect((await POST(request(tampered, sign(good)), params)).status).toBe(401)
    expect(h.createDb).not.toHaveBeenCalled()
  })

  it('401 on a short / different-length signature without throwing', async () => {
    expect((await POST(request(JSON.stringify(booking), 'abc'), params)).status).toBe(401)
  })

  it('401, not 400, for an UNSIGNED non-JSON body: the signature is checked first', async () => {
    const res = await POST(request('not json {'), params)
    expect(res.status).toBe(401)
    expect(h.resolveOrg).not.toHaveBeenCalled()
  })

  it('500 (fail closed) when the per-tenant secret env is not configured', async () => {
    vi.stubEnv(ENV_KEY, undefined)
    const res = await POST(signed(booking), params)
    expect(res.status).toBe(500)
    expect(h.resolveOrg).not.toHaveBeenCalled()
    expect(h.createDb).not.toHaveBeenCalled()
  })

  it('404 for an unknown tenant slug, only after the signature passed', async () => {
    h.resolveOrg.mockRejectedValue(new Error('no org'))
    expect((await POST(signed(booking), params)).status).toBe(404)
    expect(h.createDb).not.toHaveBeenCalled()
  })

  it('503 and no lead write when the licence is disabled', async () => {
    const { LicenseDisabledError } = await import('@/lib/agent/guard')
    h.guard.mockRejectedValue(new LicenseDisabledError('x', null))
    const res = await POST(signed(booking), params)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ skipped: 'license_disabled' })
    expect(h.createDb).not.toHaveBeenCalled()
  })
})

describe('POST /api/agent/cal/webhook/[slug] — body shape (T-02b)', () => {
  it('400 on a correctly signed body that is not JSON; nothing looked up, nothing written', async () => {
    // Was an uncaught SyntaxError from JSON.parse → 500.
    const res = await POST(signedBody('not json {'), params)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid json' })
    expect(h.resolveOrg).not.toHaveBeenCalled()
    expect(h.createDb).not.toHaveBeenCalled()
    expect(h.audit).not.toHaveBeenCalled()
  })

  it.each([
    ['null', 'null'],
    ['a number', '42'],
    ['a string', '"BOOKING_CREATED"'],
    ['an array', '[{"triggerEvent":"BOOKING_CREATED"}]'],
  ])('400 when the signed JSON is %s rather than an object', async (_label, body) => {
    const res = await POST(signedBody(body), params)
    expect(res.status).toBe(400)
    expect(h.resolveOrg).not.toHaveBeenCalled()
  })

  it('a non-string attendee phone is treated as no phone: acknowledged, no write', async () => {
    const res = await POST(signed({ ...booking, payload: { uid: 'bk_t02_x', attendees: [{ phone: { e164: '+15550004444' } }] } }), params)
    expect(res.status).toBe(200)
    expect(h.createDb).not.toHaveBeenCalled()
  })
})

describe('POST /api/agent/cal/webhook/[slug] — happy path', () => {
  it('BOOKING_CREATED marks the lead BOOKED by phone, scoped to the org, and audits it', async () => {
    const res = await POST(signed(booking), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    expect(h.guard).toHaveBeenCalledWith(ORG.id)
    expect(writes(db)).toEqual([
      expect.objectContaining({
        table: 'incoming_leads',
        op: 'update',
        payload: { agent_status: 'BOOKED' },
        filters: [
          ['eq', 'phone_e164', '+15550004444'],
          ['eq', 'organization_id', ORG.id],
        ],
      }),
    ])
    expect(h.audit).toHaveBeenCalledWith({
      organizationId: ORG.id,
      action: 'cal.booking_created',
      payload: { phone: '+15550004444', booking_uid: 'bk_t02_1' },
    })
  })

  it('a booking with no attendee phone is acknowledged without a write', async () => {
    const res = await POST(signed({ ...booking, payload: { uid: 'bk_t02_2', attendees: [{ email: 'x@example.com' }] } }), params)
    expect(res.status).toBe(200)
    expect(h.createDb).not.toHaveBeenCalled()
    expect(h.audit).not.toHaveBeenCalled()
  })

  it('other trigger events are acknowledged without a write', async () => {
    const res = await POST(signed({ ...booking, triggerEvent: 'BOOKING_CANCELLED' }), params)
    expect(res.status).toBe(200)
    expect(h.createDb).not.toHaveBeenCalled()
  })
})

describe('POST /api/agent/cal/webhook/[slug] — replay (T-02b)', () => {
  it('looks the booking uid up in audit_events, scoped to org and action, BEFORE the lead update', async () => {
    await POST(signed(booking), params)
    const [lookup] = replayLookups()
    expect(lookup).toEqual(
      expect.objectContaining({
        table: 'audit_events',
        op: 'select',
        filters: [
          ['eq', 'organization_id', ORG.id],
          ['eq', 'action', 'cal.booking_created'],
          ['eq', 'payload->>booking_uid', 'bk_t02_1'],
          ['limit', 1, undefined],
        ],
      }),
    )
    expect(db.calls.indexOf(lookup)).toBeLessThan(db.calls.findIndex((c) => c.op === 'update'))
  })

  it('an identical second delivery is a 200 no-op: no write, no audit row', async () => {
    // Was: the update re-ran and a second cal.booking_created audit row was
    // emitted on every replay, forever (no timestamp in the Cal signature).
    const first = await POST(signed(booking), params)
    expect(first.status).toBe(200)
    expect(writes(db)).toHaveLength(1)

    const second = await POST(signed(booking), params)
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ ok: true, duplicate: true })
    expect(writes(db)).toHaveLength(1)
    expect(h.audit).toHaveBeenCalledTimes(1)
  })

  it('the same uid for a different org is not a replay (lookup is org-scoped)', async () => {
    await POST(signed(booking), params)
    h.resolveOrg.mockResolvedValue({ ...ORG, id: '22222222-2222-4222-8222-222222222222' })
    await POST(signed(booking), params)
    expect(writes(db)).toHaveLength(2)
    expect(h.audit).toHaveBeenCalledTimes(2)
  })

  it('a different booking uid is processed', async () => {
    await POST(signed(booking), params)
    await POST(signed({ ...booking, payload: { ...booking.payload, uid: 'bk_t02_other' } }), params)
    expect(writes(db)).toHaveLength(2)
  })

  it('a booking without a uid has nothing to dedupe on: no lookup, processed as before', async () => {
    const { uid: _omit, ...noUid } = booking.payload
    void _omit
    const res = await POST(signed({ ...booking, payload: noUid }), params)
    expect(res.status).toBe(200)
    expect(replayLookups()).toEqual([])
    expect(writes(db)).toHaveLength(1)
    expect(h.audit).toHaveBeenCalledWith({
      organizationId: ORG.id,
      action: 'cal.booking_created',
      payload: { phone: '+15550004444' },
    })
  })

  it('fails open when the replay lookup errors: the booking is processed once, not dropped', async () => {
    db = auditBackedDb(true)
    h.createDb.mockReturnValue(db)
    const res = await POST(signed(booking), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(writes(db)).toHaveLength(1)
    expect(h.audit).toHaveBeenCalledTimes(1)
  })
})
