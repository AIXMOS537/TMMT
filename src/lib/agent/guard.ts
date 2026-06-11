/**
 * License live-check + spend cap enforcement on every B3 entry point.
 * Spec A integration: queries organization_licenses for active state and kill_command.
 * "TMMT and AIXMOS always safe" — see docs/superpowers/specs/2026-06-09-spec-b3-ai-sales-agent-design.md §12
 */
import { createServiceSupabase } from './supabase-server'

export class LicenseDisabledError extends Error {
  constructor(public organizationId: string, public killCommand: string | null) {
    super(`License disabled for organization=${organizationId} kill=${killCommand ?? 'none'}`)
    this.name = 'LicenseDisabledError'
  }
}

export class OperationalKillError extends Error {
  constructor() {
    super('B3 operational kill-switch engaged (B3_KILL_SWITCH=1)')
    this.name = 'OperationalKillError'
  }
}

export class LlmCapExceededError extends Error {
  constructor(public organizationId: string, public spentUsd: number, public capUsd: number) {
    super(`LLM daily cap exceeded for organization=${organizationId} spent=$${spentUsd.toFixed(4)} cap=$${capUsd.toFixed(2)}`)
    this.name = 'LlmCapExceededError'
  }
}

export async function guardOrganization(organizationId: string): Promise<void> {
  if (process.env.B3_KILL_SWITCH === '1') throw new OperationalKillError()

  const db = createServiceSupabase()
  const { data } = await db
    .from('organization_licenses')
    .select('active, kill_command')
    .eq('organization_id', organizationId)
    .single()

  if (!data || !data.active || data.kill_command === 'wipe') {
    throw new LicenseDisabledError(organizationId, data?.kill_command ?? null)
  }
}

/**
 * Sum today's audit_events cost_usd entries for this org and refuse if at/over cap.
 * Today is defined as UTC midnight → now to match audit_events.created_at semantics.
 * The audit emitter writes cost_usd into payload on every `agent.llm_call` event.
 */
export async function assertLlmCapNotExceeded(
  organizationId: string,
  capUsd: number,
): Promise<{ spentUsd: number; capUsd: number; remainingUsd: number }> {
  if (!Number.isFinite(capUsd) || capUsd <= 0) {
    return { spentUsd: 0, capUsd, remainingUsd: capUsd }
  }

  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)

  const db = createServiceSupabase()
  const { data, error } = await db
    .from('audit_events')
    .select('payload')
    .eq('organization_id', organizationId)
    .eq('action', 'agent.llm_call')
    .gte('created_at', since.toISOString())

  if (error) {
    console.error('[guard.llm_cap] audit_events query failed; failing closed', error.message)
    throw new LlmCapExceededError(organizationId, 0, capUsd)
  }

  const spentUsd = (data ?? []).reduce<number>((acc, row) => {
    const raw = (row.payload as { cost_usd?: unknown } | null)?.cost_usd
    const n = typeof raw === 'number' ? raw : Number(raw)
    return acc + (Number.isFinite(n) && n > 0 ? n : 0)
  }, 0)

  if (spentUsd >= capUsd) throw new LlmCapExceededError(organizationId, spentUsd, capUsd)
  return { spentUsd, capUsd, remainingUsd: capUsd - spentUsd }
}
