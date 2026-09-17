/**
 * Bella's webhook authenticates with a static header secret, not a signature.
 * Anyone who captures one valid request can resend it forever, and these
 * actions book, page a human, and mutate contacts. These tests hold the guard.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { seenVoiceEvent, voiceAuditAction, VOICE_REPLAY_WINDOW_SECONDS } from './voice-replay'

type Filter = { col: string; val: string }

/** Records the filters applied so we can assert HOW the lookup was keyed. */
function fakeDb(opts: { hit?: boolean; error?: string } = {}) {
  const filters: Filter[] = []
  const db = {
    from() {
      const chain = {
        select: () => chain,
        eq: (col: string, val: string) => { filters.push({ col, val }); return chain },
        gte: (col: string, val: string) => { filters.push({ col, val }); return chain },
        limit: () => chain,
        maybeSingle: async () =>
          opts.error
            ? { data: null, error: { message: opts.error } }
            : { data: opts.hit ? { id: 'a1' } : null, error: null },
      }
      return chain
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return { db, filters }
}

const ORG = '11111111-1111-1111-1111-111111111111'

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => vi.restoreAllMocks())

describe('the good key — call_id', () => {
  it('uses call_id when present, with NO time window', async () => {
    const { db, filters } = fakeDb({ hit: false })
    const v = await seenVoiceEvent(db, { organizationId: ORG, action: 'book_handoff', callId: 'call-1', contactId: 'c1' })
    expect(v.keyed).toBe('call_id')
    expect(filters.some((f) => f.col === 'payload->>call_id' && f.val === 'call-1')).toBe(true)
    expect(filters.some((f) => f.col === 'ts')).toBe(false)
  })

  it('reports a replay when that call_id already acted', async () => {
    const { db } = fakeDb({ hit: true })
    const v = await seenVoiceEvent(db, { organizationId: ORG, action: 'book_handoff', callId: 'call-1' })
    expect(v.seen).toBe(true)
  })

  it('prefers call_id over the contact fallback when both are available', async () => {
    const { db, filters } = fakeDb()
    await seenVoiceEvent(db, { organizationId: ORG, action: 'qualify_lead', callId: 'call-9', contactId: 'c1' })
    expect(filters.some((f) => f.col === 'payload->>contact_id')).toBe(false)
  })
})

describe('the fallback — contact within a short window', () => {
  it('keys on contact_id AND action AND a time window', async () => {
    const now = new Date('2026-09-12T12:00:00Z')
    const { db, filters } = fakeDb()
    const v = await seenVoiceEvent(db, { organizationId: ORG, action: 'escalate_human', contactId: 'c1', now })
    expect(v.keyed).toBe('contact_window')
    expect(filters.some((f) => f.col === 'payload->>contact_id' && f.val === 'c1')).toBe(true)
    expect(filters.some((f) => f.col === 'action' && f.val === 'voice.escalate_human')).toBe(true)
    const since = filters.find((f) => f.col === 'ts')!
    expect(new Date(since.val).toISOString()).toBe(
      new Date(now.getTime() - VOICE_REPLAY_WINDOW_SECONDS * 1000).toISOString(),
    )
  })

  // A caller who rings back tomorrow must not be silently suppressed.
  it('scopes to one org and one action, so a different action is not swallowed', async () => {
    const { db, filters } = fakeDb()
    await seenVoiceEvent(db, { organizationId: ORG, action: 'tag_vertical', contactId: 'c1' })
    expect(filters.some((f) => f.col === 'organization_id' && f.val === ORG)).toBe(true)
    expect(filters.some((f) => f.col === 'action' && f.val === 'voice.tag_vertical')).toBe(true)
  })

  it('does not guess when there is neither a call_id nor a contact_id', async () => {
    const { db, filters } = fakeDb({ hit: true })
    const v = await seenVoiceEvent(db, { organizationId: ORG, action: 'post_call_summary' })
    expect(v).toEqual({ seen: false, keyed: 'none' })
    expect(filters).toHaveLength(0)
  })

  it('treats a blank call_id as absent rather than matching on empty string', async () => {
    const { db, filters } = fakeDb()
    const v = await seenVoiceEvent(db, { organizationId: ORG, action: 'qualify_lead', callId: '   ', contactId: 'c1' })
    expect(v.keyed).toBe('contact_window')
    expect(filters.some((f) => f.col === 'payload->>call_id')).toBe(false)
  })
})

describe('failure behaviour', () => {
  // Deliberately the opposite of the outbound gate. Dropping a real mid-call
  // action on a DB blip breaks a live conversation with a customer on the line.
  it('fails OPEN on a lookup error, and says so in the log', async () => {
    const { db } = fakeDb({ error: 'timeout' })
    const v = await seenVoiceEvent(db, { organizationId: ORG, action: 'book_handoff', callId: 'call-1' })
    expect(v.seen).toBe(false)
    expect(console.warn).toHaveBeenCalled()
  })
})

describe('audit action naming', () => {
  it('namespaces voice actions so they cannot collide with other audit rows', () => {
    expect(voiceAuditAction('book_handoff')).toBe('voice.book_handoff')
  })
})

describe('the handler is actually wired to all of this', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/agent/voice/ghl-voice-handler.ts'), 'utf8')
  const route = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/agent/voice/ghl/route.ts'), 'utf8')

  it('calls seenVoiceEvent', () => {
    const i = src.indexOf('seenVoiceEvent(db')
    expect(i, 'handler no longer calls seenVoiceEvent').toBeGreaterThan(-1)
  })

  it('checks for a replay BEFORE the action runs any side effect', () => {
    const check = src.indexOf('seenVoiceEvent(db')
    const act = src.indexOf('await performVoiceAction(')
    expect(check, 'handler no longer calls seenVoiceEvent').toBeGreaterThan(-1)
    expect(act, 'handler no longer calls performVoiceAction').toBeGreaterThan(-1)
    expect(check).toBeLessThan(act)
  })

  // Recording a no-op would sit in the replay window and suppress the retry
  // that actually carries the data. ok:true is not the same as "did something".
  it('does NOT audit an outcome that performed no side effect', () => {
    expect(src).toContain('NO_OP_DETAILS')
    const guard = src.slice(src.indexOf('if (result.ok'), src.indexOf('if (result.ok') + 80)
    expect(guard).toContain('NO_OP_DETAILS')
  })

  it('emits an audit event — this handler previously emitted none at all', () => {
    const i = src.indexOf('emitAudit(')
    expect(i, 'handler no longer emits an audit event').toBeGreaterThan(-1)
  })

  it('the route passes call_id through so the good key can be used', () => {
    expect(route).toContain('call_id:')
    expect(route).toContain('merged.call_id')
  })
})
