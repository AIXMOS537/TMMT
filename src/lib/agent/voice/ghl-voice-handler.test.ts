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
vi.mock('@/lib/supabase-service', () => ({
  createServiceRoleClient: () => ({ from: mockFrom }),
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
import { VERTICAL_TAGS, applyVerticalTags, bookTags, qualifyTags } from './ghl-voice-tags'
import { logPostCallSummary, upsertBookHandoffLead } from './ghl-voice-leads'
import { triggerBookedHandoff, triggerVoiceEscalation } from './ghl-voice-handoff'
import { addContactTag, updateContactCustomFields } from '@/lib/ghl/client'
import { handoffToHuman } from '@/lib/agent/handoff'
import { processInbound } from '@/lib/agent/process-inbound'
import type { OrgContext } from '@/lib/agent/tenant'

function supabaseChain(data: unknown = null) {
  const row = { data, error: null }
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.select = vi.fn(self)
  chain.insert = vi.fn(self)
  chain.update = vi.fn(self)
  chain.eq = vi.fn(self)
  chain.is = vi.fn(self)
  // Added with the voice replay guard: its contact-window fallback filters on
  // created_at, and `limit` is used by both the replay lookup and emitAudit.
  chain.gte = vi.fn(self)
  chain.limit = vi.fn(self)
  chain.maybeSingle = vi.fn().mockResolvedValue(row)
  chain.single = vi.fn().mockResolvedValue(row)
  return chain
}

const testOrg: OrgContext = {
  id: '00000000-0000-0000-0000-000000000000',
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
}

describe('handleGhlVoiceAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue(supabaseChain(null))
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

  it('tags booked + vertical on book_handoff', async () => {
    const result = await handleGhlVoiceAction({
      action: 'book_handoff',
      contact_id: 'contact-123',
      vertical: 'moving',
    })
    expect(result.ok).toBe(true)
    expect(result.detail).toBe('booked_handoff_triggered')
    expect(addContactTag).toHaveBeenCalledWith('contact-123', 'bella-booked', 'rentals')
    expect(addContactTag).toHaveBeenCalledWith('contact-123', 'bella-set', 'rentals')
    expect(addContactTag).toHaveBeenCalledWith('contact-123', 'vertical:moving', 'rentals')
  })

  it('returns no_transcript when post_call_summary has no snippet', async () => {
    const result = await handleGhlVoiceAction({
      action: 'post_call_summary',
      phone: '+15551234567',
    })
    expect(result.ok).toBe(true)
    expect(result.detail).toBe('no_transcript')
    // The replay guard now reads audit_events before any action, so a read is
    // expected. What must NOT happen is a WRITE: recording a no-op would sit in
    // the replay window and suppress the retry that carries the transcript.
    const wrote = mockFrom.mock.calls.some(
      (call: unknown[]) => call[0] !== 'audit_events',
    )
    expect(wrote, 'no_transcript must not write anything').toBe(false)
    const chain = mockFrom.mock.results[0]?.value as Record<string, { mock: { calls: unknown[] } }> | undefined
    expect(chain?.insert?.mock.calls ?? [], 'no audit row for a no-op').toHaveLength(0)
  })
})

describe('VERTICAL_TAGS + tag helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps every bella vertical to bella-set', () => {
    expect(VERTICAL_TAGS).toEqual({
      rentals: 'bella-set',
      detailing: 'bella-set',
      credit: 'bella-set',
      funding: 'bella-set',
      moving: 'bella-set',
      cleaning: 'bella-set',
    })
  })

  it('applyVerticalTags writes base + vertical tags and optional last-touch fields', async () => {
    await applyVerticalTags('contact-123', 'bella-set', 'rentals', 'rentals', 'Ada')
    expect(addContactTag).toHaveBeenNthCalledWith(1, 'contact-123', 'bella-set', 'rentals')
    expect(addContactTag).toHaveBeenNthCalledWith(2, 'contact-123', 'vertical:rentals', 'rentals')
    expect(updateContactCustomFields).toHaveBeenCalledWith(
      'contact-123',
      expect.objectContaining({
        bella_vertical: 'rentals',
        bella_last_touch: expect.any(String),
      }),
      'rentals',
    )
  })

  it('applyVerticalTags skips custom fields when caller name is absent', async () => {
    await applyVerticalTags('contact-123', 'bella-set', 'credit', 'rentals')
    expect(updateContactCustomFields).not.toHaveBeenCalled()
  })

  it('qualifyTags tags bella-qualified then baseTag at locationKind', async () => {
    await qualifyTags('contact-123', 'bella-set', 'detailing', 'rentals')
    expect(addContactTag).toHaveBeenNthCalledWith(1, 'contact-123', 'bella-qualified', 'rentals')
    expect(addContactTag).toHaveBeenNthCalledWith(2, 'contact-123', 'bella-set', 'rentals')
    expect(updateContactCustomFields).toHaveBeenCalledWith(
      'contact-123',
      expect.objectContaining({
        bella_vertical: 'detailing',
        bella_qualified_at: expect.any(String),
      }),
      'rentals',
    )
  })

  it('bookTags writes booked + base + vertical tags and appointment field', async () => {
    await bookTags('contact-123', 'bella-set', 'moving', 'rentals', 'Saturday 2:30pm')
    expect(addContactTag).toHaveBeenNthCalledWith(1, 'contact-123', 'bella-booked', 'rentals')
    expect(addContactTag).toHaveBeenNthCalledWith(2, 'contact-123', 'bella-set', 'rentals')
    expect(addContactTag).toHaveBeenNthCalledWith(3, 'contact-123', 'vertical:moving', 'rentals')
    expect(updateContactCustomFields).toHaveBeenCalledWith(
      'contact-123',
      expect.objectContaining({
        bella_vertical: 'moving',
        bella_booked_at: expect.any(String),
        bella_appointment: 'Saturday 2:30pm',
      }),
      'rentals',
    )
  })
})

