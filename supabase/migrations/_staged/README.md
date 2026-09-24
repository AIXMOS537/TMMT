# `_staged/` — reviewed, written, deliberately not applied

Same idea as `_parked/`, different reason. `_parked/` holds migrations that must
**never** run (they would split-brain against the live system). `_staged/` holds
migrations that **should** run, once a human has read them.

`supabase db push` ignores this directory, so nothing here can apply itself.

## Pending

| File | What it does | Blocked on |
|---|---|---|
| `20260922000000_attachment_provenance_STAGED.sql` | CHANGE_REQUEST_001 — 12 provenance columns on `documents`/`vehicle_media`, `customer_email` nullable, idempotency indexes, 7 private buckets. Unblocks Phase 2 extraction (Gate 2). All 3 tables hold 0 rows; rollback clean while empty | **owner authorization + Gate 0 offline archive must exist first** |
| `20260908000000_agent_messages_provider_sid_index_STAGED.sql` | inbound-SMS replay gate (`src/app/api/agent/sms/inbound/route.ts`, F-01) | staged |
| `20260908000200_audit_events_webhook_replay_indexes_STAGED.sql` | Cal.com booking-uid + Stripe event-id replay gates (`src/lib/agent/webhook-replay.ts`, T-02b) | staged |
| `20260908000002_dnc_stop_rows_braden_hott_STAGED.sql` | Two customers replied STOP but had no `do_not_contact_numbers` row (M1 audit 2026-09-08). **APPLIED live 2026-09-09T00:36Z** by M1 Rick on owner approval; the owner runner (`02-Needs-You/APPLY-DNC-STOP-ROWS-20260908.mjs`) re-ran idempotently and confirmed both …8055 and …9845 ON DNC. File kept as the record | done |
| `20260904010000_generate_va_tasks_idempotent_STAGED.sql` | Superseded — covered `bgcheck_review` only | `20260906022113_generate_va_tasks_idempotent_all_categories.sql` (all five categories) |
| `20260827000001_org_ghl_connections_STAGED.sql` | Per-org GHL connections: separates `subaccount` (our agency token) from `foreign_agency` (operator owns their GHL, credential in Vault). | Owner review. **Not in the production ledger and the table does not exist.** No app code references it yet — moved here 2026-09-05 because sitting in `migrations/` meant the next `supabase db push` would have created it unreviewed. |
| `20260915120000_operator_progress_tenant_scope_STAGED.sql` | Replaces `operator_training_progress_rw`, whose `EXISTS (SELECT 1 FROM org_roles r WHERE r.user_id = auth.uid())` never mentions the row — so anyone holding any org role could read, update and delete **every** operator's training record in **every** tenant. Found 2026-09-15 by reading `pg_policies`; it is in no repo migration. | Owner apply |
| `TRIAGE_ADVERSARIAL_TESTS.sql` | 8-case adversarial harness (join failure, fan-out, mixed state, missing state, duplicate identity, idempotency ×2, authority boundary, fail-open). Runs in a transaction and rolls back. | Needs a branch or local stack — it inserts fixtures. |

## Applied and moved out

| Staged draft | Applied as | Version |
|---|---|---|
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

## TRIAGE 2026-09-09 - every file in this directory was checked against production

Nothing here is "just waiting for a tap" any more. Each file now carries a banner
at its head saying which of these it is.

| File | Outcome |
|---|---|
| `20260827000001_org_ghl_connections` | **Premature.** Sound, FK targets exist, table absent - but NO app code references it. Apply with the code that reads it. |
| `20260903000000_audit_hardening` | **Superseded.** Applied correctly as `20260903185639` + `20260903185722`. Section 5 (cron.unschedule) is the one open owner decision. |
| `20260904000000_exec_va_tasks_triage` | **Superseded.** Applied as `20260903193844` + `20260903194001`; `exec_va_tasks.triage` verified present. |
| `20260904010000_generate_va_tasks_idempotent` | **DO NOT APPLY - would be a compliance regression.** It replaces `generate_va_tasks_v2()` with a body containing ZERO DNC filters, and that function is what pg_cron runs daily at 12:00. Its identity columns and upsert are already live. |
| `20260908000000_agent_messages_provider_sid_index` | **Blocked, not gated.** `agent_messages` has no `provider_message_sid` column; it would fail 42703. |
| `20260908000000_generate_va_tasks_dnc_at_enqueue` | **Intent shipped, body did not.** Its own required pre-apply diff FAILED - the reconstruction dropped live's null guards and the `dnc_filtered_at_enqueue` return key. Reconciled against the live body instead: `20260909212038_generate_va_tasks_v2_optout_at_enqueue.sql`. |
| `20260908000001_mark_existing_dnc_pending` | **Nothing to drain.** Its required pre-apply check returned ZERO rows after the opt-out filter landed. Would create an empty ledger and update 0 rows. Re-run the check before reviving. |
| `20260908000002_dnc_stop_rows_braden_hott` | **Owner only.** The file says "Do not run from an agent" and that is respected. |

**Standing lesson from this pass:** a file in `_staged/` can be stale against the live
schema *or against a later migration*. Before applying any of these, diff the object
it touches against production first - `pg_get_functiondef`, `information_schema.columns`
- rather than trusting the file's own description of the world.
