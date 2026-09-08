import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    dnc: null as null | { phone10: string },
    dncError: null as null | { message: string },
    lead: null as null | { opted_out: boolean },
    leadError: null as null | { message: string },
    queries: [] as Array<{ table: string; eq: Record<string, unknown> }>,
  }
  const makeDb = () => ({
    from: (table: string) => {
      const q = { table, eq: {} as Record<string, unknown> }
      state.queries.push(q)
      const api: Record<string, unknown> = {}
      Object.assign(api, {
        select: () => api,
        limit: () => api,
        eq: (k: string, v: unknown) => { q.eq[k] = v; return api },
        maybeSingle: async () =>
          table === 'do_not_contact_numbers'
            ? { data: state.dnc, error: state.dncError }
            : { data: state.lead, error: state.leadError },
      })
      return api
    },
  })
  return { state, makeDb }
})

vi.mock('@/lib/agent/supabase-server', () => ({ createServiceSupabase: () => h.makeDb() }))

import { assertOutboundAllowed, phone10, orgSmsVertical } from './outbound-gate'
import { SmsBlockedError } from '../../shared/compliance-gates/sms-gate'

beforeEach(() => {
  h.state.dnc = null
  h.state.dncError = null
  h.state.lead = null
  h.state.leadError = null
  h.state.queries = []
})

describe('phone10', () => {
  it('keeps the last ten digits regardless of formatting', () => {
    expect(phone10('+1 (555) 111-2222')).toBe('5551112222')
    expect(phone10('15551112222')).toBe('5551112222')
  })
  it('returns null when there are fewer than ten digits', () => {
    expect(phone10('555-1212')).toBeNull()
    expect(phone10(null)).toBeNull()
  })
})

describe('orgSmsVertical', () => {
  it('uses the partner slug as the vertical and falls back to unrestricted', () => {
    expect(orgSmsVertical({ partnerAppSlug: 'credit_repair' })).toBe('credit_repair')
    expect(orgSmsVertical({ partnerAppSlug: null })).toBe('')
    expect(orgSmsVertical(null)).toBe('')
  })
})

describe('assertOutboundAllowed — order of checks', () => {
  it('BLOCK from the A2P gate throws before any database read', async () => {
    await expect(
      assertOutboundAllowed({ phone: '+15551112222', vertical: 'credit_repair', type: 'marketing' })
    ).rejects.toBeInstanceOf(SmsBlockedError)
    expect(h.state.queries).toEqual([])
  })

  it('HOLD (un-approved marketing) is not allowed and reads nothing', async () => {
    const d = await assertOutboundAllowed({ phone: '+15551112222', vertical: 'rentals', type: 'marketing' })
    expect(d).toEqual({ allowed: false, reason: 'gate_hold', flags: ['gate_hold'] })
    expect(h.state.queries).toEqual([])
  })

  it('a number on the do-not-contact list is refused, matched on the last ten digits', async () => {
    h.state.dnc = { phone10: '5551112222' }
    const d = await assertOutboundAllowed({ phone: '+1 (555) 111-2222', organizationId: 'org-1' })
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe('dnc')
    expect(h.state.queries[0]).toEqual({ table: 'do_not_contact_numbers', eq: { phone10: '5551112222' } })
    expect(h.state.queries).toHaveLength(1) // opt-out never consulted
  })

  it('fails closed when the do-not-contact read errors', async () => {
    h.state.dncError = { message: 'permission denied' }
    const d = await assertOutboundAllowed({ phone: '+15551112222' })
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe('dnc_unverified')
  })

  it('an opted-out lead for this org is refused', async () => {
    h.state.lead = { opted_out: true }
    const d = await assertOutboundAllowed({ phone: '+15551112222', organizationId: 'org-1' })
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe('opted_out')
    expect(h.state.queries[1]).toEqual({
      table: 'incoming_leads',
      eq: { organization_id: 'org-1', phone_e164: '+15551112222' },
    })
  })

  it('a clean transactional send is allowed with an audit trail of what was checked', async () => {
    h.state.lead = { opted_out: false }
    const d = await assertOutboundAllowed({ phone: '+15551112222', organizationId: 'org-1', vertical: 'funding' })
    expect(d).toEqual({ allowed: true, reason: 'ok', flags: ['gate_allow', 'dnc_clear'] })
  })

  it('without a phone only the A2P gate runs (email or unknown destination)', async () => {
    const d = await assertOutboundAllowed({ vertical: 'rentals', type: 'transactional' })
    expect(d.allowed).toBe(true)
    expect(h.state.queries).toEqual([])
  })

  it('skips the opt-out lookup when no organization is given', async () => {
    h.state.lead = { opted_out: true } // would refuse if consulted
    const d = await assertOutboundAllowed({ phone: '+15551112222' })
    expect(d.allowed).toBe(true)
    expect(h.state.queries.map((q) => q.table)).toEqual(['do_not_contact_numbers'])
  })
})
