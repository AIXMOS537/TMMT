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
  const outboundGate = vi.fn(async () => ({ allowed: true, reason: 'ok', flags: ['gate_allow', 'dnc_clear'] }))
  const state = {
    scenario: { optedOut: false, seenSid: false, duplicateSidOnInsert: false },
    updates: [] as Record<string, unknown>[],
    inserted: [] as Record<string, unknown>[],
    sidLookups: [] as Record<string, unknown>[],
  }
  const makeDb = () => ({
    from: (table: string) => {
      const filters: Record<string, unknown> = {}
      const api: Record<string, unknown> = {}
      const self = () => api
      Object.assign(api, {
        select: self, is: self, neq: self, order: self, limit: self,
        eq: (k: string, v: unknown) => { filters[k] = v; return api },
        maybeSingle: async () => {
          if (table === 'incoming_leads') {
            return { data: { id: 'lead-1', opted_out: state.scenario.optedOut, agent_status: 'NEW' } }
          }
          if (table === 'agent_messages' && 'metadata->>provider_message_sid' in filters) {
            state.sidLookups.push({ ...filters })
            return { data: state.scenario.seenSid ? { id: 'msg-old' } : null, error: null }
          }
          return { data: { id: 'conv-1' } }
        },
        single: async () => ({ data: { id: 'lead-1', opted_out: state.scenario.optedOut } }),
        insert: (row: Record<string, unknown>) => {
          if (table === 'agent_messages' && row.direction === 'in' && state.scenario.duplicateSidOnInsert) {
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
  return { processInbound, outboundGate, state, makeDb }
})

// processInbound is the expensive, side-effectful step (LLM call + outbound SMS).
// Every guard below is judged by ONE question: did this stay uncalled?
vi.mock('@/lib/agent/process-inbound', () => ({ processInbound: h.processInbound }))
vi.mock('@/lib/supabase-service', () => ({ createServiceRoleClient: () => h.makeDb() }))
vi.mock('@/lib/agent/tenant', () => ({
  resolveOrgByTwilioNumber: async () => ({ id: 'org-1', name: 'TMMT', partnerAppSlug: 'aixmos' }),
  OrgNotFoundError: class OrgNotFoundError extends Error {},
}))
vi.mock('@/lib/agent/handoff', () => ({ handoffToHuman: vi.fn(async () => undefined) }))
vi.mock('@/lib/agent/guard', () => ({
  LicenseDisabledError: class extends Error {},
  OperationalKillError: class extends Error {},
  LlmCapExceededError: class extends Error {},
}))
vi.mock('@/lib/outbound-gate', () => ({
  assertOutboundAllowed: h.outboundGate,
  orgSmsVertical: (org: { partnerAppSlug?: string | null }) => org.partnerAppSlug ?? '',
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
  h.state.scenario = { optedOut: false, seenSid: false, duplicateSidOnInsert: false }
  h.state.updates = []
  h.state.inserted = []
  h.state.sidLookups = []
  processInbound.mockClear()
  h.outboundGate.mockClear()
  h.outboundGate.mockResolvedValue({ allowed: true, reason: 'ok', flags: ['gate_allow', 'dnc_clear'] })
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

describe('inbound SMS — malformed body', () => {
  // Regression: req.formData() threw a TypeError on any non-form Content-Type
  // and it escaped as a 500 on a public unauthenticated route. Measured in
  // production 2026-09-09: POST with no body -> 500.
  it('answers 400, not 500, when the body is not form-encoded', async () => {
    const res = await POST(new Request(URL_, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ From: '+15551112222', Body: 'hi' }),
    }))
    expect(res.status).toBe(400)
    expect(processInbound).not.toHaveBeenCalled()
  })

  it('answers 400 when there is no body or Content-Type at all', async () => {
    const res = await POST(new Request(URL_, { method: 'POST' }))
    expect(res.status).toBe(400)
    expect(processInbound).not.toHaveBeenCalled()
  })

  // The 400 must stay distinguishable from the signature drop: a malformed body
  // is the caller's error, while an unsigned request is answered with an empty
  // TwiML 200 on purpose so Twilio does not retry-flood and nothing leaks.
  it('does not collapse into the signature path: unsigned still returns TwiML 200', async () => {
    const res = await POST(new Request(URL_, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(base).toString(),
    }))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('<Response/>')
    expect(processInbound).not.toHaveBeenCalled()
  })
})

describe('inbound SMS — replay gate (F-01)', () => {
  it('processes a first delivery', async () => {
    const res = await POST(signedRequest(base))
    expect(processInbound).toHaveBeenCalledTimes(1)
    expect(await res.text()).toContain('agent reply')
  })

  it('records the MessageSid in metadata so the staged unique index can reject a replay', async () => {
    await POST(signedRequest(base))
    const inbound = h.state.inserted.find((r) => r.table === 'agent_messages' && r.direction === 'in')
    expect(inbound?.metadata).toEqual({ provider_message_sid: 'SM_abc123' })
  })

  it('looks the sid up in this conversation before doing anything else', async () => {
    await POST(signedRequest(base))
    expect(h.state.sidLookups).toEqual([
      { conversation_id: 'conv-1', 'metadata->>provider_message_sid': 'SM_abc123' },
    ])
  })

  it('drops a replayed MessageSid BEFORE the LLM call (soft gate: lookup)', async () => {
    h.state.scenario.seenSid = true
    const res = await POST(signedRequest(base))
    expect(await res.text()).toBe('<Response/>')
    expect(processInbound).not.toHaveBeenCalled()
    expect(h.state.inserted.some((r) => r.table === 'agent_messages')).toBe(false)
  })

  it('drops a replay the unique index catches (hard gate: 23505) BEFORE the LLM call', async () => {
    h.state.scenario.duplicateSidOnInsert = true
    const res = await POST(signedRequest(base))
    expect(await res.text()).toBe('<Response/>')
    expect(processInbound).not.toHaveBeenCalled()
  })

  it('skips the lookup when Twilio sends no sid, and still processes', async () => {
    const { MessageSid: _omit, ...noSid } = base
    void _omit
    await POST(signedRequest(noSid))
    expect(h.state.sidLookups).toEqual([])
    expect(processInbound).toHaveBeenCalledTimes(1)
    const inbound = h.state.inserted.find((r) => r.table === 'agent_messages' && r.direction === 'in')
    expect(inbound?.metadata).toEqual({})
  })
})

describe('inbound SMS — opt-out is now read, not just written (F-01)', () => {
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

describe('inbound SMS — the TwiML reply goes through the outbound gate (F-02 / F-03)', () => {
  it('asks the gate with the sender phone, org, vertical and transactional type', async () => {
    await POST(signedRequest(base))
    expect(h.outboundGate).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '+15551112222',
        organizationId: 'org-1',
        vertical: 'aixmos',
        type: 'transactional',
      })
    )
  })

  it('withholds the reply and skips the LLM when the gate refuses (do-not-contact)', async () => {
    h.outboundGate.mockResolvedValue({ allowed: false, reason: 'dnc', flags: ['gate_allow', 'dnc'] })
    const res = await POST(signedRequest(base))
    expect(await res.text()).toBe('<Response/>')
    expect(processInbound).not.toHaveBeenCalled()
    const withheld = h.state.inserted.find((r) => r.table === 'agent_messages' && r.direction === 'out')
    expect(withheld?.compliance_flags).toEqual(['gate_allow', 'dnc'])
  })

  it('stamps the gate flags onto the recorded reply when allowed', async () => {
    await POST(signedRequest(base))
    const out = h.state.inserted.find((r) => r.table === 'agent_messages' && r.direction === 'out')
    expect(out?.compliance_flags).toEqual(['gate_allow', 'dnc_clear'])
  })

  it('the gate runs after the opt-out guard, so an opted-out lead never reaches it', async () => {
    h.state.scenario.optedOut = true
    await POST(signedRequest(base))
    expect(h.outboundGate).not.toHaveBeenCalled()
  })
})
