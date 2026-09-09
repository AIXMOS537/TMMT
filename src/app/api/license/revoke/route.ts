/**
 * POST /api/license/revoke
 * Admin-only endpoint. Soft kill (active=false) or hard kill (kill_command='wipe').
 * Auth: X-Admin-Key header must match ADMIN_KEY env var (32+ random bytes).
 */
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceRoleClient } from '@/lib/supabase-service'
import { emitAudit } from '@/lib/agent/audit'

interface RevokeBody {
  organization_id: string
  mode: 'soft' | 'hard' | 'restore'
}

function adminAuthorized(req: Request): boolean {
  const provided = req.headers.get('x-admin-key') ?? ''
  const expected = process.env.ADMIN_KEY ?? ''
  if (!provided || !expected || provided.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  } catch {
    return false
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!adminAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: RevokeBody
  try { body = (await req.json()) as RevokeBody }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const { organization_id, mode } = body
  if (!organization_id || !['soft', 'hard', 'restore'].includes(mode)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const update: Record<string, unknown> = mode === 'restore'
    ? { active: true, kill_command: null }
    : { active: false }
  if (mode === 'hard') update.kill_command = 'wipe'

  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('organization_licenses')
    .update(update)
    .eq('organization_id', organization_id)
    .select()
    .single()
  if (error || !data) return NextResponse.json({ error: 'license not found' }, { status: 404 })

  await emitAudit({
    organizationId: organization_id,
    action: mode === 'hard' ? 'license.hard_kill' : mode === 'soft' ? 'license.soft_kill' : 'license.restored',
    payload: { initiated_by: 'admin' },
  })

  return NextResponse.json({ ok: true, mode, organization_id })
}
