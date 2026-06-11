/**
 * POST /api/license/provision
 * One-time install handshake for partner-deploy flash drives.
 * Caller supplies a one-time install token + organization_id + hardware UUID + Secure Enclave attestation key.
 * On success: atomically marks the license consumed, binds the hardware, returns a random session token.
 */
import { NextResponse } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'
import { createServiceSupabase } from '@/lib/agent/supabase-server'
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

  const db = createServiceSupabase()
  const tokenHash = hashToken(install_token)

  // Atomic compare-and-set: the conditional `install_token_used = false` in the
  // .eq() chain makes the update succeed only on the FIRST consumer of this
  // install_token. The prior TOCTOU between SELECT + UPDATE could let two
  // concurrent provisions both rebind hardware. Now: first wins, second gets
  // zero rows back → 409.
  //
  // `active = true` is also enforced in-update so a flipped-inactive license
  // can't be reactivated by the provisioner. install_token + organization_id
  // pair is the auth: a wrong organization_id with a leaked install_token
  // still produces zero rows.
  const { data: updated } = await db
    .from('organization_licenses')
    .update({
      hardware_uuid,
      enclave_pubkey_pem,
      install_token_used: true,
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq('install_token_hash', tokenHash)
    .eq('organization_id', organization_id)
    .eq('install_token_used', false)
    .eq('active', true)
    .select('license_tier')
    .maybeSingle()

  if (!updated) {
    // We don't disambiguate "no row" vs "already used" vs "inactive" — all
    // three are equally "you can't provision here" from the caller's POV
    // and combining them avoids leaking lifecycle state to an attacker
    // who spreads guesses against /provision.
    return NextResponse.json({ error: 'invalid or already-used install token' }, { status: 409 })
  }

  await emitAudit({
    organizationId: organization_id,
    hardwareUuid: hardware_uuid,
    ip: req.headers.get('x-forwarded-for') ?? null,
    action: 'license.provisioned',
    payload: {
      license_tier: updated.license_tier,
      enclave_pubkey_fp: hashToken(enclave_pubkey_pem).slice(0, 16),
    },
  })

  // Cryptographically random session token. The prior implementation derived
  // this from SHA256(orgId:hwUUID:install_token:Date.now()), which is offline
  // brute-forceable in a small time window if the install_token leaks (~32 bits
  // of timestamp entropy). randomBytes(32) → 256 bits, not derivable from any
  // request input.
  //
  // Note: heartbeat does not yet verify session_token (HMAC-signed heartbeats
  // are tracked as a separate MEDIUM); this fix closes the entropy half of the
  // story so when heartbeat verification lands, the token is already strong.
  const sessionToken = randomBytes(32).toString('base64url')

  return NextResponse.json({
    session_token: sessionToken,
    organization_id,
    heartbeat_url: `${new URL(req.url).origin}/api/license/heartbeat`,
    audit_url: `${new URL(req.url).origin}/api/audit/events`,
    partner_url: process.env.PARTNER_APP_URL ?? new URL(req.url).origin,
  })
}
