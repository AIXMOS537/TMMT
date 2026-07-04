/**
 * GET /api/agent/approvals
 * The owner's approval queue: all PENDING gated actions awaiting a decision.
 * Owner (admin) only. Pairs with POST /api/agent/approvals/[id] to release them.
 */
import { NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase-server'
import { isOwnerUser } from '@/lib/auth-roles'
import { listPendingAll } from '@/lib/agent/approval-store'

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'sign in' }, { status: 401 })
    if (!isOwnerUser(user)) {
      return NextResponse.json({ error: 'owner only' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'sign in' }, { status: 401 })
  }

  const pending = await listPendingAll()
  return NextResponse.json({
    count: pending.length,
    pending: pending.map((a) => ({
      id: a.id,
      type: a.type,
      org_id: a.org_id,
      created_by: a.created_by,
      // Surface just enough to review — never dump full payloads blindly.
      preview: typeof a.payload.body === 'string' ? a.payload.body : null,
      to: typeof a.payload.to === 'string' ? a.payload.to : null,
      vertical: typeof a.payload.vertical === 'string' ? a.payload.vertical : null,
    })),
  })
}
