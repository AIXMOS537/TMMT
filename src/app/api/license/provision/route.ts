/**
 * POST /api/license/provision
 * One-time install handshake for partner-deploy flash drives.
 * Caller supplies a one-time install token (HMAC) + organization_id + hardware UUID + Secure Enclave attestation key.
 * On success: marks the license consumed, binds the hardware, returns a license JWT.
 */
import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createServiceRoleClient } from '@/lib/supabase-service'
import { emitAudit } from '@/lib/agent/audit'

interface ProvisionBody {
  install_token: string
  organization_id: string
  hardware_uuid: string
  enclave_pubkey_pem: string
}

function hashToken(t: string): string {
  return createHash('sha256').update(t).digest('hex')
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: ProvisionBody
  try { body = (await req.json()) as ProvisionBody }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const { install_token, organization_id, hardware_uuid, enclave_pubkey_pem } = body
  if (!install_token || !organization_id || !hardware_uuid || !enclave_pubkey_pem) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
  }

  const db = createServiceRoleClient()
  const tokenHash = hashToken(install_token)

  const { data: license } = await db
    .from('organization_licenses')
    .select('*')
    .eq('install_token_hash', tokenHash)
    .eq('organization_id', organization_id)
    .single()

  if (!license) return NextResponse.json({ error: 'invalid install token' }, { status: 403 })
  if (license.install_token_used) return NextResponse.json({ error: 'install token already consumed' }, { status: 409 })
  if (!license.active) return NextResponse.json({ error: 'license not active' }, { status: 403 })

  await db.from('organization_licenses').update({
    hardware_uuid,
    enclave_pubkey_pem,
    install_token_used: true,
    last_heartbeat_at: new Date().toISOString(),
  }).eq('organization_id', organization_id)

  await emitAudit({
    organizationId: organization_id,
    hardwareUuid: hardware_uuid,
    action: 'license.provisioned',
    payload: { license_tier: license.license_tier },
  })

  // For v1: return a simple opaque session token; full Ed25519 JWT signing happens once vault is wired
  const sessionToken = hashToken(`${organization_id}:${hardware_uuid}:${install_token}:${Date.now()}`)

  return NextResponse.json({
    session_token: sessionToken,
    organization_id,
    heartbeat_url: `${new URL(req.url).origin}/api/license/heartbeat`,
    audit_url: `${new URL(req.url).origin}/api/audit/events`,
    partner_url: process.env.PARTNER_APP_URL ?? new URL(req.url).origin,
  })
}
