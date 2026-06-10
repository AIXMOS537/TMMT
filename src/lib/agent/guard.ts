/**
 * License live-check called on every B3 entry point.
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
