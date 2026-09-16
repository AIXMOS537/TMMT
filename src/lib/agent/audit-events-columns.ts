/**
 * The real column list of `public.audit_events` on production
 * (uapxakmlwnpfsftfeezx). The repo has no CREATE TABLE for this table
 * (docs/SCHEMA-DRIFT.md), so nothing type-checks a query against it and the
 * route tests run on `src/lib/testing/fake-supabase.ts`, which accepts any
 * column name. That is how `seenWebhookEvent` shipped selecting `created_at`,
 * a column that does not exist, so every lookup errored and was treated as
 * "not seen" (C-20).
 *
 * The timestamp column is `ts`, not `created_at`. Verified read-only against
 * production on 2026-09-16 (information_schema.columns, in ordinal order:
 * id bigint, ts timestamptz, organization_id uuid, hardware_uuid text,
 * ip inet, action text, payload jsonb). Update this list only from the live
 * catalog, never to make a query pass. `audit-events-columns.test.ts` checks
 * every `from('audit_events')` chain in src against this list.
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
