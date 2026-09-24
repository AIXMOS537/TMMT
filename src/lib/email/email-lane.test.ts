/**
 * The email lane's two load-bearing promises:
 *   1. an address on the do-not-contact list is blocked;
 *   2. in draft mode, nothing leaves the process.
 *
 * Both are tested against a provider that FAILS the test if it is ever called.
 * That is the point — asserting "status === 'drafted'" would pass even if the
 * provider had also fired. The only honest way to prove nothing left is to make
 * leaving an error.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { sendEmail, emailLaneIsLive, type EmailProvider } from './send'
import { assertEmailAllowed } from './outbound-email-gate'
import { normalizeEmail } from './dnc'

/** A provider that makes any transmission a test failure. */
function tripwireProvider(): EmailProvider & { calls: number } {
  const p = {
    name: 'tripwire',
    calls: 0,
    async send() {
      p.calls += 1
      throw new Error('PROVIDER WAS CALLED — something left the process')
    },
  }
  return p as EmailProvider & { calls: number }
}

function spyProvider(): EmailProvider & { calls: number } {
  const p = {
    name: 'spy',
    calls: 0,
    async send() {
      p.calls += 1
      return { ok: true, id: 'prov_1' }
    },
  }
  return p as EmailProvider & { calls: number }
}

/** Minimal Supabase stand-in. `dncHit` decides whether the address is suppressed. */
function fakeDb(opts: { dncHit?: boolean; dncError?: string; optedOut?: boolean } = {}) {
  return {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === 'do_not_contact_emails') {
            if (opts.dncError) return { data: null, error: { message: opts.dncError } }
            return { data: opts.dncHit ? { email_norm: 'x' } : null, error: null }
          }
          if (table === 'incoming_leads') {
            return { data: opts.optedOut ? { opted_out: true } : null, error: null }
          }
          return { data: null, error: null }
        },
      }
      return chain
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

let outbox: string
const ORIGINAL = { ...process.env }

beforeEach(() => {
  outbox = mkdtempSync(join(tmpdir(), 'outbox-'))
  process.env.EMAIL_OUTBOX_DIR = outbox
  delete process.env.EMAIL_LIVE
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  rmSync(outbox, { recursive: true, force: true })
  process.env = { ...ORIGINAL }
  vi.restoreAllMocks()
})

const base = {
  to: 'Person@Example.COM',
  subject: 'hello',
  text: 'hi there',
  organizationId: 'org-a',
}

