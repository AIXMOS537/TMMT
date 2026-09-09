import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WEBHOOK_MISCONFIG_PREFIX, resolveTenantWebhookSecret, tenantWebhookEnvKey } from './tenant-webhook-secret'

/** T-02c: per-tenant secret lookup that reports a missing variable instead of leaking it on the wire. */
let err: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  err = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  err.mockRestore()
  vi.unstubAllEnvs()
})

describe('tenantWebhookEnvKey', () => {
  it('upper-cases the slug and turns dashes into underscores', () => {
    expect(tenantWebhookEnvKey('STRIPE_WEBHOOK_SECRET', 'acme-motors')).toBe('STRIPE_WEBHOOK_SECRET_ACME_MOTORS')
    expect(tenantWebhookEnvKey('CAL_WEBHOOK_SECRET', 'x')).toBe('CAL_WEBHOOK_SECRET_X')
  })
})

describe('resolveTenantWebhookSecret', () => {
  it('returns the configured secret and logs nothing', () => {
    vi.stubEnv('CAL_WEBHOOK_SECRET_ACME_MOTORS', 's3cret')
    expect(resolveTenantWebhookSecret('agent/cal/webhook', 'CAL_WEBHOOK_SECRET', 'acme-motors')).toBe('s3cret')
    expect(err).not.toHaveBeenCalled()
  })

  it('returns null for a missing or empty variable and logs one structured line naming the env key', () => {
    vi.stubEnv('CAL_WEBHOOK_SECRET_ACME_MOTORS', '')
    expect(resolveTenantWebhookSecret('agent/cal/webhook', 'CAL_WEBHOOK_SECRET', 'acme-motors')).toBeNull()
    expect(err).toHaveBeenCalledTimes(1)
    const line = String(err.mock.calls[0][0])
    expect(line.startsWith(WEBHOOK_MISCONFIG_PREFIX)).toBe(true)
    expect(JSON.parse(line.slice(WEBHOOK_MISCONFIG_PREFIX.length))).toEqual({
      route: 'agent/cal/webhook',
      slug: 'acme-motors',
      envKey: 'CAL_WEBHOOK_SECRET_ACME_MOTORS',
      reason: expect.stringContaining('not configured'),
    })
  })

  it('never lets the logger take the request down', () => {
    err.mockImplementation(() => { throw new Error('logger exploded') })
    expect(resolveTenantWebhookSecret('agent/stripe/webhook', 'STRIPE_WEBHOOK_SECRET', 'nope')).toBeNull()
  })
})
