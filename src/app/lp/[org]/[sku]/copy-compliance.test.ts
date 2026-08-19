/**
 * Guards paid-ad landing copy against the claim types that draw CROA / FTC /
 * A2P 10DLC attention on a credit product.
 *
 * Background: this file exists because the live intro-97 page shipped "Average
 * client adds 47 points in 90 days" next to a $97 advance fee and an SMS capture
 * — a quantified score promise, an unsubstantiated volume claim, and a price
 * anchor, all on the same page. These assertions fail if any of them return.
 *
 * We deliberately do NOT route this copy through lib/compliance's
 * enforceCompliance(): it rewrites "credit repair" -> "credit guidance", which
 * would invert the disclosure "not credit repair" into a false statement.
 */
import { describe, it, expect } from 'vitest'
import { COPY, ORG_BRAND } from './copy'

/** Every customer-visible string, flattened with a label for failure messages. */
function allStrings(): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = []
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
  it('makes no quantified credit-score claim', () => {
    // "adds 47 points", "47 point jump", "+47 pts", "raise your score 100"
    const scoreClaim = /\d+\s*(?:\+\s*)?(?:point|pt)s?\b|\bscore\b[^.]{0,20}\b\d{2,3}\b/i
    for (const { where, text } of allStrings()) {
      expect(scoreClaim.test(text), `${where}: quantified score claim -> "${text}"`).toBe(false)
    }
  })

  it('makes no unsubstantiated volume or social-proof count', () => {
    // "12,000+ downloaded", "5000+ clients", "join 900 members"
    const volumeClaim = /\b\d[\d,]{2,}\s*\+?\s*(?:client|customer|member|student|operator|download|playbook|user|people)/i
    for (const { where, text } of allStrings()) {
      expect(volumeClaim.test(text), `${where}: unsubstantiated volume claim -> "${text}"`).toBe(false)
    }
  })

  it('makes no competitor or anchor price claim', () => {
    // "$7K+ elsewhere", "others charge $5,000" — anchors invite substantiation demands.
    const anchor = /\$\s?\d[\d,]*\s?[Kk]?\s?\+/
    for (const { where, text } of allStrings()) {
      expect(anchor.test(text), `${where}: price anchor claim -> "${text}"`).toBe(false)
    }
  })

  it('never promises or guarantees an outcome', () => {
    const promise = /\b(guarantee\w*|promise\w*|assured|certain to|will (?:get|receive|be approved|raise|boost))\b/i
    for (const { where, text } of allStrings()) {
      // A negated disclosure ("No score change is promised or guaranteed") is the
      // one legitimate use, so only flag promises that are not negated.
      const negated = /\b(no|not|never|without)\b[^.]{0,60}\b(guarantee|promise)/i.test(text)
      if (negated) continue
      expect(promise.test(text), `${where}: outcome promise -> "${text}"`).toBe(false)
    }
  })

  it('never offers credit repair as a service we perform', () => {
    for (const { where, text } of allStrings()) {
      const mentionsRepair = /\bcredit repair\b|\b(?:fix|repair)(?:ing)? your credit\b/i.test(text)
      if (!mentionsRepair) continue
      // Mentioning it to disclaim it is required; offering it is not allowed.
      const disclaimed = /\b(?:not|no|never|isn't|is not)\b[^.]{0,40}\bcredit repair\b/i.test(text)
      expect(disclaimed, `${where}: offers credit repair without disclaiming -> "${text}"`).toBe(true)
    }
  })

  it('keeps the paid credit SKU carrying its not-credit-repair disclosure', () => {
    // intro-97 takes money on a credit product; it must state the limit of service.
    const proof = COPY['intro-97']?.proof ?? ''
    expect(proof).toMatch(/not credit repair/i)
    expect(proof).toMatch(/\b(?:no|not)\b[^.]{0,40}(?:promised|guaranteed)/i)
  })
})
