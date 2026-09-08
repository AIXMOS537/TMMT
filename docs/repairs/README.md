# TMMT repair candidates — 2026-09-08 UTC

These are review scripts, not applied migrations. No production rows, functions,
schedules, messages, credentials, or deployments were changed by this work.

## Application repair

The rental desk now preserves a rejected server result, requires successful durable
outbox storage before acknowledging an offline save, and keeps the same record ID
across a transport failure and retry. Successful online writes are not added to the
outbox. Cache-generated timestamps are not sent to the database, including replay
of older queued records. Staff can save the existing `tasks` table online through
the same authenticated, RLS-bound action used by the other desk tables.

Payment/contract numeric fields reject nonnumeric and non-finite values. Contract
dates are checked for calendar validity and order; a one-date edit reads the stored
counterpart through the caller's RLS. Nullable fields, same-day contracts, signed
adjustments, and status-only updates retain their existing behavior. This does not
convert free-text rental rates or implement a payment-obligation ledger.

## SQL candidates

| Script | Purpose | Required production prerequisites |
| --- | --- | --- |
| `classify-va-tasks-source-identity.sql` | Deduplicate tasks by category plus source table/ID; retain contact fallback for legacy rows | Source-keyed generator migrations; existing classifier signature and triage fields. **STAGED 2026-09-08 as `20260908184352_classify_va_tasks_source_identity.sql`** (guarded: skips with a NOTICE where the live-created prerequisites are absent; rehearse with `node scripts/tests/sql/classifier-migration.rehearsal.mjs <migration>`). Not applied. |
| `agent-jobs-terminal-lease-reap.sql` | Mark an exhausted expired lease failed; retry only below the attempt limit | Lease-fencing migration `20260906022156` and ACL hardening `20260906022251` |
| `contracts-date-order.sql` | Atomically prevent an end date before its start, including concurrent/partial writes | Date-typed columns; no existing inversions; unique constraint name |

Each has a corresponding `.down.sql`. Rollback restores code/constraints; it does
not reverse task classifications or resurrect jobs. A classifier rollback requires
a separate, reviewed reclassification if classifications were persisted after apply.
The lease reaper remains postgres/cron-only; no service-role/public execution grant
is added. Neither function authorizes or sends customer messages.

The application date check alone is not a concurrency guarantee. The database
constraint is the atomic protection. It is not a vehicle double-booking constraint:
booking identity, availability, allocation, contract, and handover still need an
integrated transaction.

## Local rehearsal

The tests execute actual SQL functions in embedded PostgreSQL with synthetic data.
They do not connect to Supabase. Test dependency is pinned separately from the app.
Historical function bodies are frozen in `scripts/tests/sql/fixtures/`, so the
suite does not depend on migrations that exist only on the older safety branch.

```sh
npm ci --prefix scripts/tests/sql --ignore-scripts
node scripts/tests/sql/automation-repairs.pglite.test.mjs
# Expected failure against original functions / missing contract invariant.
node scripts/tests/sql/automation-repairs.pglite.test.mjs --repaired
# Expected success, including rollback and re-application.
```

Coverage includes distinct sources sharing one contact, duplicate source identity,
legacy fallback, DNC preservation, non-mutating dry-run, retryable and terminal lease
expiry, stale completion rejection, preserved execution grants, and partial-date
constraint enforcement. This is function-level rehearsal, not full production
schema/RLS/worker/concurrency certification.

## Release sequence

1. Start from the latest GitHub `master`. Its history is newer than this Mac's local
   `master`. Apply only the repair commit/patch, preserving today's decision-contract,
   customer-standing, migration-ledger, and commercialization work.
2. Compare live function definitions and applied migration versions again. The live
   reaper matched the tested baseline; the classifier differed only in comments at
   audit time. Confirm no drift and check for existing inverted contract dates
   (`select count(*) from contracts where end_date < start_date` returned zero).
3. Promote each approved SQL candidate into one named migration with the CLI. These
   review scripts have transaction wrappers; remove outer wrappers when placing
   them in the migration runner, and append the project's schema-reload notification.
   Rehearse up, test, down, up against the target schema before applying individually.
4. Verify definitions, ACLs, task counts, and date constraint using SELECT-only checks.
   Classification labels are not owner approval or execution authority.
5. Run `npm run verify` and authenticated rental-save checks in preview, then release.

The SMS replay fix on the older safety branch is a separate package. The repair
branch based on current `master` does not include that SMS change. Its required
production column/index was absent during this audit; importing it later requires
its migration and an explicit decision on the existing auto-reply policy.

## Remaining offline limitations

Existing IndexedDB data is not bound to a verified user/org identity. Queue replay
orders by UUID rather than an explicit mutation sequence, and partially successful
batches remain queued. Those require a deliberate outbox migration and conflict
protocol. The current repairs do not claim to solve them or silently discard old
queued work.
