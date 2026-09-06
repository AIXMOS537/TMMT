# `_staged/` — reviewed, written, deliberately not applied

Same idea as `_parked/`, different reason. `_parked/` holds migrations that must
**never** run (they would split-brain against the live system). `_staged/` holds
migrations that **should** run, once a human has read them.

`supabase db push` ignores this directory, so nothing here can apply itself.

## Pending

| File | What it does | Blocked on |
|---|---|---|
| `20260908000000_agent_messages_provider_sid_index_STAGED.sql` | inbound-SMS replay gate (`src/app/api/agent/sms/inbound/route.ts`, F-01) | staged |
| `20260908000200_audit_events_webhook_replay_indexes_STAGED.sql` | Cal.com booking-uid + Stripe event-id replay gates (`src/lib/agent/webhook-replay.ts`, T-02b) | staged |
| `20260904010000_generate_va_tasks_idempotent_STAGED.sql` | Superseded — covered `bgcheck_review` only | `20260906022113_generate_va_tasks_idempotent_all_categories.sql` (all five categories) |
| `20260827000001_org_ghl_connections_STAGED.sql` | Per-org GHL connections: separates `subaccount` (our agency token) from `foreign_agency` (operator owns their GHL, credential in Vault). | Owner review. **Not in the production ledger and the table does not exist.** No app code references it yet — moved here 2026-09-05 because sitting in `migrations/` meant the next `supabase db push` would have created it unreviewed. |
| `TRIAGE_ADVERSARIAL_TESTS.sql` | 8-case adversarial harness (join failure, fan-out, mixed state, missing state, duplicate identity, idempotency ×2, authority boundary, fail-open). Runs in a transaction and rolls back. | Needs a branch or local stack — it inserts fixtures. |

## Applied and moved out

| Staged draft | Applied as | Version |
|---|---|---|
| `20260904010000_generate_va_tasks_idempotent_STAGED.sql` | Superseded — covered `bgcheck_review` only | `20260906022113_generate_va_tasks_idempotent_all_categories.sql` (all five categories) | 2026-09-06 |
| `20260903000000_audit_hardening_STAGED.sql` | `20260903185639_*`, `20260903185722_*` | 2026-09-03 |
| `20260904000000_exec_va_tasks_triage_STAGED.sql` | `20260903193844_exec_va_tasks_triage_schema.sql`, `20260903194001_classify_va_tasks_fn.sql` | 2026-09-03 |

Both drafts are kept as the record of what was proposed. **Do not run either** —
production already has the corrected versions, and both drafts contained bugs
that the apply-time gates caught.

## The three bugs the gates caught — this is why the gates exist

1. **`REVOKE ... FROM anon` was a no-op for eight functions.** The grant came
   from `PUBLIC`, which anon inherits. Postgres returned success and changed
   nothing. Check `pg_proc.proacl` first: a bare `=X/postgres` entry *is* the
   PUBLIC grant. Before revoking PUBLIC, confirm the roles you want to keep hold
   their own explicit grants.
2. **Three function signatures were wrong.** `ALTER FUNCTION` on a signature
   that does not exist aborts the whole migration and rolls back everything
   before it. Read `pg_get_function_identity_arguments()` first.
3. **A CTE projection dropped a column the predicate needed.** The classifier's
   `keyed` CTE omitted `subject_name`; the read-only prototype used `r.*` off
   the base table so the gap never showed. The **first execution** of the
   plpgsql wrapper failed. A verified inner query does not verify the wrapper.

All three are doctrine: `docs/runbooks/PRODUCTION-MIGRATION-WORKFLOW.md`.

Each file carries WHY, SAFETY, ROLLBACK and a pre-apply TEST query in its header. Apply one at a time; move the file into `supabase/migrations/` with its real version number when it lands, and record it in `supabase/schema/`.
