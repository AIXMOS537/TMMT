import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ghl/client', () => ({
  addContactTag: vi.fn().mockResolvedValue(undefined),
  findGhlContactByPhone: vi.fn().mockResolvedValue('contact-123'),
  isGhlConfigured: vi.fn().mockReturnValue(true),
  updateContactCustomFields: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/agent/handoff', () => ({
  handoffToHuman: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/agent/process-inbound', () => ({
  processInbound: vi.fn().mockResolvedValue({
    newState: 'CONTACTED',
    outboundBody: 'Thanks for calling.',
    complianceFlags: [],
    actions: [],
  }),
}))

const mockFrom = vi.fn()
vi.mock('@/lib/agent/supabase-server', () => ({
  createServiceSupabase: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/agent/tenant', () => ({
  resolveOrgBySlug: vi.fn().mockResolvedValue({
    id: 'org-1',
    name: 'TMMT',
    partnerAppSlug: 'tmmt-rentals',
    agentName: 'Bella',
    tenantBrand: 'TMMT',
    agentPersonaOverlay: {},
    handoffSlackWebhook: null,
    handoffImessageTarget: null,
    calComEventLink: null,
    stripeConnectAccountId: null,
    llmDailyCapUsd: 50,
    twilioInboundNumber: null,
  }),
}))

import { handleGhlVoiceAction } from './ghl-voice-handler'
import { addContactTag } from '@/lib/ghl/client'

describe('handleGhlVoiceAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tags vertical on tag_vertical action', async () => {
    const result = await handleGhlVoiceAction({
      action: 'tag_vertical',
      contact_id: 'contact-123',
      vertical: 'rentals',
    })
    expect(result.ok).toBe(true)
    expect(result.detail).toBe('tagged:rentals')
    expect(addContactTag).toHaveBeenCalledWith('contact-123', 'bella-set', 'rentals')
  })

  it('returns contact_not_found when no id or phone match', async () => {
    const { findGhlContactByPhone } = await import('@/lib/ghl/client')
    vi.mocked(findGhlContactByPhone).mockResolvedValueOnce(null)

    const result = await handleGhlVoiceAction({
      action: 'qualify_lead',
      phone: '+15551234567',
    })
    expect(result.ok).toBe(false)
    expect(result.detail).toBe('contact_not_found')
  })

  it('qualifies and tags on qualify_lead', async () => {
    const result = await handleGhlVoiceAction({
      action: 'qualify_lead',
      contact_id: 'contact-123',
      vertical: 'detailing',
    })
    expect(result.ok).toBe(true)
    expect(addContactTag).toHaveBeenCalledWith('contact-123', 'bella-qualified', 'rentals')
  })
})
