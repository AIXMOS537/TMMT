/**
 * The one definition of an OPEN `exec_va_tasks` row.
 *
 * Two columns carry lifecycle, and each writer only touches one of them:
 *   - VA queue decisions (handled / dismiss) write `handled_at` and leave
 *     `status = 'pending'` on purpose, so the generator's idempotency index keeps
 *     working (see src/app/(admin)/va-queue/actions.ts).
 *   - DNC remediation writes `status = 'blocked_dnc'`.
 *
 * So `status = 'pending'` alone does NOT mean actionable: on 2026-09-16, 779
 * dismissed tasks still read `pending`. Every reader that decides whether a task
 * can be worked, staged, or sent must require BOTH columns to say open. Do not
 * re-derive this per caller — use these helpers.
 *
 * Open is necessary, not sufficient: do-not-contact, opt-out and owner approval
 * are separate checks (`assertOutboundAllowed`) and still apply to open tasks.
 */

export const OPEN_VA_TASK_STATUS = "pending";

type OpenFilterable = {
  eq: (column: string, value: string) => OpenFilterable;
  is: (column: string, value: null) => OpenFilterable;
};

/**
 * Narrow a supabase-js `exec_va_tasks` query to open tasks. Loosely typed on
 * purpose: a structural constraint over the Postgrest builder trips TS2589.
 */
export function onlyOpenVaTasks<Q>(query: Q): Q {
  return (query as unknown as OpenFilterable).eq("status", OPEN_VA_TASK_STATUS).is("handled_at", null) as unknown as Q;
}

/** Row-level form of the same rule, for re-checking rows already in hand. */
export function isOpenVaTask(row: { status?: string | null; handled_at?: string | null }): boolean {
  return row.status === OPEN_VA_TASK_STATUS && (row.handled_at ?? null) === null;
}
