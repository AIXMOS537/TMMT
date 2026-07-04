/**
 * src/lib/agent/approval-store.ts
 *
 * Persistence for the owner-approval queue (Supabase table `gated_actions`,
 * migration 20260628000000_gated_actions.sql). This is the missing half of
 * shared/owner-approval-gate: it stores PENDING actions, lets the owner
 * approve/reject, and records the eventual send.
 *
 * The state-machine logic is pure + exported so it can be unit-tested without a
 * database; the thin async wrappers do the actual Supabase I/O.
 */
import { createServiceSupabase } from './supabase-server'
import type { GatedActionType } from '@shared/owner-approval-gate/approval'

export type GatedStatus = 'pending' | 'approved' | 'rejected' | 'sent' | 'failed'
export type Decision = 'approve' | 'reject'

export interface GatedActionRow {
  id: string
  org_id: string | null
  type: GatedActionType
  payload: Record<string, unknown>
  status: GatedStatus
  created_by: string
  approved_by: string | null
  approved_at: string | null
  reason: string | null
  sent_ref: string | null
}

export class ApprovalTransitionError extends Error {
  constructor(from: GatedStatus, attempted: string) {
    super(`Invalid approval transition: cannot "${attempted}" an action that is "${from}".`)
    this.name = 'ApprovalTransitionError'
  }
}

// ── Pure state machine (no I/O) ──────────────────────────────────────────────

/** Only a pending action may be approved or rejected. */
export function nextStatusForDecision(current: GatedStatus, decision: Decision): GatedStatus {
  if (current !== 'pending') throw new ApprovalTransitionError(current, decision)
  return decision === 'approve' ? 'approved' : 'rejected'
}

/** Only an approved action may be marked sent. */
export function assertSendable(current: GatedStatus): void {
  if (current !== 'approved') throw new ApprovalTransitionError(current, 'send')
}

// ── Async wrappers (Supabase I/O) ────────────────────────────────────────────

export interface PersistPendingArgs {
  type: GatedActionType
  orgId: string | null
  payload: Record<string, unknown>
  createdBy: string
  /** Provide to keep the DB id in sync with an in-memory action id. */
  id?: string
}

export async function persistPending(args: PersistPendingArgs): Promise<string> {
  const db = createServiceSupabase()
  const row: Partial<GatedActionRow> = {
    ...(args.id ? { id: args.id } : {}),
    org_id: args.orgId,
    type: args.type,
    payload: args.payload,
    status: 'pending',
    created_by: args.createdBy,
  }
  const { data, error } = await db
    .from('gated_actions')
    .insert(row)
    .select('id')
    .single()
  if (error) throw new Error(`persistPending failed: ${error.message}`)
  return (data as { id: string }).id
}

export async function getGatedAction(id: string): Promise<GatedActionRow | null> {
  const db = createServiceSupabase()
  const { data, error } = await db.from('gated_actions').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`getGatedAction failed: ${error.message}`)
  return (data as GatedActionRow | null) ?? null
}

/** Apply an owner decision. Validates the transition first (throws on invalid). */
export async function recordDecision(
  id: string,
  decision: Decision,
  approver: string,
  reason?: string,
): Promise<GatedActionRow> {
  const current = await getGatedAction(id)
  if (!current) throw new Error(`gated action ${id} not found`)
  const next = nextStatusForDecision(current.status, decision)

  const db = createServiceSupabase()
  const { data, error } = await db
    .from('gated_actions')
    .update({
      status: next,
      approved_by: approver,
      approved_at: new Date().toISOString(),
      reason: reason ?? null,
    })
    .eq('id', id)
    .eq('status', 'pending') // optimistic guard against a concurrent decision
    .select('*')
    .single()
  if (error) throw new Error(`recordDecision failed: ${error.message}`)
  return data as GatedActionRow
}

/** Record that an approved action was executed (e.g. SMS sent). */
export async function markSent(id: string, sentRef: string): Promise<void> {
  const db = createServiceSupabase()
  const { error } = await db
    .from('gated_actions')
    .update({ status: 'sent', sent_ref: sentRef })
    .eq('id', id)
    .eq('status', 'approved')
  if (error) throw new Error(`markSent failed: ${error.message}`)
}

/** Record that an approved action failed to execute (transient send error). */
export async function markFailed(id: string, reason: string): Promise<void> {
  const db = createServiceSupabase()
  const { error } = await db
    .from('gated_actions')
    .update({ status: 'failed', reason })
    .eq('id', id)
    .eq('status', 'approved')
  if (error) throw new Error(`markFailed failed: ${error.message}`)
}

/**
 * Move an action to `approved` so it can be sent. Idempotent, and RETRYABLE:
 * a `failed` action (transient send error) can be re-approved and re-sent.
 * Rejected/sent actions cannot be re-approved.
 */
export async function approveForSend(
  id: string,
  approver: string,
  reason?: string,
): Promise<GatedActionRow> {
  const current = await getGatedAction(id)
  if (!current) throw new Error(`gated action ${id} not found`)
  if (current.status === 'approved') return current // already approved — idempotent
  if (current.status !== 'pending' && current.status !== 'failed') {
    throw new ApprovalTransitionError(current.status, 'approve')
  }
  const db = createServiceSupabase()
  const { data, error } = await db
    .from('gated_actions')
    .update({
      status: 'approved',
      approved_by: approver,
      approved_at: new Date().toISOString(),
      reason: reason ?? null,
    })
    .eq('id', id)
    .in('status', ['pending', 'failed'])
    .select('*')
    .single()
  if (error) throw new Error(`approveForSend failed: ${error.message}`)
  return data as GatedActionRow
}

/** All pending actions across orgs — for the owner's approval queue view. */
export async function listPendingAll(limit = 100): Promise<GatedActionRow[]> {
  const db = createServiceSupabase()
  const { data, error } = await db
    .from('gated_actions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`listPendingAll failed: ${error.message}`)
  return (data as GatedActionRow[]) ?? []
}
