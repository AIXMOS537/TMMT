import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, type ConversationContext } from './tenant-overlay'
import type { OrgContext } from '../tenant'

const org: OrgContext = {
  id: 'org_test',
  name: 'Acme Co',
  partnerAppSlug: 'acme',
  agentName: 'Riley',
  tenantBrand: 'Acme Co',
  agentPersonaOverlay: {},
  handoffSlackWebhook: null,
  handoffImessageTarget: null,
  calComEventLink: null,
  stripeConnectAccountId: null,
  llmDailyCapUsd: 50,
  twilioInboundNumber: null,
}

const baseCtx: ConversationContext = {
  currentState: 'qualifying',
  lastTurns: [],
}

describe('buildSystemPrompt — PII boundary', () => {
  it('redacts an SSN in a lead turn before it reaches the prompt sent to Anthropic', () => {
    const prompt = buildSystemPrompt(org, {
      ...baseCtx,
      lastTurns: [{ direction: 'in', body: 'my ssn is 123-45-6789' }],
    })
    expect(prompt).toContain('[redacted-ssn]')
    expect(prompt).not.toContain('123-45-6789')
  })

  it('redacts a Luhn-valid card number in a lead turn', () => {
    const prompt = buildSystemPrompt(org, {
      ...baseCtx,
      lastTurns: [{ direction: 'in', body: 'charge my card 4111111111111111' }],
    })
    expect(prompt).toContain('[redacted-card]')
    expect(prompt).not.toContain('4111111111111111')
  })

  it('leaves ordinary conversation text (name, address, intent) untouched', () => {
    const prompt = buildSystemPrompt(org, {
      ...baseCtx,
      lastTurns: [{ direction: 'in', body: 'Jane Doe, 123 Main St, need a rental this week' }],
    })
    expect(prompt).toContain('Jane Doe, 123 Main St, need a rental this week')
  })
})
