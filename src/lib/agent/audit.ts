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
    await db.from('audit_events').insert({
      organization_id: evt.organizationId,
      hardware_uuid: evt.hardwareUuid ?? null,
      ip: evt.ip ?? null,
      action: evt.action,
      payload: evt.payload ?? {},
    })
  } catch {
    // best-effort — never throw from audit path
  }
}
