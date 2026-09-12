import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkConsent, consentMode } from '@/lib/consent'

function fakeDb(row: { consent_source: string | null; consent_at: string | null } | null, err?: string) {
  return {
    from() {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.eq = () => chain
      chain.limit = () => chain
      chain.maybeSingle = async () => (err ? { data: null, error: { message: err } } : { data: row, error: null })
      return chain
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

const ORG = 'org-1'
const PHONE = '+17035550100'
const consented = { consent_source: 'web_form', consent_at: '2026-09-01T00:00:00Z' }

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => vi.restoreAllMocks())

describe('mode selection', () => {
  it('defaults to shadow when unset — measure, do not silently break or silently skip', () => {
    expect(consentMode(undefined)).toBe('shadow')
    expect(consentMode('')).toBe('shadow')
    expect(consentMode('nonsense')).toBe('shadow')
  })
  it('honours off and enforce', () => {
    expect(consentMode('off')).toBe('off')
    expect(consentMode('ENFORCE')).toBe('enforce')
  })
})

describe('shadow mode — the default', () => {
  it('ALLOWS a contact with no consent record, but flags it', async () => {
    const d = await checkConsent(fakeDb(null), { organizationId: ORG, phone: PHONE, mode: 'shadow' })
    expect(d.allowed).toBe(true)
    expect(d.hasConsent).toBe(false)
    expect(d.flags).toContain('consent_missing_shadow')
  })

  // The whole point: allowed and hasConsent must be separately readable, or the
  // shadow measurement is indistinguishable from a pass.
  it('keeps allowed and hasConsent as separate answers', async () => {
    const d = await checkConsent(fakeDb(null), { organizationId: ORG, phone: PHONE, mode: 'shadow' })
    expect(d.allowed).not.toBe(d.hasConsent)
  })

  it('reports a real consent record as consented', async () => {
    const d = await checkConsent(fakeDb(consented), { organizationId: ORG, phone: PHONE, mode: 'shadow' })
    expect(d.hasConsent).toBe(true)
    expect(d.flags).toContain('consent_ok')
  })
})

describe('enforce mode', () => {
  it('blocks a contact with no consent record', async () => {
    const d = await checkConsent(fakeDb(null), { organizationId: ORG, phone: PHONE, mode: 'enforce' })
    expect(d.allowed).toBe(false)
    expect(d.flags).toContain('consent_missing')
  })

  it('allows a contact that has one', async () => {
    const d = await checkConsent(fakeDb(consented), { organizationId: ORG, phone: PHONE, mode: 'enforce' })
    expect(d.allowed).toBe(true)
  })

  it('treats a half-written record as no record', async () => {
    for (const row of [
      { consent_source: 'web_form', consent_at: null },
      { consent_source: null, consent_at: '2026-09-01T00:00:00Z' },
    ]) {
      const d = await checkConsent(fakeDb(row), { organizationId: ORG, phone: PHONE, mode: 'enforce' })
      expect(d.hasConsent).toBe(false)
      expect(d.allowed).toBe(false)
    }
  })

  // A check that could not run has not passed.
  it('blocks when the lookup fails, rather than assuming consent', async () => {
    const d = await checkConsent(fakeDb(null, 'column does not exist'), {
      organizationId: ORG, phone: PHONE, mode: 'enforce',
    })
    expect(d.allowed).toBe(false)
    expect(d.flags).toContain('consent_unverified')
  })

  it('blocks when there is no org or phone to check against', async () => {
    expect((await checkConsent(fakeDb(null), { phone: PHONE, mode: 'enforce' })).allowed).toBe(false)
    expect((await checkConsent(fakeDb(null), { organizationId: ORG, mode: 'enforce' })).allowed).toBe(false)
  })
})

describe('off mode', () => {
  it('allows everything and says so plainly, rather than pretending to check', async () => {
    const d = await checkConsent(fakeDb(null), { organizationId: ORG, phone: PHONE, mode: 'off' })
    expect(d.allowed).toBe(true)
    expect(d.flags).toContain('consent_check_off')
  })
})

describe('the staged migration does not manufacture consent', () => {
  const sql = require('node:fs').readFileSync(
    require('node:path').join(process.cwd(),
      'supabase/migrations/_staged/20260911234500_lead_consent_record_STAGED.sql'), 'utf8')

  it('adds the columns', () => {
    expect(sql).toContain('consent_source')
    expect(sql).toContain('consent_at')
  })

  // Backfilling consent_source from source='form' would invent a consent record
  // for 63 people based on a guess about what that form said at the time.
  it('contains no UPDATE that backfills consent from a guess', () => {
    expect(sql.toLowerCase()).not.toMatch(/update\s+public\.incoming_leads\s+set\s+consent/)
  })

  it('constrains consent_source to known capture methods', () => {
    expect(sql).toContain('web_form')
    expect(sql).toContain('sms_double_optin')
    expect(sql).toContain('CHECK')
  })
})
