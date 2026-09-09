import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Stripe from 'stripe'
import { makeFakeSupabase, writes, type FakeSupabase } from '@/lib/testing/fake-supabase'

/**
 * T-02: per-tenant Stripe webhook. The signature is verified by the real
 * stripe-node constructEvent (so the header is a real v1 signature computed
 * with the SDK's own test helper); org lookup, licence guard, audit and the
 * DB are doubles.
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
const ENV_KEY = 'STRIPE_WEBHOOK_SECRET_ACME_MOTORS'
const SECRET = 'whsec_t02_test_only_not_real'
const ORG = { id: '11111111-1111-4111-8111-111111111111', name: 'Acme Motors', partnerAppSlug: SLUG }
const URL_ = `https://tmmt.example.com/api/agent/stripe/webhook/${SLUG}`

const stripe = new Stripe('sk_test_t02')

const paymentEvent = {
  id: 'evt_t02_1',
  object: 'event',
  type: 'payment_intent.succeeded',
  data: { object: { id: 'pi_t02_1', object: 'payment_intent', amount: 25000, currency: 'usd' } },
}

function signed(payload: unknown, opts: { secret?: string; timestamp?: number } = {}): Request {
  const body = JSON.stringify(payload)
  const header = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: opts.secret ?? SECRET,
    ...(opts.timestamp ? { timestamp: opts.timestamp } : {}),
  })
  return new Request(URL_, { method: 'POST', headers: { 'stripe-signature': header }, body })
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

describe('POST /api/agent/stripe/webhook/[slug] — gate', () => {
  it('400 with no stripe-signature header; nothing looked up, nothing written', async () => {
    const res = await POST(new Request(URL_, { method: 'POST', body: JSON.stringify(paymentEvent) }), params)
    expect(res.status).toBe(400)
    expect(h.resolveOrg).not.toHaveBeenCalled()
    expect(h.createDb).not.toHaveBeenCalled()
  })

  it('401 on a signature made with the wrong secret; no DB write, no audit', async () => {
    const res = await POST(signed(paymentEvent, { secret: 'whsec_t02_wrong' }), params)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'invalid signature' })
    expect(h.createDb).not.toHaveBeenCalled()
    expect(h.audit).not.toHaveBeenCalled()
    expect(h.guard).not.toHaveBeenCalled()
  })

  it('401 when the signed body is tampered', async () => {
    const good = signed(paymentEvent)
    const tampered = new Request(URL_, {
      method: 'POST',
      headers: good.headers,
      body: JSON.stringify({ ...paymentEvent, data: { object: { ...paymentEvent.data.object, id: 'pi_other' } } }),
    })
    expect((await POST(tampered, params)).status).toBe(401)
    expect(h.createDb).not.toHaveBeenCalled()
  })

  it('401 on a garbage signature header', async () => {
    const res = await POST(
      new Request(URL_, { method: 'POST', headers: { 'stripe-signature': 't=1,v1=00' }, body: JSON.stringify(paymentEvent) }),
      params,
    )
    expect(res.status).toBe(401)
  })

  it('500 (fail closed) when the per-tenant secret env is not configured', async () => {
    vi.stubEnv(ENV_KEY, undefined)
    const res = await POST(signed(paymentEvent), params)
    expect(res.status).toBe(500)
    expect(h.createDb).not.toHaveBeenCalled()
  })

  it('404 for an unknown tenant slug', async () => {
    // Note (T-02): the org lookup runs BEFORE signature verification, so an
    // unsigned/badly-signed caller can distinguish 404 (no such slug) from 401.
    // Cal.com's sibling route verifies first. Reported, not changed here.
    h.resolveOrg.mockRejectedValue(new Error('no org'))
    expect((await POST(signed(paymentEvent), params)).status).toBe(404)
    expect(h.createDb).not.toHaveBeenCalled()
  })

  it('503 and no lead write when the licence is disabled', async () => {
    const { LicenseDisabledError } = await import('@/lib/agent/guard')
    h.guard.mockRejectedValue(new LicenseDisabledError('x', null))
    const res = await POST(signed(paymentEvent), params)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ skipped: 'license_disabled' })
    expect(h.createDb).not.toHaveBeenCalled()
  })
})

describe('POST /api/agent/stripe/webhook/[slug] — happy path', () => {
  it('payment_intent.succeeded closes the matching lead scoped to the org and audits it', async () => {
    const res = await POST(signed(paymentEvent), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    expect(h.guard).toHaveBeenCalledWith(ORG.id)
    expect(writes(db)).toEqual([
      expect.objectContaining({
        table: 'incoming_leads',
        op: 'update',
        payload: expect.objectContaining({ agent_status: 'CLOSED', closed_at: expect.any(String) }),
        filters: [
          ['eq', 'stripe_payment_intent_id', 'pi_t02_1'],
          ['eq', 'organization_id', ORG.id],
        ],
      }),
    ])
    expect(h.audit).toHaveBeenCalledWith({
      organizationId: ORG.id,
      action: 'stripe.payment_collected',
      payload: { payment_intent_id: 'pi_t02_1', amount: 25000, currency: 'usd' },
    })
  })

  it('other event types are acknowledged without a write', async () => {
    const res = await POST(signed({ ...paymentEvent, id: 'evt_t02_2', type: 'charge.refunded' }), params)
    expect(res.status).toBe(200)
    expect(h.createDb).not.toHaveBeenCalled()
    expect(h.audit).not.toHaveBeenCalled()
  })
})

describe('POST /api/agent/stripe/webhook/[slug] — replay', () => {
  it('rejects a signature older than the 5-minute Stripe tolerance (timestamp replay)', async () => {
    const stale = Math.floor(Date.now() / 1000) - 600
    const res = await POST(signed(paymentEvent, { timestamp: stale }), params)
    expect(res.status).toBe(401)
    expect(h.createDb).not.toHaveBeenCalled()
  })

  // TODO(T-02): no event-id replay guard. Within the tolerance window the same
  // event.id delivered twice updates the lead twice (idempotent by effect: same
  // status) and emits two audit rows. Stripe does retry on non-2xx.
  it('documents current behaviour: a second delivery inside the window re-runs the update and audit', async () => {
    await POST(signed(paymentEvent), params)
    await POST(signed(paymentEvent), params)
    expect(writes(db)).toHaveLength(2)
    expect(h.audit).toHaveBeenCalledTimes(2)
  })
})
