/**
 * The B3 orchestrator. Called from /api/agent/sms/inbound.
 * Composes: guard → opt-out → quiet-hours → LLM (with regen) → CFPB disclaimers → FSM → audit.
 * See spec at docs/superpowers/specs/2026-06-09-spec-b3-ai-sales-agent-design.md
 */
import { guardOrganization, assertLlmCapNotExceeded } from './guard'
import type { OrgContext } from './tenant'
import { type AgentState, step } from './state-machine'
import { callAgent, pickModel } from './llm-router'
import { buildSystemPrompt } from './persona/tenant-overlay'
import { isOptOutMessage, optOutAutoReply } from './compliance/opt-out'
import { isQuietHours } from './compliance/quiet-hours'
import { applyDisclaimers, hasBlockingPhrase } from './compliance/disclaimers'
import { findBannedPhrases } from './compliance/banned-phrases'
import { emitAudit } from './audit'
import { createServiceRoleClient } from '@/lib/supabase-service'
import { recordMoneyEventSafe } from '@/lib/money-meter'

export interface ProcessInboundArgs {
  org: OrgContext
  prevState: AgentState
  sku?: string
  skuPriceCents?: number
  inboundBody: string
  phone: string
  channel?: 'sms' | 'voice'
  recentMessages: Array<{ direction: 'in' | 'out'; body: string }>
}

export interface ProcessInboundResult {
  newState: AgentState
  outboundBody: string | null
  complianceFlags: string[]
  actions: Array<{ kind: string }>
  llmAssessment?: { B: number; A: number; T: number; confidence: number }
  llmCostUsd?: number
  quietHoursDeferred?: boolean
}

const SAFE_FALLBACK = 'Thanks for reaching out — could you tell me more about what you’re looking for?'

