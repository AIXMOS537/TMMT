/**
 * POST /api/license/heartbeat
 * Client posts { organization_id, hardware_uuid }; server returns 200 with
 * continued auth OR 410 with kill_command.
 *
 * Per Layer-2 audit: the prior implementation read state in a SELECT then
 * returned a decision based on that snapshot — but the snapshot can go stale
 * mid-request if an admin flips `active=false` between the SELECT and the
 * response, letting one final "ok + 24h cache" slip through past revocation.
 * Now: a single .update().select() returns post-update state, closing the
 * TOCTOU window.
 *
 * HMAC-signed heartbeats using the session_token from /provision are still
 * tracked as a separate MEDIUM (requires partner-side install changes); this
 * fix is independent and stacks with that work.
 */
import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/agent/supabase-server'
import { emitAudit } from '@/lib/agent/audit'

interface HeartbeatBody {
  organization_id: string
  hardware_uuid: string
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: HeartbeatBody
  try { body = (await req.json()) as HeartbeatBody }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }
  const { organization_id, hardware_uuid } = body
  if (!organization_id || !hardware_uuid) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const db = createServiceSupabase()
  const ip = req.headers.get('x-forwarded-for') ?? null

  // Atomic: only updates a row that matches org + hardware + provisioned.
  // The returned row is the post-update snapshot — no TOCTOU with the
  // active/kill_command decision below.
  const { data: matched } = await db
    .from('organization_licenses')
    .update({ last_heartbeat_at: new Date().toISOString() })
    .eq('organization_id', organization_id)
    .eq('hardware_uuid', hardware_uuid)
    .eq('install_token_used', true)
    .select('active, kill_command')
    .maybeSingle()

  if (!matched) {
    // No row updated. Either the license is unprovisioned, the hardware
    // doesn't match, or the org_id is wrong. Cheap secondary query to
    // disambiguate hardware mismatch for the audit log (forensics need to
    // know which device tried to impersonate). The response is the same
    // either way so an attacker can't probe the org's hardware_uuid via
    // 401 vs 404 timing.
    const { data: existing } = await db
      .from('organization_licenses')
      .select('hardware_uuid')
      .eq('organization_id', organization_id)
      .eq('install_token_used', true)
      .maybeSingle()
    if (existing && existing.hardware_uuid !== hardware_uuid) {
      await emitAudit({
        organizationId: organization_id,
        hardwareUuid: hardware_uuid,
        ip,
        action: 'license.hardware_mismatch',
      })
    }
    return NextResponse.json({ error: 'no valid license' }, { status: 401 })
  }

  await emitAudit({
    organizationId: organization_id,
    hardwareUuid: hardware_uuid,
    ip,
    action: 'license.heartbeat',
  })

  if (!matched.active || matched.kill_command === 'wipe') {
    return NextResponse.json(
      { error: 'license_disabled', kill_command: matched.kill_command ?? null },
      { status: 410 },
    )
  }

  return NextResponse.json({ ok: true, kill_command: null, cache_ttl_seconds: 86400 })
}
