import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * processInbound's own opt-out short-circuit runs BEFORE the licence,
 * kill-switch and spend-cap guards, and never calls the LLM. The SMS route
 * handles opt-out earlier still; this covers every other caller (the GHL voice
 * summary) and pins the order.
 */
const h = vi.hoisted(() => ({
  guardOrganization: vi.fn(async () => undefined),
  assertLlmCapNotExceeded: vi.fn(async () => ({ spentUsd: 0, capUsd: 50, remainingUsd: 50 })),
  callAgent: vi.fn(),
  emitAudit: vi.fn(async () => undefined),
}))

vi.mock('./guard', () => ({
  guardOrganization: h.guardOrganization,
  assertLlmCapNotExceeded: h.assertLlmCapNotExceeded,
}))
vi.mock('./llm-router', () => ({ callAgent: h.callAgent, pickModel: () => 'sonnet' }))
vi.mock('./audit', () => ({ emitAudit: h.emitAudit }))
vi.mock('@/lib/supabase-service', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/lib/money-meter', () => ({ recordMoneyEventSafe: vi.fn(async () => undefined) }))

import { processInbound } from './process-inbound'
import type { OrgContext } from './tenant'

const org: OrgContext = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Test Org',
  partnerAppSlug: null,
  agentName: 'Riley',
  tenantBrand: 'Test Org',
  agentPersonaOverlay: {},
  handoffSlackWebhook: null,
  handoffImessageTarget: null,
  calComEventLink: null,
  stripeConnectAccountId: null,
  llmDailyCapUsd: 50,
  twilioInboundNumber: null,
}

const args = (inboundBody: string) => ({
  org, prevState: 'NEW' as const, inboundBody, phone: '+15551112222', recentMessages: [],
})

beforeEach(() => {
  vi.resetAllMocks()
  h.guardOrganization.mockResolvedValue(undefined)
  h.assertLlmCapNotExceeded.mockResolvedValue({ spentUsd: 0, capUsd: 50, remainingUsd: 50 })
})

describe('processInbound — explicit opt-out never depends on the guards or the LLM', () => {
  it.each([
    ['spend cap', () => h.assertLlmCapNotExceeded.mockRejectedValue(new Error('LlmCapExceededError'))],
    ['licence', () => h.guardOrganization.mockRejectedValue(new Error('LicenseDisabledError'))],
  ])('STOP is honoured while the %s guard would fail', async (_label, breakGuard) => {
    breakGuard()
    const result = await processInbound(args('STOP'))
    expect(result.newState).toBe('LOST')
    expect(result.complianceFlags).toEqual(['opt_out'])
    expect(h.guardOrganization).not.toHaveBeenCalled()
    expect(h.assertLlmCapNotExceeded).not.toHaveBeenCalled()
    expect(h.callAgent).not.toHaveBeenCalled()
  })

  it('an ordinary message still goes through both guards first, and a guard failure stops the LLM', async () => {
    h.assertLlmCapNotExceeded.mockRejectedValue(new Error('LlmCapExceededError'))
    await expect(processInbound(args('is the Camry available'))).rejects.toThrow('LlmCapExceededError')
    expect(h.guardOrganization).toHaveBeenCalledTimes(1)
    expect(h.callAgent).not.toHaveBeenCalled()
  })
})
