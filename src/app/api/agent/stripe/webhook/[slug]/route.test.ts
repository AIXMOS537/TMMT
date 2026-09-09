import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Stripe from 'stripe'
import { makeFakeSupabase, writes, type FakeDbCall, type FakeSupabase } from '@/lib/testing/fake-supabase'
import type { AuditEvent } from '@/lib/agent/audit'

/**
 * T-02 / T-02b: per-tenant Stripe webhook. The signature is verified by the
 * real stripe-node constructEvent (so the header is a real v1 signature
 * computed with the SDK's own test helper); org lookup, licence guard, audit
 * and the DB are doubles.
 *
 * The fake DB answers the replay lookup on `audit_events` from what the
 * (mocked) audit emitter has already been asked to write, so a second
 * delivery in the same test sees the first one's row — the persistence the
 * real table provides, without a network.
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

function signedBody(body: string, opts: { secret?: string; timestamp?: number } = {}): Request {
  const header = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: opts.secret ?? SECRET,
    ...(opts.timestamp ? { timestamp: opts.timestamp } : {}),
  })
  return new Request(URL_, { method: 'POST', headers: { 'stripe-signature': header }, body })
}
const signed = (payload: unknown, opts: { secret?: string; timestamp?: number } = {}) =>
  signedBody(JSON.stringify(payload), opts)

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

describe('POST /api/agent/stripe/webhook/[slug] — gate', () => {
  it('400 with no stripe-signature header; nothing looked up, nothing written', async () => {
    const res = await POST(new Request(URL_, { method: 'POST', body: JSON.stringify(paymentEvent) }), params)
    expect(res.status).toBe(400)
    expect(h.resolveOrg).not.toHaveBeenCalled()
    expect(h.createDb).not.toHaveBeenCalled()
  })

  it('401 on a signature made with the wrong secret; org never looked up, no DB write, no audit', async () => {
    const res = await POST(signed(paymentEvent, { secret: 'whsec_t02_wrong' }), params)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'invalid signature' })
    expect(h.resolveOrg).not.toHaveBeenCalled()
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
    expect(h.resolveOrg).not.toHaveBeenCalled()
    expect(h.createDb).not.toHaveBeenCalled()
  })

  it('401 on a garbage signature header', async () => {
    const res = await POST(
      new Request(URL_, { method: 'POST', headers: { 'stripe-signature': 't=1,v1=00' }, body: JSON.stringify(paymentEvent) }),
      params,
    )
    expect(res.status).toBe(401)
    expect(h.resolveOrg).not.toHaveBeenCalled()
  })

  it('500 (fail closed) when the per-tenant secret env is not configured', async () => {
    vi.stubEnv(ENV_KEY, undefined)
    const res = await POST(signed(paymentEvent), params)
    expect(res.status).toBe(500)
    expect(h.resolveOrg).not.toHaveBeenCalled()
    expect(h.createDb).not.toHaveBeenCalled()
  })

  it('404 for an unknown tenant slug, only after the signature passed', async () => {
    h.resolveOrg.mockRejectedValue(new Error('no org'))
    expect((await POST(signed(paymentEvent), params)).status).toBe(404)
    expect(h.resolveOrg).toHaveBeenCalledTimes(1)
    expect(h.createDb).not.toHaveBeenCalled()
  })

  it('an unsigned caller cannot tell an unknown slug from a bad signature (no slug probe, no DB read)', async () => {
    // T-02b: the org lookup used to run before verification, so a bad
    // signature got 404 for an unknown slug and 401 for a known one, and each
    // probe cost a DB read. Now both are the same 401 and the DB is untouched.
    h.resolveOrg.mockRejectedValue(new Error('no org'))
    const unknown = await POST(signed(paymentEvent, { secret: 'whsec_t02_wrong' }), params)
    h.resolveOrg.mockResolvedValue(ORG)
    const known = await POST(signed(paymentEvent, { secret: 'whsec_t02_wrong' }), params)

    expect(unknown.status).toBe(401)
    expect(known.status).toBe(401)
    expect(await unknown.json()).toEqual(await known.json())
    expect(h.resolveOrg).not.toHaveBeenCalled()
    expect(h.createDb).not.toHaveBeenCalled()
  })

  it('400 on a correctly signed body that is not JSON (constructEvent verifies before it parses)', async () => {
    const res = await POST(signedBody('not json {'), params)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid json' })
    expect(h.resolveOrg).not.toHaveBeenCalled()
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
  it('payment_intent.succeeded closes the matching lead scoped to the org and audits it with the event id', async () => {
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
      payload: { event_id: 'evt_t02_1', payment_intent_id: 'pi_t02_1', amount: 25000, currency: 'usd' },
    })
  })

  it('other event types are acknowledged without a write or a replay lookup', async () => {
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
    expect(h.resolveOrg).not.toHaveBeenCalled()
    expect(h.createDb).not.toHaveBeenCalled()
  })

  it('looks the event id up in audit_events, scoped to org and action, BEFORE the lead update', async () => {
    await POST(signed(paymentEvent), params)
    const [lookup] = replayLookups()
    expect(lookup).toEqual(
      expect.objectContaining({
        table: 'audit_events',
        op: 'select',
        filters: [
          ['eq', 'organization_id', ORG.id],
          ['eq', 'action', 'stripe.payment_collected'],
          ['eq', 'payload->>event_id', 'evt_t02_1'],
          ['limit', 1, undefined],
        ],
      }),
    )
    expect(db.calls.indexOf(lookup)).toBeLessThan(db.calls.findIndex((c) => c.op === 'update'))
  })

  it('a second delivery of the same event.id inside the window is a 200 no-op: no write, no audit row', async () => {
    const first = await POST(signed(paymentEvent), params)
    expect(first.status).toBe(200)
    expect(writes(db)).toHaveLength(1)

    const second = await POST(signed(paymentEvent), params)
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ ok: true, duplicate: true })
    expect(writes(db)).toHaveLength(1)
    expect(h.audit).toHaveBeenCalledTimes(1)
  })

  it('a different event id for the same payment intent is not a replay', async () => {
    await POST(signed(paymentEvent), params)
    await POST(signed({ ...paymentEvent, id: 'evt_t02_retry_new_id' }), params)
    expect(writes(db)).toHaveLength(2)
    expect(h.audit).toHaveBeenCalledTimes(2)
  })

  it('fails open when the replay lookup errors: the event is processed once, not dropped', async () => {
    db = auditBackedDb(true)
    h.createDb.mockReturnValue(db)
    const res = await POST(signed(paymentEvent), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(writes(db)).toHaveLength(1)
    expect(h.audit).toHaveBeenCalledTimes(1)
  })
})
