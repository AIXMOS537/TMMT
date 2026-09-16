/**
 * The real column list of `public.audit_events` on production
 * (uapxakmlwnpfsftfeezx). The repo has no CREATE TABLE for this table
 * (docs/SCHEMA-DRIFT.md), so nothing type-checks a query against it and the
 * route tests run on `src/lib/testing/fake-supabase.ts`, which accepts any
 * column name. That is how `seenWebhookEvent` shipped selecting `created_at`,
 * a column that does not exist, and failed open on every call (C-20).
 *
 * The timestamp column is `ts`, not `created_at`. Matches the row shape
 * `/api/audit/events` inserts. Pinned by `audit-events-columns.test.ts`, which
 * checks every `from('audit_events')` chain in src against this list.
 */
export const AUDIT_EVENTS_COLUMNS = [
  'id',
  'ts',
  'organization_id',
  'hardware_uuid',
  'ip',
  'action',
  'payload',
] as const

export type AuditEventsColumn = (typeof AUDIT_EVENTS_COLUMNS)[number]
