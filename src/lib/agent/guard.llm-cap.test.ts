import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFakeSupabase, type FakeDbCall, type FakeSupabase } from '@/lib/testing/fake-supabase'
import { AUDIT_EVENTS_COLUMNS } from './audit-events-columns'

/**
 * `assertLlmCapNotExceeded` filtered `.gte('created_at', ...)`. audit_events
 * has no created_at, so production answered 42703 on every call and the cap
 * FAILED CLOSED: every inbound SMS LLM call was refused with
 * LlmCapExceededError. guard.test.ts mocks the client with a shape that never
 * looks at column names, so nothing caught it.
 *
 * `strictAuditEvents` does what PostgREST does: a column outside
 * AUDIT_EVENTS_COLUMNS gets 42703. With the old filter every test below that
 * expects the call to be allowed fails.
 */
let db: FakeSupabase
vi.mock('@/lib/supabase-service', () => ({ createServiceRoleClient: () => db }))

const ORG = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

type Row = { ts: string; organization_id: string; action: string; payload: Record<string, unknown> }

const known = new Set<string>(AUDIT_EVENTS_COLUMNS)

function unknownColumn(call: FakeDbCall): string | undefined {
  const selected = (call.columns ?? '*').split(',').map((c) => c.trim()).filter((c) => c && c !== '*')
  const filtered = call.filters.filter(([m]) => m !== 'limit' && m !== 'range').map(([, col]) => String(col))
  return [...selected, ...filtered].map((c) => c.split('->')[0].trim()).find((c) => !known.has(c))
}

function strictAuditEvents(rows: Row[]): FakeSupabase {
  return makeFakeSupabase((call) => {
    if (call.table !== 'audit_events') return undefined
    const bad = unknownColumn(call)
    if (bad) return { error: { code: '42703', message: `column audit_events.${bad} does not exist` } }
    const data = rows
      .filter((r) =>
        call.filters.every(([m, col, value]) => {
          const v = (r as Record<string, unknown>)[String(col)]
          if (m === 'eq') return v === value
          if (m === 'gte') return String(v) >= String(value)
          return true
        }),
      )
      .map((r) => ({ payload: r.payload }))
    return { data }
  })
}

const now = () => new Date().toISOString()
const yesterday = () => new Date(Date.now() - 36 * 3600 * 1000).toISOString()
const llmCall = (cost: unknown, over: Partial<Row> = {}): Row => ({
  ts: now(),
  organization_id: ORG,
  action: 'agent.llm_call',
  payload: { cost_usd: cost },
  ...over,
})

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('assertLlmCapNotExceeded against the real audit_events columns', () => {
  it('names only columns audit_events has, and filters the day on ts', async () => {
    db = strictAuditEvents([])
    const { assertLlmCapNotExceeded } = await import('./guard')
    await assertLlmCapNotExceeded(ORG, 50)

    const [call] = db.calls
    expect(call.table).toBe('audit_events')
    expect(unknownColumn(call)).toBeUndefined()
    const day = call.filters.find(([m]) => m === 'gte')
    expect(day?.[1]).toBe('ts')
    expect(String(day?.[2])).toMatch(/T00:00:00\.000Z$/)
  })

  it('lets an org with no spend today through (was: 42703, failed closed, refused)', async () => {
    db = strictAuditEvents([])
    const { assertLlmCapNotExceeded } = await import('./guard')
    await expect(assertLlmCapNotExceeded(ORG, 50)).resolves.toEqual({ spentUsd: 0, capUsd: 50, remainingUsd: 50 })
  })

  it("sums only today's agent.llm_call cost for this org", async () => {
    db = strictAuditEvents([
      llmCall(1.25),
      llmCall('0.75'),
      llmCall(100, { ts: yesterday() }),
      llmCall(100, { organization_id: OTHER }),
      llmCall(100, { action: 'agent.bat_outlier' }),
      llmCall(undefined),
      llmCall(-5),
    ])
    const { assertLlmCapNotExceeded } = await import('./guard')
    await expect(assertLlmCapNotExceeded(ORG, 50)).resolves.toEqual({ spentUsd: 2, capUsd: 50, remainingUsd: 48 })
  })

  it('refuses once today’s spend reaches the cap', async () => {
    db = strictAuditEvents([llmCall(30), llmCall(20)])
    const { assertLlmCapNotExceeded, LlmCapExceededError } = await import('./guard')
    const err = await assertLlmCapNotExceeded(ORG, 50).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LlmCapExceededError)
    expect(err).toMatchObject({ spentUsd: 50, capUsd: 50 })
  })

  it('still fails closed when the query errors', async () => {
    db = makeFakeSupabase((call) =>
      call.table === 'audit_events' ? { error: { code: '42703', message: 'column audit_events.ts does not exist' } } : undefined)
    const { assertLlmCapNotExceeded, LlmCapExceededError } = await import('./guard')
    await expect(assertLlmCapNotExceeded(ORG, 50)).rejects.toBeInstanceOf(LlmCapExceededError)
  })

  it('does not query at all when the cap is 0 or unset (no cap)', async () => {
    db = strictAuditEvents([llmCall(1000)])
    const { assertLlmCapNotExceeded } = await import('./guard')
    await expect(assertLlmCapNotExceeded(ORG, 0)).resolves.toMatchObject({ spentUsd: 0 })
    await expect(assertLlmCapNotExceeded(ORG, Number.NaN)).resolves.toMatchObject({ spentUsd: 0 })
    expect(db.calls).toHaveLength(0)
  })
})
