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
    scenario: { optedOut: false, seenSid: false, duplicateSidOnInsert: false, leadUpdateError: false },
    audits: [] as Array<{ action: string; payload?: Record<string, unknown> }>,
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
          const error = table === 'incoming_leads' && state.scenario.leadUpdateError
            ? { message: 'simulated write failure' } : null
          return { eq: async () => ({ error }) }
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
  resolveOrgByTwilioNumber: async () => ({ id: '11111111-1111-4111-8111-111111111111', name: 'TMMT', partnerAppSlug: 'aixmos' }),
  OrgNotFoundError: class OrgNotFoundError extends Error {},
}))
vi.mock('@/lib/agent/handoff', () => ({ handoffToHuman: vi.fn(async () => undefined) }))
vi.mock('@/lib/agent/guard', () => ({
  LicenseDisabledError: class extends Error {},
  OperationalKillError: class extends Error {},
  LlmCapExceededError: class extends Error {},
  isOperationalKillEngaged: () => process.env.B3_KILL_SWITCH === '1',
}))
vi.mock('@/lib/agent/audit', () => ({
  emitAudit: vi.fn(async (e: { action: string; payload?: Record<string, unknown> }) => {
    h.state.audits.push({ action: e.action, payload: e.payload })
  }),
}))
vi.mock('@/lib/outbound-gate', () => ({
  assertOutboundAllowed: h.outboundGate,
  orgSmsVertical: (org: { partnerAppSlug?: string | null }) => org.partnerAppSlug ?? '',
}))

