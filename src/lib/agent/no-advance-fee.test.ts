/**
 * Evidence for compliance gate `no_advance_fee_billing_enforced`
 * (shared/compliance-gates/gates.config.json; 00_START_HERE/GATE_FLIP_CHECKLIST.md row 3).
 *
 * CROA (15 U.S.C. 1679b(b)) and the Telemarketing Sales Rule forbid charging for
 * credit repair before the service is fully performed. This file proves three
 * things about the codebase as it stands, and fails if any of them stops being true:
 *
 *   1. The AI sales agent never closes a credit-adjacent sku with a payment link
 *      while the gate is closed. It books a human instead.
 *      Negative control: with the gate forced open, the same input DOES produce
 *      the payment link, so (1) is caused by the gate, not by an unreachable branch.
 *   2. No code creates a Stripe charge, checkout session, invoice, subscription
 *      or payment link without calling requireGate('no_advance_fee_billing_enforced')
 *      in the same file. Today there are none: money is taken only through GHL
 *      checkout URLs, outside this repo.
 *   3. Nothing executes the agent's `send_stripe_link` action without the gate.
 *      Today no caller dispatches it (process-inbound's actions are not acted on).
 *
 * What this does NOT prove: anything about GHL products and checkout links. Those
 * live in GoHighLevel, not here. Flipping the gate still needs the owner to confirm
 * the billing model and a licensed attorney's review.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'

const ROOT = process.cwd()

async function loadMachine(gateOpen: boolean) {
  vi.resetModules()
  vi.doMock('../../../shared/compliance-gates/gate', async (orig) => {
    const real = await orig<typeof import('../../../shared/compliance-gates/gate')>()
    return {
      ...real,
      isGateOpen: (g: Parameters<typeof real.isGateOpen>[0]) =>
        g === 'no_advance_fee_billing_enforced' ? gateOpen : real.isGateOpen(g),
    }
  })
  return import('./state-machine')
}

afterEach(() => {
  vi.doUnmock('../../../shared/compliance-gates/gate')
  vi.resetModules()
})

describe('1. agent never closes a credit-adjacent sale with a payment link', () => {
  it('the real gate is closed in the repo (flipping it is an owner + attorney act)', async () => {
    const { isGateOpen } = await import('../../../shared/compliance-gates/gate')
    expect(isGateOpen('no_advance_fee_billing_enforced')).toBe(false)
  })

  it('gate closed: a qualified intro-97 lead gets a human call, not a pay link', async () => {
    const { step, CREDIT_ADJACENT_SKUS } = await loadMachine(false)
    for (const sku of CREDIT_ADJACENT_SKUS) {
      const r = step({ state: 'QUALIFIED', sku, skuPriceCents: 9700 }, { kind: 'continue' })
      expect(r.actions.map((a) => a.kind)).toEqual(['send_cal_link'])
    }
  })

  it('negative control: gate open, the same lead WOULD get the pay link', async () => {
    const { step } = await loadMachine(true)
    const r = step({ state: 'QUALIFIED', sku: 'intro-97', skuPriceCents: 9700 }, { kind: 'continue' })
    expect(r.actions.map((a) => a.kind)).toEqual(['send_stripe_link'])
  })

  it('non-credit skus are unaffected (the fix is scoped, not "never sell")', async () => {
    const { step } = await loadMachine(false)
    const r = step({ state: 'QUALIFIED', sku: 'lead-magnet', skuPriceCents: 0 }, { kind: 'continue' })
    expect(r.actions.map((a) => a.kind)).toEqual(['send_stripe_link'])
  })
})

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) sourceFiles(p, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

const FILES = [...sourceFiles(join(ROOT, 'src')), ...sourceFiles(join(ROOT, 'shared'))]
const GATE_CALL = /requireGate\(\s*['"]no_advance_fee_billing_enforced['"]\s*\)/

describe('2. no charge path bypasses the gate', () => {
  const CHARGE =
    /\b(checkout\.sessions|paymentIntents|charges|invoices|subscriptions|paymentLinks|setupIntents)\s*\.\s*(create|pay|finalizeInvoice|confirm)\s*\(/

  it('scans a real tree (guards against a vacuous pass)', () => {
    expect(FILES.length).toBeGreaterThan(200)
  })

  it('every file that creates a Stripe charge also calls the gate', () => {
    const offenders = FILES.filter((f) => {
      const src = readFileSync(f, 'utf8')
      return CHARGE.test(src) && !GATE_CALL.test(src)
    }).map((f) => relative(ROOT, f))
    expect(offenders).toEqual([])
  })

  it('the detector itself fires on a charge call (self-test)', () => {
    expect(CHARGE.test("await stripe.checkout.sessions.create({ mode: 'payment' })")).toBe(true)
    expect(CHARGE.test('stripe.paymentLinks.create({ line_items })')).toBe(true)
    expect(CHARGE.test("new Stripe('sk').webhooks.constructEvent(b, s, k)")).toBe(false)
  })
})

describe('3. nothing dispatches the agent payment-link action without the gate', () => {
  // Files that only DECLARE the action name (types, the LLM's allowed-verbs list,
  // the persona prompt, the pure state machine). Anything else that mentions it
  // is an executor and must call the gate.
  const DECLARES = new Set([
    'src/lib/agent/state-machine.ts',
    'src/lib/agent/llm-router.ts',
    'src/lib/agent/persona/base-prompt.ts',
  ])

  it('no executor of send_stripe_link exists outside the declarations, or it calls the gate', () => {
    const offenders = FILES.map((f) => relative(ROOT, f)).filter((rel) => {
      if (DECLARES.has(rel)) return false
      const src = readFileSync(join(ROOT, rel), 'utf8')
      return /send_stripe_link/.test(src) && !GATE_CALL.test(src)
    })
    expect(offenders).toEqual([])
  })
})
