/**
 * Audit emitter. Two paths:
 * 1. Direct INSERT into audit_events (service role; fast for in-process events)
 * 2. POST to /api/audit/events (for distributed services that don't have service role)
 *
 * Both end up in the same table. The first is preferred when we already have a Supabase client.
 */
import { createServiceSupabase } from './supabase-server'

export interface AuditEvent {
  organizationId: string | null
  action: string
  payload?: Record<string, unknown>
  hardwareUuid?: string | null
  ip?: string | null
}

export async function emitAudit(evt: AuditEvent): Promise<void> {
  try {
    const db = createServiceSupabase()
    const { error } = await db.from('audit_events').insert({
      organization_id: evt.organizationId,
      hardware_uuid: evt.hardwareUuid ?? null,
      ip: evt.ip ?? null,
      action: evt.action,
      payload: evt.payload ?? {},
    })
    // supabase-js returns insert errors via the .error field, not by throwing.
    // The prior code swallowed both throws and quiet errors — meaning a
    // misconfigured RLS or schema drift would drop every audit on the floor
    // with zero signal. Surface these so Vercel Functions logs catch them.
    if (error) {
      console.error(
        '[audit] insert returned error',
        { action: evt.action, organizationId: evt.organizationId, message: error.message },
      )
    }
  } catch (err) {
    // Network / unexpected throw. Still best-effort (we never want audit
    // to break the request path), but loud so it's diagnosable.
    console.error(
      '[audit] insert threw',
      { action: evt.action, organizationId: evt.organizationId, err: err instanceof Error ? err.message : String(err) },
    )
  }
}