describe('lead upsert helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('upsertBookHandoffLead inserts QUALIFIED + source ghl_voice', async () => {
    const insertChain = supabaseChain({ id: 'lead-new', agent_status: 'QUALIFIED' })
    mockFrom
      .mockReturnValueOnce(supabaseChain(null))
      .mockReturnValueOnce(insertChain)

    const lead = await upsertBookHandoffLead('00000000-0000-0000-0000-000000000000', '+15551234567')
    expect(lead).toEqual({ id: 'lead-new', agent_status: 'QUALIFIED' })
    expect(insertChain.insert).toHaveBeenCalledWith({
      organization_id: '00000000-0000-0000-0000-000000000000',
      phone_e164: '+15551234567',
      agent_status: 'QUALIFIED',
      source: 'ghl_voice',
    })
  })

  it('logPostCallSummary inserts CONTACTED + channel voice and calls processInbound', async () => {
    const leadInsert = supabaseChain({ id: 'lead-pc', agent_status: 'CONTACTED' })
    const convInsert = supabaseChain({ id: 'conv-1' })
    const msgIn = supabaseChain(null)
    const msgOut = supabaseChain(null)
    const leadUpdate = supabaseChain(null)

    mockFrom
      .mockReturnValueOnce(supabaseChain(null))
      .mockReturnValueOnce(leadInsert)
      .mockReturnValueOnce(supabaseChain(null))
      .mockReturnValueOnce(convInsert)
      .mockReturnValueOnce(msgIn)
      .mockReturnValueOnce(msgOut)
      .mockReturnValueOnce(leadUpdate)

    const logged = await logPostCallSummary({
      org: testOrg,
      phone: '+15551234567',
      snippet: 'Need a van Saturday',
    })

    expect(logged).toEqual({ lead: { id: 'lead-pc', agent_status: 'CONTACTED' } })
    expect(leadInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: testOrg.id,
        phone_e164: '+15551234567',
        agent_status: 'CONTACTED',
        source: 'ghl_voice',
        contacted_at: expect.any(String),
      }),
    )
    expect(convInsert.insert).toHaveBeenCalledWith({
      lead_id: 'lead-pc',
      organization_id: testOrg.id,
      channel: 'voice',
    })
    expect(processInbound).toHaveBeenCalledWith({
      org: testOrg,
      prevState: 'CONTACTED',
      inboundBody: 'Need a van Saturday',
      phone: '+15551234567',
      channel: 'voice',
      recentMessages: [{ direction: 'in', body: 'Need a van Saturday' }],
    })
  })
})

describe('handoff wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('triggerBookedHandoff uses reason bella_voice_booked', async () => {
    await triggerBookedHandoff({
      org: testOrg,
      leadId: 'lead-1',
      phone: '+15551234567',
      transcriptSnippet: 'book me',
    })
    expect(handoffToHuman).toHaveBeenCalledWith({
      org: testOrg,
      leadId: 'lead-1',
      phone: '+15551234567',
      reason: 'bella_voice_booked',
      recentMessages: [{ direction: 'in', body: 'book me' }],
    })
  })

  it('triggerVoiceEscalation uses reason voice_escalation and leadId=contactId', async () => {
    await triggerVoiceEscalation({
      org: testOrg,
      contactId: 'contact-123',
      phone: '+15551234567',
    })
    expect(handoffToHuman).toHaveBeenCalledWith({
      org: testOrg,
      leadId: 'contact-123',
      phone: '+15551234567',
      reason: 'voice_escalation',
      recentMessages: [],
    })
  })

  it('swallows handoffToHuman rejection via .catch(() => undefined)', async () => {
    vi.mocked(handoffToHuman).mockRejectedValueOnce(new Error('slack down'))
    await expect(
      triggerBookedHandoff({
        org: testOrg,
        leadId: 'lead-1',
        phone: '+15551234567',
      }),
    ).resolves.toBeUndefined()
  })
})
