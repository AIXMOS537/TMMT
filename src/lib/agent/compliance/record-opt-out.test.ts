/**
 * STOP must reach the GLOBAL block list, not just the one lead row.
 *
 * The bug these tests lock down: `incoming_leads.opted_out` was set and
 * `do_not_contact_numbers` was never written, so the list the outbound gate
 * actually consults stayed empty except for hand-entered rows.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { recordGlobalOptOut } from './record-opt-out'

type Call = { table: string; row?: unknown; opts?: unknown }

function fakeDb(opts: { error?: string } = {}) {
  const calls: Call[] = []
  const db = {
    from(table: string) {
      return {
        async upsert(row: unknown, o: unknown) {
          calls.push({ table, row, opts: o })
          return opts.error ? { error: { message: opts.error } } : { error: null }
        },
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return { db, calls }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('recordGlobalOptOut', () => {
  it('writes the number to do_not_contact_numbers — the table the gate reads', async () => {
    const { db, calls } = fakeDb()
    const r = await recordGlobalOptOut(db, '+1 (703) 555-0100')
    expect(r.ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].table).toBe('do_not_contact_numbers')
  })

  it('stores the last ten digits, matching how the gate looks numbers up', async () => {
    const { db, calls } = fakeDb()
    await recordGlobalOptOut(db, '+1 (703) 555-0100')
    expect((calls[0].row as { phone10: string }).phone10).toBe('7035550100')
  })

  it.each([
    '+17035550100',
    '7035550100',
    '(703) 555-0100',
    '703.555.0100',
    '1-703-555-0100',
  ])('normalises %s to the same key, so formatting cannot dodge the list', async (input) => {
    const { db, calls } = fakeDb()
    await recordGlobalOptOut(db, input)
    expect((calls[0].row as { phone10: string }).phone10).toBe('7035550100')
  })

  it('records a reason, since the live table has no source column', async () => {
    const { db, calls } = fakeDb()
    await recordGlobalOptOut(db, '+17035550100', 'inbound STOP via SMS agent')
    expect((calls[0].row as { reason: string }).reason).toBe('inbound STOP via SMS agent')
  })

  it('is idempotent and does not overwrite the first reason on a repeat STOP', async () => {
    const { db, calls } = fakeDb()
    await recordGlobalOptOut(db, '+17035550100')
    expect(calls[0].opts).toEqual({ onConflict: 'phone10', ignoreDuplicates: true })
  })

  it('refuses a phone it cannot parse rather than writing a junk key', async () => {
    const { db, calls } = fakeDb()
    for (const bad of ['', '   ', '12345', 'not a phone', null, undefined]) {
      const r = await recordGlobalOptOut(db, bad)
      expect(r.ok).toBe(false)
      expect(r.error).toBe('unparseable_phone')
    }
    expect(calls).toHaveLength(0)
  })

  // A compliance write that fails silently is how a suppression list ends up
  // looking complete while being empty.
  it('reports a write failure instead of swallowing it', async () => {
    const { db } = fakeDb({ error: 'permission denied' })
    const r = await recordGlobalOptOut(db, '+17035550100')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('permission denied')
    expect(console.error).toHaveBeenCalled()
  })
})

describe('the inbound route actually calls it', () => {
  it('wires recordGlobalOptOut into the opt-out branch', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/agent/sms/inbound/route.ts'),
      'utf8',
    )
    expect(src).toContain('recordGlobalOptOut')

    // The call must EXIST. Asserting only on a slice around indexOf() is a
    // false green: a missing call gives idx === -1, and slice(0, -1) is almost
    // the whole file, which of course contains the anchor. Caught by removing
    // the wiring and watching this test still pass.
    const idx = src.indexOf('recordGlobalOptOut(db')
    expect(idx, 'the inbound route no longer calls recordGlobalOptOut').toBeGreaterThan(-1)

    // And EVERY call site must sit on an opt-out branch, not somewhere
    // incidental. There are two legitimate ones since the C-21 containment
    // merge: the deterministic keyword branch, which returns before
    // processInbound is ever reached, and the processInbound result branch.
    // Checking only the first occurrence let a correct route fail and, worse,
    // would let a second incidental call slip in unchecked.
    const ANCHORS = ["complianceFlags.includes('opt_out')", "control.kind === 'opt_out'"]
    const sites: number[] = []
    for (let at = src.indexOf('recordGlobalOptOut(db'); at !== -1; at = src.indexOf('recordGlobalOptOut(db', at + 1)) {
      sites.push(at)
    }
    expect(sites.length, 'no recordGlobalOptOut call sites found').toBeGreaterThan(0)
    for (const at of sites) {
      const before = src.slice(Math.max(0, at - 2500), at)
      expect(
        ANCHORS.some((a) => before.includes(a)),
        `recordGlobalOptOut at index ${at} is not on an opt-out branch`,
      ).toBe(true)
    }
  })
})
