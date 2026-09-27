/**
 * Every landing page that shows a phone form must post to an org the lead
 * webhook can actually resolve.
 *
 * Background (2026-09-27): the page resolves its BRAND through aliases
 * (tmmt -> tmmt_property, moe-legacy -> aixmos_credit) but handed the raw URL
 * segment to the form, and /api/leads/webhook looks the ORG up by
 * organizations.partner_app_slug. So /lp/tmmt/*, /lp/moe-legacy/* and
 * /lp/credit/* rendered a branded page, took a phone number and SMS consent,
 * and answered every submission with 404 "org not found". The $97 button on
 * /try pointed straight at one of them.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactElement, ReactNode } from 'react'
import { describe, it, expect } from 'vitest'
import { TENANTS, TENANT_ALIASES } from '@/lib/platform/tenant-map.generated'
import LandingPage from './page'
import PhoneOnlyForm from './PhoneOnlyForm'
import { COPY } from './copy'

// organizations.partner_app_slug values with an active licence or a house org
// (licence bypass), read from production 2026-09-27. A new operator brand that
// gets a landing page must be added here only after its org row exists.
const WEBHOOK_RESOLVABLE = new Set(['aixmos', 'tmmt_property'])

function findForm(node: ReactNode): ReactElement<{ orgSlug: string }> | undefined {
  if (!node || typeof node !== 'object') return undefined
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findForm(n)
      if (hit) return hit
    }
    return undefined
  }
  const el = node as ReactElement<{ children?: ReactNode; orgSlug: string }>
  if (el.type === PhoneOnlyForm) return el
  return findForm(el.props?.children)
}

async function render(org: string, sku: string) {
  return LandingPage({
    params: Promise.resolve({ org, sku }),
    searchParams: Promise.resolve({}),
  })
}

const everyOrgSegment = [...Object.keys(TENANTS), ...Object.keys(TENANT_ALIASES)]

describe('landing page lead destination', () => {
  for (const org of everyOrgSegment) {
    for (const sku of Object.keys(COPY)) {
      it(`/lp/${org}/${sku} either 404s or posts to a resolvable org`, async () => {
        let tree: ReactNode
        try {
          tree = await render(org, sku)
        } catch (e) {
          // notFound() — no page, so no form that can eat a lead.
          expect(String((e as { digest?: string }).digest ?? e)).toMatch(/404|NOT_FOUND/)
          return
        }
        const form = findForm(tree)
        expect(form, 'page rendered without a phone form').toBeDefined()
        expect(WEBHOOK_RESOLVABLE.has(form!.props.orgSlug)).toBe(true)
      })
    }
  }

  it('the TMMT alias still has a working page (the fix is not "404 everything")', async () => {
    const form = findForm(await render('tmmt', 'lead-magnet'))
    expect(form?.props.orgSlug).toBe('tmmt_property')
  })

  it('the retired aixmos_credit brand serves no form under any alias', async () => {
    for (const org of ['moe-legacy', 'moe_legacy', 'credit', 'aixmos-credit', 'aixmos_credit']) {
      await expect(render(org, 'intro-97')).rejects.toBeDefined()
    }
  })
})

describe('/try funnel link', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/try/page.tsx'), 'utf8')

  it('points at a landing page whose org the webhook resolves', () => {
    const hrefs = [...src.matchAll(/href="\/lp\/([^/"]+)\/[^"]+"/g)].map((m) => m[1])
    expect(hrefs.length).toBeGreaterThan(0)
    for (const org of hrefs) expect(WEBHOOK_RESOLVABLE.has(org)).toBe(true)
  })

  it('does not put the fenced party name on a public page', () => {
    expect(src).not.toMatch(/moe[-_ ]?legacy/i)
  })
})
