/**
 * The stop button is a customer-facing control over a live system. These tests
 * exist because the three ways it could go wrong are all serious:
 * pausing someone else's business, writing the terminal 'wipe' command, or
 * a client clearing a kill command that we set.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getAgentFleet,
  pauseOrgAgents,
  resumeOrgAgents,
  describeModule,
} from '@/lib/agent-visibility'

type Update = { patch: Record<string, unknown>; eq: Array<[string, string]> }

function fakeDb(row: Record<string, unknown> | null, opts: { writeError?: string } = {}) {
  const updates: Update[] = []
  const db = {
    from() {
      const state: { patch?: Record<string, unknown>; eqs: Array<[string, string]> } = { eqs: [] }
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.limit = () => chain
      chain.eq = (c: string, v: string) => {
        state.eqs.push([c, v])
        if (state.patch) {
          updates.push({ patch: state.patch, eq: [...state.eqs] })
          return opts.writeError ? { error: { message: opts.writeError } } : { error: null }
        }
        return chain
      }
      chain.update = (patch: Record<string, unknown>) => { state.patch = patch; return chain }
      chain.maybeSingle = async () => ({ data: row, error: row ? null : null })
      return chain
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return { db, updates }
}

const ORG = '11111111-1111-1111-1111-111111111111'
const liveRow = {
  license_tier: 'rentals_app',
  modules: ['sms_agent', 'booking', 'some_new_thing'],
  active: true,
  kill_command: null,
  internal_protected: false,
  last_heartbeat_at: '2026-09-11T10:00:00Z',
}

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => vi.restoreAllMocks())

describe('seeing it', () => {
  it('reports running when the licence is active with no kill command', async () => {
    const { db } = fakeDb(liveRow)
    const v = (await getAgentFleet(db))!
    expect(v.running).toBe(true)
    expect(v.paused).toBe(false)
  })

  it('reports paused when active is false', async () => {
    const { db } = fakeDb({ ...liveRow, active: false })
    expect((await getAgentFleet(db))!.paused).toBe(true)
  })

  it('reports paused when any kill command is set, even with active true', async () => {
    const { db } = fakeDb({ ...liveRow, kill_command: 'pause' })
    expect((await getAgentFleet(db))!.paused).toBe(true)
  })

  it('returns null when there is no licence row, rather than pretending all is well', async () => {
    const { db } = fakeDb(null)
    expect(await getAgentFleet(db)).toBeNull()
  })

  // A view that hides something which IS running would be a lie, and this whole
  // surface is a trust claim.
  it('shows an unknown module with a readable name instead of hiding it', async () => {
    const { db } = fakeDb(liveRow)
    const v = (await getAgentFleet(db))!
    expect(v.agents.map((a) => a.key)).toContain('some_new_thing')
    expect(v.agents.find((a) => a.key === 'some_new_thing')!.label).toBe('Some New Thing')
  })

  it('never shows a raw module key as the label for a known module', () => {
    expect(describeModule('sms_agent').label).toBe('Text assistant')
  })
})

describe('stopping it', () => {
  it('pauses by flipping the licence the guard already reads', async () => {
    const { db, updates } = fakeDb({ internal_protected: false })
    const r = await pauseOrgAgents(db, ORG)
    expect(r.ok).toBe(true)
    expect(updates[0].patch.active).toBe(false)
    expect(updates[0].patch.kill_command).toBe('pause')
  })

  it('scopes the write to exactly one organization', async () => {
    const { db, updates } = fakeDb({ internal_protected: false })
    await pauseOrgAgents(db, ORG)
    expect(updates[0].eq).toContainEqual(['organization_id', ORG])
  })

  // 'wipe' is terminal in guard.ts. A customer pressing pause must never be one
  // typo from destroying their install.
  it('NEVER writes the terminal wipe command', async () => {
    const { db, updates } = fakeDb({ internal_protected: false })
    await pauseOrgAgents(db, ORG)
    expect(JSON.stringify(updates[0].patch)).not.toContain('wipe')
  })

  it('refuses to pause an internally protected org', async () => {
    const { db, updates } = fakeDb({ internal_protected: true })
    const r = await pauseOrgAgents(db, ORG)
    expect(r).toEqual({ ok: false, reason: 'protected' })
    expect(updates).toHaveLength(0)
  })

  it('refuses when there is no licence row', async () => {
    const { db, updates } = fakeDb(null)
    expect((await pauseOrgAgents(db, ORG)).reason).toBe('not_found')
    expect(updates).toHaveLength(0)
  })

  it('reports a failed write instead of claiming success', async () => {
    const { db } = fakeDb({ internal_protected: false }, { writeError: 'denied' })
    const r = await pauseOrgAgents(db, ORG)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('write_failed')
  })
})

describe('starting it again', () => {
  it('clears a pause it set', async () => {
    const { db, updates } = fakeDb({ internal_protected: false, kill_command: 'pause' })
    const r = await resumeOrgAgents(db, ORG)
    expect(r.ok).toBe(true)
    expect(updates[0].patch.active).toBe(true)
    expect(updates[0].patch.kill_command).toBeNull()
  })

  // The client set 'pause'. They did not set 'wipe', and they must not clear it.
  it('refuses to clear a kill command the client did not set', async () => {
    const { db, updates } = fakeDb({ internal_protected: false, kill_command: 'wipe' })
    const r = await resumeOrgAgents(db, ORG)
    expect(r.ok).toBe(false)
    expect(updates).toHaveLength(0)
  })

  it('refuses to resume an internally protected org', async () => {
    const { db, updates } = fakeDb({ internal_protected: true, kill_command: 'pause' })
    expect((await resumeOrgAgents(db, ORG)).reason).toBe('protected')
    expect(updates).toHaveLength(0)
  })

  it('round-trips: pause then resume returns to running', async () => {
    const p = fakeDb({ internal_protected: false })
    expect((await pauseOrgAgents(p.db, ORG)).ok).toBe(true)
    const r = fakeDb({ internal_protected: false, kill_command: 'pause' })
    expect((await resumeOrgAgents(r.db, ORG)).ok).toBe(true)
    expect(r.updates[0].patch.active).toBe(true)
  })
})

describe('the module never reaches for a wipe', () => {
  it('contains no path that can write wipe', () => {
    const src = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/lib/agent-visibility.ts'), 'utf8')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toContain("'wipe'")
    expect(code).not.toContain('"wipe"')
  })
})

// The security model of the stop button lives in the server action, not the UI.
describe('the server action takes the org from the session, never the request', () => {
  const fs = require('node:fs'); const path = require('node:path')
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src/app/(pocket)/pocket/agents/actions.ts'), 'utf8')

  it('resolves the organization from the signed-in user', () => {
    expect(src).toContain('supabase.auth.getUser()')
    expect(src).toContain('resolveOrgIdByEmail')
  })

  // If it ever accepted an org id as a parameter, it would be a button that
  // pauses other people's businesses.
  it('the exported actions take NO arguments at all', () => {
    expect(src).toMatch(/export async function pauseMyAgents\(\s*\)/)
    expect(src).toMatch(/export async function resumeMyAgents\(\s*\)/)
  })

  it('refuses when nobody is signed in', () => {
    expect(src).toContain("return { ok: false, error: 'not_signed_in' }")
  })

  it('audits every use — a change to a live system must be answerable', () => {
    expect(src).toContain('emitAudit')
    expect(src).toContain('client.agents_')
  })
})
