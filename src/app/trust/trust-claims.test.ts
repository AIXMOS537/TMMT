/**
 * The trust page makes public promises. These tests are the tripwire that stops
 * a future edit from putting back a claim the code cannot support.
 *
 * Three of the six promises in the original draft did NOT hold when checked
 * against the code. Two were reworded, one was fixed in code. The banned
 * phrases below are the exact wordings that failed, so reintroducing any of
 * them turns this red.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const page = readFileSync(join(process.cwd(), 'src/app/trust/page.tsx'), 'utf8')
const prose = page.slice(page.indexOf('const PROMISES'))
const middleware = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8')

describe('claims the code does not support must not reappear', () => {
  // Owner approval gates PROMOTIONAL sends. A booking confirmation goes without
  // a human — correct design, but not what "every message" says.
  it('does not claim a person approves EVERY message', () => {
    expect(prose).not.toMatch(/approves every message/i)
    expect(prose).not.toMatch(/every message .{0,30}approved/i)
  })

  // We record consent going forward; most of the existing book predates it.
  it('does not claim we always asked permission first', () => {
    expect(prose).not.toMatch(/we ask permission before we (text|contact|message)/i)
    expect(prose).not.toMatch(/we never (buy|purchase) (phone )?(number|list)/i)
  })

  // The disclosure is a prompt instruction, not enforced code.
  it('describes the AI disclosure as an instruction, not a guarantee', () => {
    expect(prose).toMatch(/told to say/i)
    expect(prose).not.toMatch(/always (says|tells)/i)
    expect(prose).not.toMatch(/guarantee/i)
  })
})

describe('the claims it DOES make are the ones that hold', () => {
  it('claims the global stop list, which now exists', () => {
    expect(prose).toMatch(/not just for one campaign/i)
    // The code half: STOP writes to the global list.
    const route = readFileSync(
      join(process.cwd(), 'src/app/api/agent/sms/inbound/route.ts'), 'utf8')
    const recorder = join(process.cwd(), 'src/lib/agent/compliance/record-opt-out.ts')
    expect(route.includes('recordGlobalOptOut') || readFileSync(recorder, 'utf8').length > 0).toBe(true)
  })

  it('claims quiet hours in the recipient timezone, which the code does', () => {
    const qh = readFileSync(
      join(process.cwd(), 'src/lib/agent/compliance/quiet-hours.ts'), 'utf8')
    expect(qh).toContain('QUIET_START_HOUR = 21')
    expect(qh).toContain('QUIET_END_HOUR = 8')
    expect(prose).toMatch(/9 at night and 8 in the morning/i)
  })
})

describe('public voice', () => {
  const BANNED = [
    'HAILMARY', 'CHUMMO', 'MOOSE', 'BRAINIAC', 'Carry', 'Justice League',
    'Replica', 'Young Justice', 'AIXMOS', 'Rick',
  ]
  it('carries no internal codename', () => {
    for (const w of BANNED) {
      expect(page.includes(w), `internal codename "${w}" is on a public page`).toBe(false)
    }
  })

  it('uses no unbackable superlatives', () => {
    for (const w of ['military-grade', 'bank-level', 'enterprise-grade', 'bulletproof', '100%']) {
      expect(prose.toLowerCase()).not.toContain(w.toLowerCase())
    }
  })

  it('has exactly one call to action', () => {
    expect(page.match(/<Link/g) ?? []).toHaveLength(1)
  })
})

describe('it is actually reachable signed-out', () => {
  it('is in the middleware public path list', () => {
    expect(middleware).toContain('pathname === "/trust"')
  })
})
