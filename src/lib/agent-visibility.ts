/**
 * "See it, stop it" — what is running for a client, and their own stop button.
 *
 * The promise this makes concrete: a customer can look at the agents acting on
 * their behalf and switch them off themselves, without emailing anyone and
 * without waiting for us. That is the whole difference between an agent fleet
 * you rent and one you own, and it is worth more on a trust page than any
 * amount of copy about safety.
 *
 * It is wired to the EXISTING kill switch, not a parallel one. `guardOrganization()`
 * already refuses every agent action when `organization_licenses.active` is false
 * or `kill_command` is set, so flipping those columns stops work at the real
 * choke point rather than hiding a second switch that could drift out of sync.
 *
 * THREE THINGS THIS WILL NOT DO:
 *
 *  1. It never writes `kill_command = 'wipe'`. In guard.ts `wipe` is terminal —
 *     it means destroy the install. A customer clicking "pause" must never be
 *     one typo away from that. `pause` and `wipe` are different words here on
 *     purpose and only one of them is reachable from this file.
 *  2. It refuses to touch an `internal_protected` org. Those are ours.
 *  3. It only ever acts on the caller's OWN organization. The org id comes from
 *     the signed-in profile, never from the request.
 *
 * Pausing is fully reversible — resume() puts it straight back — which is why a
 * client can be trusted with the button in the first place.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/** What guard.ts understands. 'wipe' is deliberately absent from this union. */
export type ClientKillCommand = 'pause'

export type AgentSummary = {
  /** Module key as stored in organization_licenses.modules. */
  key: string
  label: string
  description: string
}

export type AgentFleetView = {
  running: boolean
  paused: boolean
  /** True when this org may not be paused from the client surface. */
  protectedOrg: boolean
  tier: string | null
  agents: AgentSummary[]
  lastHeartbeatAt: string | null
}

/**
 * Plain-English names for the module keys. A client should never be shown a raw
 * key like `sms_agent`. An unknown key is rendered with a readable fallback
 * rather than hidden — hiding something that IS running would make this view a
 * lie, which is the one thing it cannot be.
 */
const MODULE_LABELS: Record<string, { label: string; description: string }> = {
  sms_agent: { label: 'Text assistant', description: 'Answers texts and books work.' },
  voice_agent: { label: 'Phone assistant', description: 'Answers calls and takes bookings.' },
  intake_forms: { label: 'Website forms', description: 'Takes enquiries from your site.' },
  booking: { label: 'Booking', description: 'Puts jobs on the calendar.' },
  followups: { label: 'Follow-ups', description: 'Chases people who did not reply.' },
  reviews: { label: 'Review requests', description: 'Asks happy customers for a review.' },
  reporting: { label: 'Reporting', description: 'Keeps your numbers up to date.' },
  rentals_app: { label: 'Rentals', description: 'Runs the rental side of the business.' },
}

export function describeModule(key: string): AgentSummary {
  const known = MODULE_LABELS[key]
  if (known) return { key, ...known }
  // Readable, and honest that we do not have a friendly name for it yet.
  return {
    key,
    label: key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: 'Running on your account.',
  }
}

/**
 * What is running for this org.
 *
 * `db` should be the RLS-respecting client so a client can only ever read their
 * own row. Returns null when there is no license row — rendered as the honest
 * empty state, not as an error and not as "everything is fine".
 */
export async function getAgentFleet(db: SupabaseClient): Promise<AgentFleetView | null> {
  const { data, error } = await db
    .from('organization_licenses')
    .select('license_tier, modules, active, kill_command, internal_protected, last_heartbeat_at')
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  const row = data as {
    license_tier: string | null
    modules: string[] | null
    active: boolean
    kill_command: string | null
    internal_protected: boolean
    last_heartbeat_at: string | null
  }

  const paused = !row.active || Boolean(row.kill_command)
  return {
    running: !paused,
    paused,
    protectedOrg: Boolean(row.internal_protected),
    tier: row.license_tier ?? null,
    agents: (row.modules ?? []).map(describeModule),
    lastHeartbeatAt: row.last_heartbeat_at ?? null,
  }
}

export type PauseResult = { ok: boolean; reason?: 'protected' | 'not_found' | 'write_failed' }

/**
 * Stop everything for one org.
 *
 * `organizationId` MUST come from the signed-in profile, never from the request
 * body — otherwise this is a button that pauses other people's businesses.
 */
export async function pauseOrgAgents(
  db: SupabaseClient,
  organizationId: string,
): Promise<PauseResult> {
  const { data: lic, error: readErr } = await db
    .from('organization_licenses')
    .select('internal_protected')
    .eq('organization_id', organizationId)
    .limit(1)
    .maybeSingle()

  if (readErr || !lic) return { ok: false, reason: 'not_found' }
  if ((lic as { internal_protected: boolean }).internal_protected) {
    return { ok: false, reason: 'protected' }
  }

  const command: ClientKillCommand = 'pause'
  const { error } = await db
    .from('organization_licenses')
    .update({ active: false, kill_command: command, updated_at: new Date().toISOString() })
    .eq('organization_id', organizationId)

  if (error) {
    console.error('[agent-visibility] pause failed:', organizationId, error.message)
    return { ok: false, reason: 'write_failed' }
  }
  return { ok: true }
}

/**
 * Start everything again.
 *
 * Only ever clears a `pause`. If `kill_command` holds anything else — `wipe`,
 * or something a future version writes — this refuses, because those were not
 * set by the client and must not be cleared by the client.
 */
export async function resumeOrgAgents(
  db: SupabaseClient,
  organizationId: string,
): Promise<PauseResult> {
  const { data: lic, error: readErr } = await db
    .from('organization_licenses')
    .select('internal_protected, kill_command')
    .eq('organization_id', organizationId)
    .limit(1)
    .maybeSingle()

  if (readErr || !lic) return { ok: false, reason: 'not_found' }
  const row = lic as { internal_protected: boolean; kill_command: string | null }
  if (row.internal_protected) return { ok: false, reason: 'protected' }
  if (row.kill_command && row.kill_command !== 'pause') return { ok: false, reason: 'protected' }

  const { error } = await db
    .from('organization_licenses')
    .update({ active: true, kill_command: null, updated_at: new Date().toISOString() })
    .eq('organization_id', organizationId)

  if (error) {
    console.error('[agent-visibility] resume failed:', organizationId, error.message)
    return { ok: false, reason: 'write_failed' }
  }
  return { ok: true }
}
