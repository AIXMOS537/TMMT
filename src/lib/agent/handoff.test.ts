import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handoffToHuman } from './handoff'
import type { OrgContext } from './tenant'

const baseOrg: OrgContext = {
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

const baseArgs = {
  org: baseOrg,
  leadId: 'lead_123',
  phone: '[phone removed]',
  reason: 'llm_escalated',
  recentMessages: [
    { direction: 'in' as const, body: 'I need funding now' },
    { direction: 'out' as const, body: 'Tell me about your situation' },
  ],
}

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

afterEach(() => {
  delete process.env.IMESSAGE_RELAY_URL
  delete process.env.IMESSAGE_RELAY_TOKEN
})

describe('handoffToHuman — Slack hostname allowlist', () => {
  it('POSTs to hooks.slack.com when the webhook host is allowlisted', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)
    await handoffToHuman({
      ...baseArgs,
      org: { ...baseOrg, handoffSlackWebhook: 'https://hooks.slack.com/services/T/B/x' },
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe('https://hooks.slack.com/services/T/B/x')
  })

  it('REFUSES non-allowlisted hostnames (attacker-controlled webhook does NOT get PII)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await handoffToHuman({
      ...baseArgs,
      org: { ...baseOrg, handoffSlackWebhook: 'https://evil.example.com/exfil' },
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })

  it('REFUSES malformed URLs without throwing', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(
      handoffToHuman({ ...baseArgs, org: { ...baseOrg, handoffSlackWebhook: 'not-a-url' } }),
    ).resolves.toBeUndefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('redacts phone to last-4 in the outbound text body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)
    await handoffToHuman({
      ...baseArgs,
      org: { ...baseOrg, handoffSlackWebhook: 'https://hooks.slack.com/services/T/B/x' },
    })
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body) as { text: string }
    expect(body.text).toContain('***-***-4567')
    expect(body.text).not.toContain('[phone removed]')
  })
})

describe('handoffToHuman — iMessage Bearer auth', () => {
  it('silently skips iMessage send when IMESSAGE_RELAY_URL is unset (cloud path)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)
    await handoffToHuman({
      ...baseArgs,
      org: { ...baseOrg, handoffImessageTarget: '+15559998888' },
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('REFUSES send when IMESSAGE_RELAY_URL is set but token is missing', async () => {
    process.env.IMESSAGE_RELAY_URL = 'https://relay.example.com/send'
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await handoffToHuman({
      ...baseArgs,
      org: { ...baseOrg, handoffImessageTarget: '+15559998888' },
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends with Bearer header when both env vars are set', async () => {
    process.env.IMESSAGE_RELAY_URL = 'https://relay.example.com/send'
    process.env.IMESSAGE_RELAY_TOKEN = 'secret-token-xyz'
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)
    await handoffToHuman({
      ...baseArgs,
      org: { ...baseOrg, handoffImessageTarget: '+15559998888' },
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://relay.example.com/send')
    expect((init as RequestInit).headers).toMatchObject({
      authorization: 'Bearer secret-token-xyz',
    })
  })
})

describe('handoffToHuman — fan-out resilience', () => {
  it('does not throw when Slack fetch rejects (resilient handoff)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net down')))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(
      handoffToHuman({
        ...baseArgs,
        org: { ...baseOrg, handoffSlackWebhook: 'https://hooks.slack.com/x' },
      }),
    ).resolves.toBeUndefined()
  })

  it('skips both channels when both fields are null', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await handoffToHuman(baseArgs)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
