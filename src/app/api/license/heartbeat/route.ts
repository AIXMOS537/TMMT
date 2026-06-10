/**
 * POST /api/license/heartbeat
 * Client posts { organization_id, hardware_uuid }; server returns 200 with continued auth OR 410 with kill_command.
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
  if (!organization_id || !hardware_uuid) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

  const db = createServiceSupabase()
  const { data: license } = await db
    .from('organization_licenses')
    .select('active, kill_command, hardware_uuid, install_token_used')
    .eq('organization_id', organization_id)
    .single()

  if (!license || !license.install_token_used) {
    return NextResponse.json({ error: 'no provisioned license' }, { status: 404 })
  }
  if (license.hardware_uuid !== hardware_uuid) {
    await emitAudit({
      organizationId: organization_id, hardwareUuid: hardware_uuid,
      action: 'license.hardware_mismatch',
    })
    return NextResponse.json({ error: 'hardware mismatch' }, { status: 401 })
  }

  await db.from('organization_licenses')
    .update({ last_heartbeat_at: new Date().toISOString() })
    .eq('organization_id', organization_id)

  await emitAudit({
    organizationId: organization_id, hardwareUuid: hardware_uuid,
    action: 'license.heartbeat',
    ip: req.headers.get('x-forwarded-for') ?? null,
  })

  if (!license.active || license.kill_command === 'wipe') {
    return NextResponse.json({
      error: 'license_disabled',
      kill_command: license.kill_command ?? null,
    }, { status: 410 })
  }

  return NextResponse.json({ ok: true, kill_command: null, cache_ttl_seconds: 86400 })
}
