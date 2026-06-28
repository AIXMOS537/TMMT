/**
 * POST /api/agent/approvals/[id]
 * The owner-approval release path. Only an owner (admin) may approve/reject a
 * queued gated action. On approval of a held customer message, the SMS gate is
 * RE-CHECKED at send time (defense in depth) before anything goes out.
 *
 * Body: { "decision": "approve" | "reject", "reason"?: string }
 */
import { NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase-server'
import { isOwnerUser } from '@/lib/auth-roles'
import {
  getGatedAction,
  recordDecision,
  markSent,
  markFailed,
  ApprovalTransitionError,
} from '@/lib/agent/approval-store'
import { sendSms } from '@/lib/agent/twilio-send'
import { assertSmsAllowed, SmsBlockedError } from '@shared/compliance-gates/sms-gate'

function str(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params

  // 1. Auth — owner only.
  let approver: string
  try {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'sign in' }, { status: 401 })
    if (!isOwnerUser(user)) {
      return NextResponse.json({ error: 'owner approval only' }, { status: 403 })
    }
    approver = user.email ?? user.id
  } catch {
    return NextResponse.json({ error: 'sign in' }, { status: 401 })
  }

  // 2. Decision
  let decision: string
  let reason: string | undefined
  try {
    const body = (await req.json()) as { decision?: unknown; reason?: unknown }
    decision = String(body.decision ?? '')
    reason = typeof body.reason === 'string' ? body.reason : undefined
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (decision !== 'approve' && decision !== 'reject') {
    return NextResponse.json({ error: 'decision must be approve|reject' }, { status: 400 })
  }

  // 3. Load + transition
  const action = await getGatedAction(id)
  if (!action) return NextResponse.json({ error: 'not found' }, { status: 404 })

  try {
    await recordDecision(id, decision, approver, reason)
  } catch (e) {
    if (e instanceof ApprovalTransitionError) {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    throw e
  }

  if (decision === 'reject') {
    return NextResponse.json({ id, status: 'rejected' })
  }

  // 4. Execute approved action. Only customer_message SMS is wired here.
  if (action.type !== 'customer_message') {
    return NextResponse.json({
      id,
      status: 'approved',
      note: `approved; no executor wired for type "${action.type}" yet`,
    })
  }

  const from = str(action.payload, 'from')
  const to = str(action.payload, 'to')
  const body = str(action.payload, 'body')
  const vertical = str(action.payload, 'vertical') ?? 'rentals'
  if (!from || !to || !body) {
    await markFailed(id, 'incomplete payload (from/to/body)')
    return NextResponse.json({ error: 'incomplete action payload' }, { status: 422 })
  }

  // Defense in depth: the gate decides again, now WITH owner approval. A
  // restricted (credit/funding) marketing send is still hard-blocked here.
  try {
    assertSmsAllowed({ vertical, type: 'marketing', owner_approved: true })
  } catch (e) {
    if (e instanceof SmsBlockedError) {
      await markFailed(id, e.reason)
      return NextResponse.json({ error: 'blocked by SMS gate', reason: e.reason }, { status: 422 })
    }
    throw e
  }

  try {
    const { sid } = await sendSms({
      from,
      to,
      body,
      vertical,
      smsType: 'marketing',
      ownerApproved: true,
    })
    await markSent(id, sid)
    return NextResponse.json({ id, status: 'sent', sid })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await markFailed(id, msg)
    return NextResponse.json({ error: 'send failed', detail: msg }, { status: 502 })
  }
}
