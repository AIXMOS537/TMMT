import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFakeSupabase, writes, type FakeSupabase } from '@/lib/testing/fake-supabase'

/**
 * T-02: per-tenant Cal.com webhook. HMAC-SHA256(hex) over the raw body in
 * x-cal-signature-256 is verified by the route's own timing-safe check; org
 * lookup, licence guard, audit and the DB are doubles.
 */
const h = vi.hoisted(() => ({
  resolveOrg: vi.fn(),
  guard: vi.fn(async () => undefined),
  audit: vi.fn(async () => undefined),
  createDb: vi.fn(),
}))
vi.mock('@/lib/agent/tenant', () => ({ resolveOrgBySlug: h.resolveOrg }))
vi.mock('@/lib/agent/supabase-server', () => ({ createServiceSupabase: h.createDb }))
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
const signed = (payload: unknown) => {
  const body = JSON.stringify(payload)
  return request(body, sign(body))
}

const params = { params: Promise.resolve({ slug: SLUG }) }
let db: FakeSupabase

beforeEach(() => {
  vi.stubEnv(ENV_KEY, SECRET)
  db = makeFakeSupabase()
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
    const tampered = JSON.stringify({ ...booking, payload: { ...booking.payload, attendees: [{ phone: '[phone removed]' }] } })
    expect((await POST(request(tampered, sign(good)), params)).status).toBe(401)
    expect(h.createDb).not.toHaveBeenCalled()
  })

  it('401 on a short / different-length signature without throwing', async () => {
    expect((await POST(request(JSON.stringify(booking), 'abc'), params)).status).toBe(401)
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

describe('POST /api/agent/cal/webhook/[slug] — replay', () => {
  // TODO(T-02): no replay guard. The Cal.com signature carries no timestamp and
  // the route does not dedupe on payload.uid, so a captured request can be
  // replayed indefinitely: the update is idempotent by effect (same status) but
  // every replay emits another cal.booking_created audit row.
  it('documents current behaviour: an identical second delivery re-runs the update and audit', async () => {
    await POST(signed(booking), params)
    await POST(signed(booking), params)
    expect(writes(db)).toHaveLength(2)
    expect(h.audit).toHaveBeenCalledTimes(2)
  })
})