export async function processInbound(args: ProcessInboundArgs): Promise<ProcessInboundResult> {
  // 1. Opt-out short-circuit, BEFORE the licence / kill-switch / spend-cap
  //    guards: an explicit opt-out keyword must never depend on them, and it
  //    never reaches the LLM. The SMS route already handles this ahead of
  //    processInbound (communication-control.ts); this keeps any other caller
  //    (the GHL voice summary) from routing a STOP through the guards.
  if (isOptOutMessage(args.inboundBody)) {
    await emitAudit({
      organizationId: args.org.id,
      action: 'compliance.opt_out_received',
      payload: { phone: args.phone }
    })
    return {
      newState: 'LOST',
      outboundBody: optOutAutoReply(),
      complianceFlags: ['opt_out'],
      actions: [{ kind: 'send_opt_out_reply' }],
    }
  }

  await guardOrganization(args.org.id)
  await assertLlmCapNotExceeded(args.org.id, args.org.llmDailyCapUsd)

  // 2. LLM with banned-phrase regen
  const overlay = (args.org.agentPersonaOverlay ?? {}) as { forbidden_phrases?: string[] }
  const banList: string[] = overlay.forbidden_phrases ?? []
  const systemPrompt = buildSystemPrompt(args.org, {
    currentState: args.prevState,
    sku: args.sku,
    channel: args.channel,
    lastTurns: args.recentMessages,
  })

  let llmResult: Awaited<ReturnType<typeof callAgent>> | null = null
  let outBody = ''
  const flags: string[] = []
  let regenAttempts = 0
  // Cloud spend accrues across EVERY attempt — each banned-phrase regeneration is
  // a real billed call, not just the final one. The money meter books the total.
  let llmCostAccruedUsd = 0
  let llmCalls = 0

  while (regenAttempts <= 2) {
    try {
      llmResult = await callAgent({
        systemPrompt,
        userMessage: args.inboundBody,
        model: pickModel('qualify'),
      })
      llmCostAccruedUsd += llmResult.costUsd
      llmCalls += 1
    } catch {
      // LLM schema failure exhausted retries — fall back safely
      outBody = SAFE_FALLBACK
      flags.push('llm_fallback_used')
      llmResult = null
      break
    }
    outBody = llmResult.parsed.message
    const hits = findBannedPhrases(outBody, banList)
    const blocking = hasBlockingPhrase(outBody)
    if (hits.length === 0 && !blocking) break
    if (hits.length) flags.push('banned_phrase_regenerated')
    if (blocking) flags.push('cfpb_blocking_phrase_regenerated')
    regenAttempts++
  }
  if (regenAttempts > 0 && llmResult) flags.push('regenerated')
  if (regenAttempts > 2) { outBody = SAFE_FALLBACK; flags.push('regen_exhausted_fallback') }

  // 3. CFPB disclaimers
  const disclaimed = applyDisclaimers(outBody)
  outBody = disclaimed.body
  flags.push(...disclaimed.flags)

  // 4. State transition
  let nextState: AgentState = args.prevState
  let actions: Array<{ kind: string }> = []
  if (llmResult?.parsed.next_action === 'escalate_human') {
    const r = step(
      { state: args.prevState, sku: args.sku, skuPriceCents: args.skuPriceCents },
      { kind: 'escalate', reason: 'llm_decided_escalate' }
    )
    nextState = r.state
    actions = r.actions
  } else if (llmResult) {
    const a = llmResult.parsed.assessment
    const r = step(
      { state: args.prevState, sku: args.sku, skuPriceCents: args.skuPriceCents },
      { kind: 'llm_assessment', B: a.B, A: a.A, T: a.T, confidence: a.confidence, next_action: llmResult.parsed.next_action }
    )
    nextState = r.state
    actions = r.actions
    if (nextState === 'QUALIFIED') {
      const r2 = step(
        { state: 'QUALIFIED', sku: args.sku, skuPriceCents: args.skuPriceCents },
        { kind: 'continue' }
      )
      actions = [...actions, ...r2.actions]
    }
  }

  // 5. Audit the LLM call (cost tracking)
  await emitAudit({
    organizationId: args.org.id,
    action: 'agent.llm_call',
    payload: {
      model: llmResult?.model,
      cost_usd: llmResult?.costUsd,
      regen_attempts: regenAttempts,
      input_tokens: llmResult?.inputTokens,
      output_tokens: llmResult?.outputTokens,
    }
  })

  // 5a. Money meter: book the real cloud LLM spend as money USED — the TOTAL
  // across all regen attempts, not just the final call. Free-forever orgs (owner
  // + family) are stamped non-billable by the DB. Best-effort so a metering
  // hiccup never breaks the SMS reply path.
  if (llmCostAccruedUsd > 0) {
    await recordMoneyEventSafe(createServiceRoleClient(), {
      orgId: args.org.id,
      direction: 'used',
      category: 'ai_llm',
      amountUsd: llmCostAccruedUsd,
      source: 'sms-agent',
      meta: {
        model: llmResult?.model,
        llm_calls: llmCalls,
        regen_attempts: regenAttempts,
      },
    })
  }

  // 5b. BAT-outlier audit. A jailbroken LLM coerced into returning all-max
  // confidence (B+A+T ≈ 3, confidence ≈ 1) is the signature pattern for
  // bypassing the QUALIFIED threshold. We don't block — legitimate hot
  // leads can hit this — but we audit so a sustained pattern is
  // diagnosable. Threshold is the 95th-percentile combo.
  if (
    llmResult &&
    nextState === 'QUALIFIED' &&
    llmResult.parsed.assessment.B + llmResult.parsed.assessment.A + llmResult.parsed.assessment.T >= 2.85 &&
    llmResult.parsed.assessment.confidence >= 0.95
  ) {
    await emitAudit({
      organizationId: args.org.id,
      action: 'agent.bat_outlier',
      payload: {
        assessment: llmResult.parsed.assessment,
        next_action: llmResult.parsed.next_action,
        model: llmResult.model,
        inbound_preview: args.inboundBody.slice(0, 200),
      }
    })
  }

  // 6. Quiet hours guard for outbound
  const quiet = isQuietHours(args.phone)

  return {
    newState: nextState,
    outboundBody: quiet ? null : outBody,
    complianceFlags: flags,
    actions,
    llmAssessment: llmResult?.parsed.assessment,
    llmCostUsd: llmResult?.costUsd,
    quietHoursDeferred: quiet,
  }
}
