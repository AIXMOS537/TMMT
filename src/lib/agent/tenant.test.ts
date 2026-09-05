import { describe, it, expect, vi } from 'vitest'

// tenant.ts imports the service Supabase client at module load. The schema
// itself needs no database, so stub the module rather than requiring env vars.
vi.mock('./supabase-server', () => ({ createServiceSupabase: () => ({}) }))

const { OrgIdSchema } = await import('./tenant')

/**
 * Regression cover for the 2026-09-01 lead-intake outage.
 *
 * Three orgs were seeded with placeholder ids — aaaaaaaa-…, bbbbbbbb-…,
 * cccccccc-… . Postgres stores them happily as `uuid`, but Zod 4's `.uuid()`
 * enforces the RFC 9562 version nibble (the 13th hex digit must be 1-8) and the
 * variant nibble, so it rejected all three. Every lead posted for AIXMOS then
 * 500'd with OrgRowShapeError — 184 of them — while the forms still returned
 * 200 to the visitor. Fixed in e57e22ea9 by keeping the shape check and
 * dropping the version demand.
 *
 * These ids are real rows in production. If someone reaches for `z.uuid()`
 * here again, this test fails instead of the lead webhook.
 */
describe('OrgIdSchema', () => {
  const seededPlaceholders = [
    ['AIXMOS', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
    ['Moe Legacy', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'],
    ['Operation Overdrive', 'cccccccc-cccc-cccc-cccc-cccccccccccc'],
  ] as const

  it.each(seededPlaceholders)(
    'accepts the placeholder id that production actually holds for %s',
    (_name, id) => {
      expect(OrgIdSchema.safeParse(id).success).toBe(true)
    },
  )

  const realIds = [
    ['TMMT RENTALS', '8e651b25-e7c8-4356-af64-1716a82053b0'],
    ['Khan Strategies LLC', '370cd891-f6c0-4fcc-a36a-bc25f27ca229'],
    ['Isaac Scott — DMV', '1fdb2b59-4992-4934-9296-6677087c6f2b'],
  ] as const

  it.each(realIds)('accepts the generated uuid for %s', (_name, id) => {
    expect(OrgIdSchema.safeParse(id).success).toBe(true)
  })

  it('still rejects anything that is not uuid-shaped', () => {
    for (const bad of [
      'aixmos', // the tenant-map slug — never a valid org id
      'tmmt_property',
      '',
      'aaaaaaaa-aaaa-aaaa-aaaa', // too short
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaaaa', // too long
      'gggggggg-gggg-gggg-gggg-gggggggggggg', // not hex
      '8e651b25e7c84356af641716a82053b0', // unhyphenated
    ]) {
      expect(OrgIdSchema.safeParse(bad).success, `expected "${bad}" to be rejected`).toBe(false)
    }
  })
})
