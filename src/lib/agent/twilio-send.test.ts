import { describe, it, expect, vi } from 'vitest'

// Mock the Twilio SDK so ALLOW cases don't hit the network — the gate must run
// BEFORE any client is constructed, so BLOCK cases never reach this mock.
vi.mock('twilio', () => ({
  default: () => ({ messages: { create: async () => ({ sid: 'SM_TEST' }) } }),
}))

import { sendSms } from './twilio-send'
import { SmsBlockedError } from '../../../shared/compliance-gates/sms-gate'

const base = { from: '+15550000000', to: '+15551112222', body: 'hi' }
const creds = { twilioAccountSid: 'AC_test', twilioAuthToken: 'tok_test' }

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