describe('normalizeEmail', () => {
  it('lowercases and trims, because one person is one person', () => {
    expect(normalizeEmail('  Bob@Example.COM ')).toBe('bob@example.com')
  })
  it('rejects anything that is not an address', () => {
    for (const bad of ['', '   ', 'bob', 'bob@', '@example.com', 'bob@example', 'a b@c.com', null, undefined]) {
      expect(normalizeEmail(bad)).toBeNull()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE FIRST PROMISE: a do-not-contact address is blocked.
// ─────────────────────────────────────────────────────────────────────────────
describe('an address on the do-not-contact list is blocked', () => {
  it('refuses to send, and never reaches the provider', async () => {
    const provider = tripwireProvider()
    const r = await sendEmail({ ...base, db: fakeDb({ dncHit: true }) }, provider)
    expect(r.status).toBe('blocked')
    expect(r.reason).toBe('dnc')
    expect(provider.calls).toBe(0)
  })

  it('does not even DRAFT a suppressed address — no queue of future violations', async () => {
    await sendEmail({ ...base, db: fakeDb({ dncHit: true }) }, tripwireProvider())
    expect(existsSync(join(outbox, 'email-outbox.jsonl'))).toBe(false)
  })

  it('blocks regardless of casing or padding on the address', async () => {
    const r = await sendEmail(
      { ...base, to: '  PERSON@EXAMPLE.com  ', db: fakeDb({ dncHit: true }) },
      tripwireProvider(),
    )
    expect(r.status).toBe('blocked')
  })

  // The silent-bleed case: the list could not be read, so nothing is known.
  it('refuses when the block list CANNOT BE READ, rather than assuming clear', async () => {
    const provider = tripwireProvider()
    const r = await sendEmail({ ...base, db: fakeDb({ dncError: 'relation does not exist' }) }, provider)
    expect(r.status).toBe('blocked')
    expect(r.reason).toBe('dnc_unverified')
    expect(provider.calls).toBe(0)
  })

  it('honours a per-lead opt-out on the email channel too', async () => {
    const r = await sendEmail({ ...base, db: fakeDb({ optedOut: true }) }, tripwireProvider())
    expect(r.status).toBe('blocked')
    expect(r.reason).toBe('opted_out')
  })

  it('refuses an address it cannot parse, since it cannot be checked', async () => {
    const r = await sendEmail({ ...base, to: 'not-an-address', db: fakeDb() }, tripwireProvider())
    expect(r.status).toBe('blocked')
    expect(r.reason).toBe('bad_address')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE SECOND PROMISE: in draft mode, nothing leaves.
// ─────────────────────────────────────────────────────────────────────────────
describe('draft mode — nothing leaves the process', () => {
  it('is the default: EMAIL_LIVE unset means draft', () => {
    expect(emailLaneIsLive()).toBe(false)
  })

  it('drafts instead of sending, and the provider is never called', async () => {
    const provider = tripwireProvider()
    const r = await sendEmail({ ...base, db: fakeDb(), ownerApproved: true }, provider)
    expect(r.status).toBe('drafted')
    expect(r.reason).toBe('not_live')
    expect(provider.calls).toBe(0)
  })

  it('writes the draft to the outbox so the work is not lost', async () => {
    await sendEmail({ ...base, db: fakeDb(), ownerApproved: true }, tripwireProvider())
    const body = readFileSync(join(outbox, 'email-outbox.jsonl'), 'utf8')
    expect(body).toContain('person@example.com')
    expect(body).toContain('hello')
  })

  it('EMAIL_LIVE=1 alone is NOT enough — owner approval is a separate switch', async () => {
    process.env.EMAIL_LIVE = '1'
    const provider = tripwireProvider()
    const r = await sendEmail({ ...base, db: fakeDb() }, provider) // no ownerApproved
    expect(r.status).toBe('drafted')
    expect(r.reason).toBe('not_approved')
    expect(provider.calls).toBe(0)
  })

  it('ownerApproved alone is NOT enough — the env switch is separate', async () => {
    const provider = tripwireProvider()
    const r = await sendEmail({ ...base, db: fakeDb(), ownerApproved: true }, provider)
    expect(r.status).toBe('drafted')
    expect(provider.calls).toBe(0)
  })

  it('a truthy-but-not-true ownerApproved does not arm it', async () => {
    process.env.EMAIL_LIVE = '1'
    const provider = tripwireProvider()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await sendEmail({ ...base, db: fakeDb(), ownerApproved: 'yes' as any }, provider)
    expect(r.status).toBe('drafted')
    expect(provider.calls).toBe(0)
  })

  // The positive control. Without this, every test above would still pass if
  // sendEmail were hard-wired to never send, and they would prove nothing.
  it('BOTH switches on DOES send — proving the tests above are not vacuous', async () => {
    process.env.EMAIL_LIVE = '1'
    const provider = spyProvider()
    const r = await sendEmail({ ...base, db: fakeDb(), ownerApproved: true }, provider)
    expect(r.status).toBe('sent')
    expect(r.providerId).toBe('prov_1')
    expect(provider.calls).toBe(1)
    expect(existsSync(join(outbox, 'email-outbox.jsonl'))).toBe(false)
  })
})

describe('quiet hours', () => {
  const nightInNY = new Date('2026-09-12T03:00:00Z') // 11pm ET
  const middayNY = new Date('2026-09-12T16:00:00Z') // 12pm ET

  it('blocks a send during local quiet hours when a phone gives us the zone', async () => {
    const d = await assertEmailAllowed({
      db: fakeDb(), email: 'a@b.com', phone: '+12025551234', now: nightInNY,
    })
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe('quiet_hours')
  })

  it('allows the same send at midday', async () => {
    const d = await assertEmailAllowed({
      db: fakeDb(), email: 'a@b.com', phone: '+12025551234', now: middayNY,
    })
    expect(d.allowed).toBe(true)
  })

  it('skips the check when no phone is known, rather than inventing a timezone', async () => {
    const d = await assertEmailAllowed({ db: fakeDb(), email: 'a@b.com', now: nightInNY })
    expect(d.allowed).toBe(true)
  })
})