const processInbound = h.processInbound
const ORG_ID = '11111111-1111-4111-8111-111111111111'

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
  h.state.scenario = { optedOut: false, seenSid: false, duplicateSidOnInsert: false, leadUpdateError: false }
  h.state.audits = []
  delete process.env.B3_KILL_SWITCH
  processInbound.mockReset()
  delete process.env.B3_AUTO_REPLY_ORGS
  processInbound.mockImplementation(async () => ({
    newState: 'ENGAGED',
    outboundBody: 'agent reply',
    draftBody: 'agent reply',
    complianceFlags: [] as string[],
    llmAssessment: null,
  }))
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
  it('processes a first delivery (reply sent only because the org is allowlisted)', async () => {
    process.env.B3_AUTO_REPLY_ORGS = ORG_ID
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
        organizationId: '11111111-1111-4111-8111-111111111111',
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
    process.env.B3_AUTO_REPLY_ORGS = ORG_ID
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

// ── communication control runs before every AI guard (C-21 containment A) ──
// processInbound holds the licence / kill-switch / spend-cap guards and the
// LLM call. "processInbound not called" therefore means: no guard could
// block the suppression and Anthropic was never called.
const EXPLICIT = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'stop please', 'opt out']
const STOP_LIKE = ['STOP ALL', 'STOP!', 'please stop', 'stop texting me', "don't message me anymore", 'take me off your list']

const suppression = () => h.state.updates.filter((u) => u.table === 'incoming_leads' && u.opted_out === true)
const outRows = () => h.state.inserted.filter((r) => r.table === 'agent_messages' && r.direction === 'out')

describe('inbound SMS — explicit opt-out keyword', () => {
  it.each(EXPLICIT)('%j records suppression, never reaches the agent, and sends only the fixed acknowledgement', async (Body) => {
    const res = await POST(signedRequest({ ...base, Body }))
    expect(processInbound).not.toHaveBeenCalled()
    expect(suppression()).toEqual([
      expect.objectContaining({ opted_out: true, agent_status: 'LOST', opted_out_at: expect.any(String) }),
    ])
    expect(h.state.audits.map((a) => a.action)).toEqual(['compliance.opt_out_received'])
    const text = await res.text()
    expect(text).toContain('opted out')
    expect(text).not.toContain('agent reply')
    expect(outRows()).toEqual([expect.objectContaining({ compliance_flags: ['opt_out', 'gate_allow', 'dnc_clear'] })])
  })

  it.each([
    ['spend cap', 'LlmCapExceededError'],
    ['licence', 'LicenseDisabledError'],
    ['kill switch', 'OperationalKillError'],
  ])('a failing %s guard cannot prevent the suppression', async (_label, name) => {
    const err = new Error(name)
    err.name = name
    processInbound.mockRejectedValue(err)
    await POST(signedRequest({ ...base, Body: 'STOP' }))
    expect(suppression()).toHaveLength(1)
    expect(processInbound).not.toHaveBeenCalled()
  })

  it('kill switch engaged: suppression is still recorded, the acknowledgement is withheld', async () => {
    process.env.B3_KILL_SWITCH = '1'
    const res = await POST(signedRequest({ ...base, Body: 'STOP' }))
    expect(suppression()).toHaveLength(1)
    expect(await res.text()).toBe('<Response/>')
    expect(outRows()).toEqual([expect.objectContaining({ body: '', compliance_flags: ['opt_out', 'ack_withheld_kill_switch'] })])
    expect(h.outboundGate).not.toHaveBeenCalled()
  })

  it('do-not-contact number: suppression recorded, no acknowledgement sent', async () => {
    h.outboundGate.mockResolvedValue({ allowed: false, reason: 'dnc', flags: ['gate_allow', 'dnc'] })
    const res = await POST(signedRequest({ ...base, Body: 'STOP' }))
    expect(suppression()).toHaveLength(1)
    expect(await res.text()).toBe('<Response/>')
  })

  it('outbound gate throwing only withholds the acknowledgement', async () => {
    h.outboundGate.mockRejectedValue(new Error('gate down'))
    const res = await POST(signedRequest({ ...base, Body: 'STOP' }))
    expect(suppression()).toHaveLength(1)
    expect(await res.text()).toBe('<Response/>')
  })

  it('a failed suppression write is audited loudly and nothing is sent', async () => {
    h.state.scenario.leadUpdateError = true
    const res = await POST(signedRequest({ ...base, Body: 'STOP' }))
    expect(await res.text()).toBe('<Response/>')
    expect(h.state.audits.map((a) => a.action)).toEqual(['compliance.opt_out_record_failed'])
    expect(processInbound).not.toHaveBeenCalled()
  })

  it('an already opted-out lead sending STOP gets nothing and is not rewritten', async () => {
    h.state.scenario.optedOut = true
    const res = await POST(signedRequest({ ...base, Body: 'STOP' }))
    expect(await res.text()).toBe('<Response/>')
    expect(h.state.updates).toEqual([])
  })
})

describe('inbound SMS — stop-like message is held for a human', () => {
  it.each(STOP_LIKE)('%j gets no reply, no AI, no gate call, and is flagged for review', async (Body) => {
    const res = await POST(signedRequest({ ...base, Body }))
    expect(await res.text()).toBe('<Response/>')
    expect(processInbound).not.toHaveBeenCalled()
    expect(h.outboundGate).not.toHaveBeenCalled()
    expect(suppression()).toEqual([])
    expect(outRows()).toEqual([
      expect.objectContaining({ body: '', compliance_flags: expect.arrayContaining(['stop_like_hold']) }),
    ])
    expect(h.state.audits).toEqual([expect.objectContaining({ action: 'compliance.stop_like_held' })])
  })

  it('an ordinary message still reaches the agent', async () => {
    await POST(signedRequest({ ...base, Body: 'Is the Camry still available?' }))
    expect(processInbound).toHaveBeenCalledTimes(1)
    expect(suppression()).toEqual([])
  })
})

describe('inbound SMS — START acknowledgement is contained, behaviour not widened', () => {
  it('clears only the per-lead flag and audits it', async () => {
    h.state.scenario.optedOut = true
    await POST(signedRequest({ ...base, Body: 'START' }))
    expect(h.state.updates).toEqual([{ table: 'incoming_leads', opted_out: false, opted_out_at: null }])
    expect(h.state.audits).toEqual([expect.objectContaining({ action: 'compliance.opt_in_received' })])
    expect(processInbound).not.toHaveBeenCalled()
  })

  it('kill switch engaged: flag cleared, no confirmation sent (it used to be sent)', async () => {
    h.state.scenario.optedOut = true
    process.env.B3_KILL_SWITCH = '1'
    const res = await POST(signedRequest({ ...base, Body: 'START' }))
    expect(await res.text()).toBe('<Response/>')
  })

  it('do-not-contact number: no confirmation sent (it used to be sent)', async () => {
    h.outboundGate.mockResolvedValue({ allowed: false, reason: 'dnc', flags: ['gate_allow', 'dnc'] })
    const res = await POST(signedRequest({ ...base, Body: 'START' }))
    expect(await res.text()).toBe('<Response/>')
    expect(processInbound).not.toHaveBeenCalled()
  })
})

// ── owner-approval hold for AI replies (C-21 containment B) ─────────────────
const heldDrafts = () => h.state.inserted.filter(
  (r) => r.table === 'agent_messages' && r.direction === 'out'
    && Array.isArray(r.compliance_flags) && (r.compliance_flags as string[]).includes('held_owner_approval'),
)

describe('inbound SMS — AI reply is held for owner approval by default', () => {
  it('normal inbound: AI draft created, held, nothing sent', async () => {
    const res = await POST(signedRequest(base))
    expect(processInbound).toHaveBeenCalledTimes(1)
    expect(await res.text()).toBe('<Response/>')
    expect(heldDrafts()).toEqual([
      expect.objectContaining({
        conversation_id: 'conv-1',
        body: 'agent reply',
        compliance_flags: ['gate_allow', 'dnc_clear', 'held_owner_approval'],
        metadata: { held: 'owner_approval', organization_id: ORG_ID, lead_id: 'lead-1' },
      }),
    ])
    expect(h.state.audits).toEqual([expect.objectContaining({ action: 'agent.reply_held_owner_approval' })])
  })

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['wildcard', '*'],
    ['another org only', '22222222-2222-4222-8222-222222222222'],
  ])('allowlist %s: no AI text reaches the customer', async (_label, raw) => {
    if (raw !== undefined) process.env.B3_AUTO_REPLY_ORGS = raw
    const res = await POST(signedRequest(base))
    expect(await res.text()).toBe('<Response/>')
    expect(heldDrafts()).toHaveLength(1)
  })

  it('quiet hours: the generated draft is still kept, flagged quiet_hours', async () => {
    processInbound.mockResolvedValue({
      newState: 'ENGAGED', outboundBody: null, draftBody: 'agent reply', quietHoursDeferred: true,
      complianceFlags: [], llmAssessment: null,
    } as never)
    const res = await POST(signedRequest(base))
    expect(await res.text()).toBe('<Response/>')
    expect(heldDrafts()).toEqual([
      expect.objectContaining({ compliance_flags: ['gate_allow', 'dnc_clear', 'held_owner_approval', 'quiet_hours'] }),
    ])
  })

  it('suppressed customer: no AI generation, no draft, no send', async () => {
    h.state.scenario.optedOut = true
    const res = await POST(signedRequest(base))
    expect(await res.text()).toBe('<Response/>')
    expect(processInbound).not.toHaveBeenCalled()
    expect(heldDrafts()).toEqual([])
  })

  it('do-not-contact customer: no AI generation, no draft, no send', async () => {
    h.outboundGate.mockResolvedValue({ allowed: false, reason: 'dnc', flags: ['gate_allow', 'dnc'] })
    await POST(signedRequest(base))
    expect(processInbound).not.toHaveBeenCalled()
    expect(heldDrafts()).toEqual([])
  })

  it('STOP still takes the deterministic path: suppression and the fixed acknowledgement, no owner approval needed', async () => {
    const res = await POST(signedRequest({ ...base, Body: 'STOP' }))
    expect(processInbound).not.toHaveBeenCalled()
    expect(h.state.updates).toContainEqual(expect.objectContaining({ table: 'incoming_leads', opted_out: true }))
    expect(await res.text()).toContain('opted out')
    expect(heldDrafts()).toEqual([])
  })

  it('an allowlisted org sends, and every earlier guard still ran first', async () => {
    process.env.B3_AUTO_REPLY_ORGS = ORG_ID
    const res = await POST(signedRequest(base))
    expect(h.outboundGate).toHaveBeenCalledTimes(1)
    expect(processInbound).toHaveBeenCalledTimes(1)
    expect(await res.text()).toContain('agent reply')
    expect(heldDrafts()).toEqual([])
  })

  it('an allowlisted org is still silenced by the opted-out guard and the outbound gate', async () => {
    process.env.B3_AUTO_REPLY_ORGS = ORG_ID
    h.state.scenario.optedOut = true
    expect(await (await POST(signedRequest(base))).text()).toBe('<Response/>')
    h.state.scenario.optedOut = false
    h.outboundGate.mockResolvedValue({ allowed: false, reason: 'dnc', flags: ['gate_allow', 'dnc'] })
    expect(await (await POST(signedRequest(base))).text()).toBe('<Response/>')
    expect(processInbound).not.toHaveBeenCalled()
  })
})
