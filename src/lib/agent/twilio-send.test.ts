import { describe, it, expect, beforeEach } from 'vitest'
import { sendSms } from './twilio-send'
import { SmsBlockedError } from '@shared/compliance-gates/sms-gate'

// These tests assert the COMPLIANCE GATE in sendSms, not the Twilio network
// call. "Past the gate" is proven by the send then failing on missing creds.
describe('sendSms compliance gate', () => {
  const base = { from: '+15555550100', to: '+15551001001', body: 'hi' }

  beforeEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
  })

  it('blocks promotional SMS to a restricted credit/funding vertical', async () => {
    await expect(
      sendSms({ ...base, vertical: 'credit_repair', smsType: 'marketing' })
    ).rejects.toBeInstanceOf(SmsBlockedError)
  })

  it('blocks promotional SMS to a funding vertical', async () => {
    await expect(
      sendSms({ ...base, vertical: 'funding', smsType: 'marketing' })
    ).rejects.toBeInstanceOf(SmsBlockedError)
  })

  it('holds unapproved marketing before it can reach Twilio', async () => {
    await expect(
      sendSms({ ...base, vertical: 'rentals', smsType: 'marketing' })
    ).rejects.toThrow(/SMS HELD/)
  })

  it('lets owner-approved marketing past the gate', async () => {
    await expect(
      sendSms({ ...base, vertical: 'rentals', smsType: 'marketing', ownerApproved: true })
    ).rejects.toThrow(/Twilio credentials missing/)
  })

  it('lets transactional SMS past the gate even for a restricted vertical', async () => {
    await expect(
      sendSms({ ...base, vertical: 'credit_repair', smsType: 'transactional' })
    ).rejects.toThrow(/Twilio credentials missing/)
  })
})
