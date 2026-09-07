import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'

// vi.mock factories are hoisted above every const, so all shared state and the
// Supabase double live inside vi.hoisted().
const h = vi.hoisted(() => {
  const processInbound = vi.fn(async () => ({
    newState: 'ENGAGED',
    outboundBody: 'agent reply',
    complianceFlags: [] as string[],
    llmAssessment: null,
  }))
  const state = {
    scenario: { optedOut: false, duplicateSid: false },
    updates: [] as Record<string, unknown>[],
    inserted: [] as Record<string, unknown>[],
  }
  const makeDb = () => ({
    from: (table: string) => {
      const api: Record<string, unknown> = {}
      const self = () => api
      Object.assign(api, {
        select: self, eq: self, is: self, neq: self, order: self, limit: self,
        maybeSingle: async () =>
          table === 'incoming_leads'
            ? { data: { id: 'lead-1', opted_out: state.scenario.optedOut, agent_status: 'NEW' } }
            : { data: { id: 'conv-1' } },
        single: async () => ({ data: { id: 'lead-1', opted_out: state.scenario.optedOut } }),
        insert: (row: Record<string, unknown>) => {
          if (table === 'agent_messages' && row.direction === 'in' && state.scenario.duplicateSid) {
            return { error: { code: '23505', message: 'duplicate key' } }
          }
          state.inserted.push({ table, ...row })
          return { error: null, select: () => ({ single: async () => ({ data: { id: 'new-1' } }) }) }
        },
        update: (row: Record<string, unknown>) => {
          state.updates.push({ table, ...row })
          return { eq: async () => ({ error: null }) }
        },
      })
      return api
    },
  })
  return { processInbound, state, makeDb }
})

// processInbound is the expensive, side-effectful step (LLM call + outbound SMS).
// Every guard below is judged by ONE question: did this stay uncalled?
vi.mock('@/lib/agent/process-inbound', () => ({ processInbound: h.processInbound }))
vi.mock('@/lib/agent/supabase-server', () => ({ createServiceSupabase: () => h.makeDb() }))
vi.mock('@/lib/agent/tenant', () => ({
  resolveOrgByTwilioNumber: async () => ({ id: 'org-1', name: 'TMMT' }),
  OrgNotFoundError: class OrgNotFoundError extends Error {},
}))
vi.mock('@/lib/agent/handoff', () => ({ handoffToHuman: vi.fn(async () => undefined) }))
vi.mock('@/lib/agent/guard', () => ({
  LicenseDisabledError: class extends Error {},
  OperationalKillError: class extends Error {},
  LlmCapExceededError: class extends Error {},
}))

const processInbound = h.processInbound

import { POST } from './route'

// ── real signature, not a mocked one ────────────────────────────────────────
const TOKEN = 'test_auth_token'
const URL_ = 'https://tmmt.example.com/api/agent/sms/inbound'

function signedRequest(params: Record<string, string>): Request {
  let toSign = URL_
  for (const k of Object.keys(params).sort()) toSign += k + params[k]
  const sig = createHmac('sha1', TOKEN).update(toSign).digest('base64')
  return new Request(URL_, {
    method: 'POST',
    headers: {
      'x-twilio-signature': sig,
      'x-forwarded-host': 'tmmt.example.com',
      'x-forwarded-proto': 'https',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  })
}

const base = { From: '+15551112222', To: '+15550000000', Body: 'hello', MessageSid: 'SM_abc123' }

beforeEach(() => {
  process.env.TWILIO_AUTH_TOKEN = TOKEN
  h.state.scenario = { optedOut: false, duplicateSid: false }
  h.state.updates = []
  h.state.inserted = []
  processInbound.mockClear()
})

describe('inbound SMS — signature', () => {
  it('rejects an unsigned request without reaching the agent', async () => {
    const res = await POST(new Request(URL_, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(base).toString(),
    }))
    expect(await res.text()).toBe('<Response/>')
    expect(processInbound).not.toHaveBeenCalled()
  })

  it('rejects a tampered body under a valid-looking signature', async () => {
    const req = signedRequest(base)
    const tampered = new Request(URL_, {
      method: 'POST',
      headers: req.headers,
      body: new URLSearchParams({ ...base, Body: 'attacker payload' }).toString(),
    })
    expect(await (await POST(tampered)).text()).toBe('<Response/>')
    expect(processInbound).not.toHaveBeenCalled()
  })
})

describe('inbound SMS — replay gate (finding 1)', () => {
  it('processes a first delivery', async () => {
    const res = await POST(signedRequest(base))
    expect(processInbound).toHaveBeenCalledTimes(1)
    expect(await res.text()).toContain('agent reply')
  })

  it('records the MessageSid so the unique index can reject a replay', async () => {
    await POST(signedRequest(base))
    const inbound = h.state.inserted.find((r) => r.table === 'agent_messages' && r.direction === 'in')
    expect(inbound?.provider_message_sid).toBe('SM_abc123')
  })

  it('drops a replayed MessageSid BEFORE the LLM call', async () => {
    h.state.scenario.duplicateSid = true
    const res = await POST(signedRequest(base))
    expect(await res.text()).toBe('<Response/>')
    expect(processInbound).not.toHaveBeenCalled()   // the whole point: no LLM, no send
  })
})

describe('inbound SMS — opt-out is now read, not just written (finding 2)', () => {
  it('does not reply to an opted-out lead', async () => {
    h.state.scenario.optedOut = true
    const res = await POST(signedRequest(base))
    expect(await res.text()).toBe('<Response/>')
    expect(processInbound).not.toHaveBeenCalled()
  })

  it('still records the inbound message from an opted-out lead (audit trail intact)', async () => {
    h.state.scenario.optedOut = true
    await POST(signedRequest(base))
    expect(h.state.inserted.some((r) => r.table === 'agent_messages' && r.direction === 'in')).toBe(true)
  })

  it('honours START and clears the flag — the auto-reply promises this', async () => {
    h.state.scenario.optedOut = true
    const res = await POST(signedRequest({ ...base, Body: 'START' }))
    expect(await res.text()).toContain('opted back in')
    expect(h.state.updates).toContainEqual(
      expect.objectContaining({ table: 'incoming_leads', opted_out: false })
    )
    expect(processInbound).not.toHaveBeenCalled()
  })

  it('does not silence someone permanently: opt-in works from the opted-out state', async () => {
    h.state.scenario.optedOut = true
    await POST(signedRequest({ ...base, Body: 'start', MessageSid: 'SM_optin' }))
    const cleared = h.state.updates.find((u) => u.opted_out === false)
    expect(cleared).toBeDefined()
  })
})
