import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { OrgIdSchema } from "./tenant";

/**
 * These tests exist to stop one specific outage coming back.
 *
 * Zod 4's .uuid() enforces the RFC 9562 version nibble. Three orgs were seeded with
 * repeated-letter placeholder ids, so on the day the dependency went 3 -> 4, every
 * lead posted for any of them started 500ing: PublicOrgRowSchema refused the row, and
 * the webhook route rethrows anything that is not OrgNotFoundError.
 *
 * The ids below were read off the live organizations table, not copied from the
 * commit that fixed this - that commit named only two of the three, and Moe Legacy
 * would have stayed broken with a green suite.
 *
 * The danger now is that the fix looks like clutter. Zod 4's own docs point you at
 * z.uuid(), so the hand-rolled regex reads as something worth tidying away - and
 * tidying it away is silent, because no fixture anywhere else uses a placeholder id.
 * The z.uuid() test below fails loudly if anyone tries.
 */

const TMMT = "8e651b25-e7c8-4356-af64-1716a82053b0";
const AIXMOS = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MOE_LEGACY = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OPERATION_OVERDRIVE = "cccccccc-cccc-cccc-cccc-cccccccccccc";

const PLACEHOLDER_ORGS: [string, string][] = [
  ["AIXMOS", AIXMOS],
  ["Moe Legacy", MOE_LEGACY],
  ["Operation Overdrive", OPERATION_OVERDRIVE],
];

describe("OrgIdSchema", () => {
  it.each(PLACEHOLDER_ORGS)("accepts the seeded %s id, which the strict check rejected", (_name, id) => {
    expect(OrgIdSchema.safeParse(id).success).toBe(true);
  });

  it("still accepts a conventional v4 org id", () => {
    expect(OrgIdSchema.safeParse(TMMT).success).toBe(true);
  });

  it.each(PLACEHOLDER_ORGS)("is not interchangeable with z.uuid() for %s", (_name, id) => {
    // If these ever go green, the strict validator has started accepting the
    // placeholders and OrgIdSchema is free to go. Until then, swapping it back
    // reintroduces the outage.
    expect(z.string().uuid().safeParse(id).success).toBe(false);
  });

  it.each([
    ["empty", ""],
    ["not a uuid at all", "aixmos"],
    ["a group missing", "aaaaaaaa-aaaa-aaaa-aaaa"],
    ["a group the wrong length", "aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"],
    ["non-hex characters", "gggggggg-aaaa-aaaa-aaaa-aaaaaaaaaaaa"],
    ["padded with whitespace", ` ${AIXMOS} `],
    ["a trailing newline", `${AIXMOS}\n`],
    ["something appended", `${AIXMOS}-extra`],
  ])("rejects %s", (_label, value) => {
    expect(OrgIdSchema.safeParse(value).success).toBe(false);
  });
});

// --- cases carried over from Carry-local commit bd2940c93 (2026-09-05) ---

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
describe('OrgIdSchema (carry-local cases)', () => {
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
