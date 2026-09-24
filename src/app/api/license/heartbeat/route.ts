/**
 * POST /api/license/heartbeat
 * Client posts { organization_id, hardware_uuid }; server returns 200 with continued auth OR 410 with kill_command.
 *
 * Hardening (production finding F-10 / S-2):
 *   - Rate limited per IP and per organization through the same durable
 *     limiter as /api/leads/webhook (Postgres RPC, in-memory fallback).
 *   - One uniform 404 for every "no such install" outcome — malformed id,
 *     unknown org, never provisioned, or hardware mismatch — so a caller
 *     cannot use this endpoint to learn which organization ids are provisioned.
 *   - Audit rows are throttled to one per org per action per window, so an
 *     unauthenticated caller can no longer write an audit_events row per
 *     request (the hardware-mismatch path used to be a log-flooding lever).
 */
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-service'
import { emitAudit } from '@/lib/agent/audit'
import { isRateLimitedDurable, type RateLimitBackend } from '@/lib/rate-limit-durable'

interface HeartbeatBody {
  organization_id: string
  hardware_uuid: string
}

/** Anything outside this shape cannot be a real organization id; answered like an unknown one. */
const MAX_ID_LEN = 128

/** Heartbeats are daily (cache_ttl_seconds below); these limits only bite on abuse. */
const IP_LIMIT = { windowMs: 10 * 60_000, maxHits: 30 }
const ORG_LIMIT = { windowMs: 10 * 60_000, maxHits: 10 }
/** At most one audit row per org per action per window. */
const AUDIT_WINDOW = { windowMs: 15 * 60_000, maxHits: 1 }

const notFound = () => NextResponse.json({ error: 'not found' }, { status: 404 })
const tooMany = () => NextResponse.json({ error: 'too many requests' }, { status: 429 })

export async function POST(req: Request): Promise<NextResponse> {
  let body: HeartbeatBody
  try { body = (await req.json()) as HeartbeatBody }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }
  const { organization_id, hardware_uuid } = body ?? ({} as HeartbeatBody)
  if (!organization_id || !hardware_uuid) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown'
  const db = createServiceRoleClient()
  const limiter: RateLimitBackend = db
  if (await isRateLimitedDurable(`license-heartbeat:ip:${ip}`, IP_LIMIT, limiter)) return tooMany()
  if (typeof organization_id !== 'string' || organization_id.length > MAX_ID_LEN
    || typeof hardware_uuid !== 'string' || hardware_uuid.length > MAX_ID_LEN) return notFound()
  if (await isRateLimitedDurable(`license-heartbeat:org:${organization_id}`, ORG_LIMIT, limiter)) return tooMany()

  const { data: license } = await db
    .from('organization_licenses')
    .select('active, kill_command, hardware_uuid, install_token_used')
    .eq('organization_id', organization_id)
    .single()

  if (!license || !license.install_token_used) return notFound()

  // Throttled: the first call in a window records the audit, the rest skip it.
  const auditOnce = async (action: string, extra: { ip?: string | null } = {}) => {
    const throttled = await isRateLimitedDurable(
      `license-heartbeat:audit:${action}:${organization_id}`, AUDIT_WINDOW, limiter,
    )
    if (throttled) return
    await emitAudit({ organizationId: organization_id, hardwareUuid: hardware_uuid, action, ...extra })
  }

  if (license.hardware_uuid !== hardware_uuid) {
    await auditOnce('license.hardware_mismatch')
    return notFound()
  }

  await db.from('organization_licenses')
    .update({ last_heartbeat_at: new Date().toISOString() })
    .eq('organization_id', organization_id)

  await auditOnce('license.heartbeat', { ip: req.headers.get('x-forwarded-for') ?? null })

  if (!license.active || license.kill_command === 'wipe') {
    return NextResponse.json({
      error: 'license_disabled',
      kill_command: license.kill_command ?? null,
    }, { status: 410 })
  }

  return NextResponse.json({ ok: true, kill_command: null, cache_ttl_seconds: 86400 })
}
