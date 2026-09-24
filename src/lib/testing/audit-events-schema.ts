import { AUDIT_EVENTS_COLUMNS } from "@/lib/agent/audit-events-columns";
import type { FakeDbCall, FakeDbResponse } from "./fake-supabase";

/**
 * Test-only schema check for `audit_events` queries against the fake DB (C-20).
 *
 * `makeFakeSupabase` accepts any column name. This returns the error PostgREST
 * gives for a column that does not exist (42703), so a query that names one
 * fails in tests the same way it fails in production.
 *
 * The column list is AUDIT_EVENTS_COLUMNS: recorded by hand from a read-only
 * check of production on 2026-09-16. It is NOT synced with production
 * automatically. The repo has no generated Supabase types or table definition
 * to derive it from (tracked as separate debt).
 */
const known = new Set<string>(AUDIT_EVENTS_COLUMNS);

/** `payload->>booking_uid` is a filter on the `payload` column. */
const baseColumn = (col: string) => col.split("->")[0].trim();

/** The first column this call names that `audit_events` does not have, if any. */
export function unknownAuditEventsColumn(call: FakeDbCall): string | undefined {
  const selected = (call.columns ?? "*")
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c && c !== "*");
  const filtered = call.filters
    .filter(([method]) => method !== "limit" && method !== "range")
    .map(([, col]) => String(col));
  return [...selected, ...filtered].map(baseColumn).find((c) => !known.has(c));
}

/** The 42703 response for a call on `audit_events` that names a missing column, else undefined. */
export function auditEventsColumnError(call: FakeDbCall): FakeDbResponse | undefined {
  if (call.table !== "audit_events") return undefined;
  const bad = unknownAuditEventsColumn(call);
  return bad ? { error: { code: "42703", message: `column audit_events.${bad} does not exist` } } : undefined;
}
