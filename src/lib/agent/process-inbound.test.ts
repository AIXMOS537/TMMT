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

// ── newest-message data minimisation (C-21 containment C) ───────────────────
// Synthetic values only: 123-45-6789 is a placeholder SSN, 4111 1111 1111 1111
// is the standard test card number.
const SSN = '123-45-6789'
const CARD = '4111 1111 1111 1111'

function llmOk() {
  h.callAgent.mockResolvedValue({
    parsed: {
      message: 'Thanks, what budget are you working with?',
      assessment: { B: 0.2, A: 0.2, T: 0.2, confidence: 0.5 },
      next_action: 'ask_budget',
    },
    raw: '{}', costUsd: 0.01, model: 'sonnet', inputTokens: 10, outputTokens: 10,
  })
}

const modelInput = () => {
  const call = h.callAgent.mock.calls[0]?.[0] as { systemPrompt: string; userMessage: string }
  return call
}

describe('processInbound — the newest message is redacted before the model call', () => {
  it('SMS: SSN and card number in the newest message never reach callAgent', async () => {
    llmOk()
    await processInbound(args(`my ssn is ${SSN} and card ${CARD}`))
    const { userMessage, systemPrompt } = modelInput()
    expect(userMessage).toBe('my ssn is [redacted-ssn] and card [redacted-card]')
    expect(JSON.stringify(h.callAgent.mock.calls)).not.toContain(SSN)
    expect(JSON.stringify(h.callAgent.mock.calls)).not.toContain(CARD)
    expect(systemPrompt).not.toContain(SSN)
  })

  it('gets the same protection the earlier turns already had', async () => {
    llmOk()
    await processInbound({
      ...args(`newest ${SSN}`),
      recentMessages: [{ direction: 'in', body: `older ${SSN}` }],
    })
    const { userMessage, systemPrompt } = modelInput()
    expect(systemPrompt).toContain('older [redacted-ssn]')
    expect(userMessage).toBe('newest [redacted-ssn]')
  })

  it('voice: transcript_snippet (passed as the inbound body) is redacted the same way', async () => {
    llmOk()
    const snippet = `caller read out card ${CARD}`
    await processInbound({ ...args(snippet), channel: 'voice', recentMessages: [{ direction: 'in', body: snippet }] })
    expect(JSON.stringify(h.callAgent.mock.calls)).not.toContain(CARD)
    expect(modelInput().userMessage).toBe('caller read out card [redacted-card]')
  })

  it('ordinary text is passed through unchanged', async () => {
    llmOk()
    await processInbound(args('Is the 2019 Camry still available for $300 a week?'))
    expect(modelInput().userMessage).toBe('Is the 2019 Camry still available for $300 a week?')
  })

  it('documents the limits: undashed SSNs and non-Luhn numbers are NOT redacted', async () => {
    llmOk()
    await processInbound(args('ssn 123456789 account 12345678901234'))
    expect(modelInput().userMessage).toBe('ssn 123456789 account 12345678901234')
  })
})
