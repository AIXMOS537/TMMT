/**
 * Guards paid-ad landing copy against the claim types that draw CROA / FTC /
 * A2P 10DLC attention on a credit product.
 *
 * Background: this file exists because the live intro-97 page shipped "Average
 * client adds 47 points in 90 days" next to a $97 advance fee and an SMS capture
 * — a quantified score promise, an unsubstantiated volume claim, and a price
 * anchor, all on the same page. These assertions fail if any of them return.
 *
 * The rules themselves now live in lib/claim-rules, shared with the public
 * front door at /welcome, so the two cannot drift apart.
 *
 * We deliberately do NOT route this copy through lib/compliance's
 * enforceCompliance(): it rewrites "credit repair" -> "credit guidance", which
 * would invert the disclosure "not credit repair" into a false statement.
 */
import { describe, it, expect } from 'vitest'
import { findClaimViolations, formatClaimViolations, type Claim } from '@/lib/claim-rules'
import { COPY, ORG_BRAND } from './copy'

/** Every customer-visible string, flattened with a label for failure messages. */
function allStrings(): Claim[] {
  const out: Claim[] = []
  for (const [sku, c] of Object.entries(COPY)) {
    out.push({ where: `${sku}.headline`, text: c.headline })
    out.push({ where: `${sku}.subhead`, text: c.subhead })
    out.push({ where: `${sku}.cta`, text: c.cta })
    if (c.proof) out.push({ where: `${sku}.proof`, text: c.proof })
    c.bullets.forEach((b, i) => out.push({ where: `${sku}.bullets[${i}]`, text: b }))
  }
  for (const [org, b] of Object.entries(ORG_BRAND)) {
    out.push({ where: `${org}.name`, text: b.name })
    out.push({ where: `${org}.tagline`, text: b.tagline })
  }
  return out
}

describe('landing copy compliance', () => {
  it('makes no score, volume, anchor, promise or credit-repair claim', () => {
    const violations = findClaimViolations(allStrings())
    expect(violations, `\n${formatClaimViolations(violations)}\n`).toEqual([])
  })

  it('keeps the paid credit SKU carrying its not-credit-repair disclosure', () => {
    // intro-97 takes money on a credit product; it must state the limit of service.
    const proof = COPY['intro-97']?.proof ?? ''
    expect(proof).toMatch(/not credit repair/i)
    expect(proof).toMatch(/\b(?:no|not)\b[^.]{0,40}(?:promised|guaranteed)/i)
  })
})
