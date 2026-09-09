import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Twilio SDK so ALLOW cases don't hit the network — the gate must run
// BEFORE any client is constructed, so BLOCK cases never reach this mock.
vi.mock('twilio', () => ({
  default: () => ({ messages: { create: async () => ({ sid: 'SM_TEST' }) } }),
}))

// The outbound gate reads do_not_contact_numbers and incoming_leads. Stand in a
// database double so the DNC / opt-out branches can be driven from here.
const h = vi.hoisted(() => {
  const state = { dnc: false, optedOut: false }
  const makeDb = () => ({
    from: (table: string) => {
      const api: Record<string, unknown> = {}
      Object.assign(api, {
        select: () => api, eq: () => api, limit: () => api,
        maybeSingle: async () =>
          table === 'do_not_contact_numbers'
            ? { data: state.dnc ? { phone10: '5551112222' } : null, error: null }
            : { data: { opted_out: state.optedOut }, error: null },
      })
      return api
    },
  })
  return { state, makeDb }
})
vi.mock('@/lib/supabase-service', () => ({ createServiceRoleClient: () => h.makeDb() }))

import { sendSms } from './twilio-send'
import { SmsBlockedError } from '../../../shared/compliance-gates/sms-gate'

const base = { from: '+15550000000', to: '+15551112222', body: 'hi' }
const creds = { twilioAccountSid: 'AC_test', twilioAuthToken: 'tok_test' }

beforeEach(() => {
  h.state.dnc = false
  h.state.optedOut = false
})

describe('sendSms — do-not-contact and opt-out are checked on every send', () => {
  it('refuses a number on the do-not-contact list even for a transactional send', async () => {
    h.state.dnc = true
    await expect(sendSms({ ...base, ...creds })).rejects.toThrow(/dnc/)
  })

  it('refuses a lead that opted out of this org', async () => {
    h.state.optedOut = true
    await expect(sendSms({ ...base, ...creds, organizationId: 'org-1' })).rejects.toThrow(/opted_out/)
  })

  it('does not consult the opt-out flag without an organization (no lead to look up)', async () => {
    h.state.optedOut = true
    await expect(sendSms({ ...base, ...creds })).resolves.toEqual({ sid: 'SM_TEST' })
  })
})

describe('sendSms — SMS compliance gate wiring', () => {
  it('BLOCKs promotional SMS to a restricted vertical (credit_repair)', async () => {
    await expect(
      sendSms({ ...base, ...creds, vertical: 'credit_repair', type: 'marketing' })
    ).rejects.toBeInstanceOf(SmsBlockedError)
  })

  it('BLOCKs promotional SMS to another restricted vertical (funding)', async () => {
    await expect(
      sendSms({ ...base, ...creds, vertical: 'funding', type: 'marketing' })
    ).rejects.toBeInstanceOf(SmsBlockedError)
  })

  it('HOLDs (blocks) un-approved marketing even for an unrestricted vertical', async () => {
    await expect(
      sendSms({ ...base, ...creds, vertical: 'rentals', type: 'marketing' })
    ).rejects.toBeInstanceOf(SmsBlockedError)
  })

  it('ALLOWs transactional SMS to a restricted vertical', async () => {
    await expect(
      sendSms({ ...base, ...creds, vertical: 'funding', type: 'transactional' })
    ).resolves.toEqual({ sid: 'SM_TEST' })
  })

  it('defaults to transactional when type is unspecified (behavior unchanged)', async () => {
    await expect(sendSms({ ...base, ...creds })).resolves.toEqual({ sid: 'SM_TEST' })
  })

  it('ALLOWs approved marketing to an unrestricted vertical', async () => {
    await expect(
      sendSms({ ...base, ...creds, vertical: 'rentals', type: 'marketing', ownerApproved: true })
    ).resolves.toEqual({ sid: 'SM_TEST' })
  })
})
