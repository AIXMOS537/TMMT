/**
 * Pure FSM for the AI sales agent.
 * NEW → CONTACTED → QUALIFIED → {BOOKED, CLOSED, LOST, HUMAN_HANDOFF}
 * No side effects; tested in isolation.
 */
export type AgentState = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'BOOKED' | 'CLOSED' | 'LOST' | 'HUMAN_HANDOFF'

export interface MachineState {
  state: AgentState
  sku?: string
  skuPriceCents?: number
}

export type AgentEvent =
  | { kind: 'lead_received'; sku: string; skuPriceCents: number }
  | { kind: 'llm_assessment'; B: number; A: number; T: number; confidence: number; next_action: string }
  | { kind: 'continue' }
  | { kind: 'opt_out' }
  | { kind: 'escalate'; reason: string }
  | { kind: 'stripe_paid' }
  | { kind: 'cal_booked' }
  | { kind: 'timeout_no_response' }

export type AgentAction =
  | { kind: 'send_first_message' }
  | { kind: 'send_stripe_link' }
  | { kind: 'send_cal_link' }
  | { kind: 'send_opt_out_reply' }
  | { kind: 'notify_human'; reason: string }

export interface StepResult {
  state: AgentState
  sku?: string
  skuPriceCents?: number
  actions: AgentAction[]
}

const QUALIFIED_BAT_THRESHOLD = 2.0
const QUALIFIED_CONFIDENCE_THRESHOLD = 0.6
const HUMAN_PRICE_THRESHOLD_CENTS = 9700  // $97 — below this, agent closes; above, books call

export function step(prev: MachineState, evt: AgentEvent): StepResult {
  // Terminal-overriding events apply at any state
  switch (evt.kind) {
    case 'opt_out':
      return { state: 'LOST', sku: prev.sku, skuPriceCents: prev.skuPriceCents, actions: [{ kind: 'send_opt_out_reply' }] }
    case 'escalate':
      return { state: 'HUMAN_HANDOFF', sku: prev.sku, skuPriceCents: prev.skuPriceCents, actions: [{ kind: 'notify_human', reason: evt.reason }] }
    case 'stripe_paid':
      return { state: 'CLOSED', sku: prev.sku, skuPriceCents: prev.skuPriceCents, actions: [] }
    case 'cal_booked':
      return { state: 'BOOKED', sku: prev.sku, skuPriceCents: prev.skuPriceCents, actions: [] }
    case 'timeout_no_response':
      return { state: 'LOST', sku: prev.sku, skuPriceCents: prev.skuPriceCents, actions: [] }
  }

  // Regular flow
  if (prev.state === 'NEW' && evt.kind === 'lead_received') {
    return {
      state: 'CONTACTED',
      sku: evt.sku,
      skuPriceCents: evt.skuPriceCents,
      actions: [{ kind: 'send_first_message' }],
    }
  }

  if (prev.state === 'CONTACTED' && evt.kind === 'llm_assessment') {
    const score = evt.B + evt.A + evt.T
    if (score >= QUALIFIED_BAT_THRESHOLD && evt.confidence >= QUALIFIED_CONFIDENCE_THRESHOLD) {
      return { state: 'QUALIFIED', sku: prev.sku, skuPriceCents: prev.skuPriceCents, actions: [] }
    }
    return { state: 'CONTACTED', sku: prev.sku, skuPriceCents: prev.skuPriceCents, actions: [] }
  }

  if (prev.state === 'QUALIFIED' && evt.kind === 'continue') {
    const price = prev.skuPriceCents ?? 0
    const action: AgentAction = price <= HUMAN_PRICE_THRESHOLD_CENTS
      ? { kind: 'send_stripe_link' }
      : { kind: 'send_cal_link' }
    return { state: 'QUALIFIED', sku: prev.sku, skuPriceCents: price, actions: [action] }
  }

  // No transition
  return { state: prev.state, sku: prev.sku, skuPriceCents: prev.skuPriceCents, actions: [] }
}
