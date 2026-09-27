# TMMT-SEC-008

## TASK ID
TMMT-SEC-008

## TITLE
Land branch `sec/partner-acquisition-rls` on master: record the applied ledger version `20260922005007` and bring `KNOWN_UNAPPLIED` back to 53

## PM MILESTONE
PM-00 Security containment (roadmap item 00-a, follow-up). The policy fix itself is **REMEDIATED IN PRODUCTION + POST-APPLICATION VERIFIED** (2026-09-22 00:50Z); this task only lands the repo side. It is a **coordination/record task owned by the `sec/partner-acquisition-rls` session**, not a rebuild: no policy is written, changed or re-applied here.

## OBJECTIVE
Make the repo agree with prod: the `partner_acquisition` policy migration exists on master with the version prod recorded, the drift register counts it as applied, and the rehearsal that proves the policy runs where the other rehearsals run.

## WHY (evidence refs)
- SPEC §20.3 **SEC-01**, §28 **KD-01**, X4 (reconciled 2026-09-22); READINESS §5 #1, §10.1 #10; ROADMAP 00-a. Facts: REMEDIATED on prod **2026-09-22 00:50Z**, ledger `20260922005007 partner_acquisition_least_privilege`, prod baton 9, approval `PARTNER-ACQ-RLS-P0-2026-09-21`, **prepared commit `620e100e`** on `sec/partner-acquisition-rls` (not merged). Historical root cause: `authenticated ALL USING (true)`. Current behaviour: ordinary authenticated cannot read/update/delete; anon cannot read; narrow intake INSERT allowed (anon + authenticated); platform admin manages; the view does not bypass; `internal_team` intentionally denied; 0 rows after the rolled-back verification. Exposure window (~51 min): **no evidence found**; logs cannot attribute direct SQL, so the docs record must not claim that no access occurred.
- E3 §1.6: repo and prod already disagree on ~190 migrations; every new apply that is not recorded widens the gap (KD-32). The drift register (`src/lib/db/migration-drift.test.ts`, `supabase/migrations/LEDGER-SNAPSHOT.txt`, PR #247) tracks `KNOWN_UNAPPLIED`; landing this migration moves that count from 54 back to 53.

## CURRENT BEHAVIOR (file:line)
- Prod: `pg_policies` for `partner_acquisition` no longer shows `partner_acq_authenticated ALL true`; the replacement policy set is what the branch's migration defines (read it from the branch, not from memory). `schema_migrations` has `20260922005007`.
- Master `4cca6835`: no migration file for the fix; the drift register still lists the fix as unapplied/absent; `docs/security/*` has no record of the apply.
- Branch `sec/partner-acquisition-rls` (worktree `C:\dev\wt-sec-partner-acq`, another session): contains the migration, a rehearsal and (probably) a ledger note. **Read it; do not rewrite it.**

## EXPECTED BEHAVIOR
- The branch is rebased or merged onto master by its owning session with: the migration file named with prod's version `20260922005007_<name>.sql` (or a `VERSION_MAP` note if the filename keeps another timestamp and TMMT-BUILD-003 has landed), the drift register updated (`KNOWN_UNAPPLIED` 53), a `docs/security/` record of the apply (date, ledger, baton id, approval ref, postcondition query result summary, no row data), and its rehearsal listed for CI (TMMT-BUILD-002 runner if present).
- The record states explicitly: `internal_team` is denied on `partner_acquisition` **by design** (future access = a product decision for the owner, tracked separately from this P0); `anon` INSERT (the public partner-apply intake) stays as the branch defines it; the exposure statement is "no evidence found", never "no access occurred"; PR #255 stays on hold until the owner releases it.

## FILES (in scope)
- Files already on the branch (migration, rehearsal, ledger note). Plus: `supabase/migrations/LEDGER-SNAPSHOT.txt` (append), `src/lib/db/migration-drift.test.ts` (constant only), NEW `docs/security/PARTNER-ACQUISITION-RLS.md` (if the branch lacks one).

## DATABASE ENTITIES
`public.partner_acquisition` (policies, grants) — **no further change**; `supabase_migrations.schema_migrations` (read-only confirmation).

## DEPENDENCIES
- **Owned by the `sec/partner-acquisition-rls` session.** This lane only reviews. If that session is gone, the owner assigns the landing.
- TMMT-BUILD-002 (CI runner) and TMMT-BUILD-003 (version map) if they land first; otherwise a manual rehearsal run is pasted into the PR.

## CONSTRAINTS
- **No prod write.** The apply is done. No re-apply, no "fix-up" migration.
- Do not touch PR #255 or the `web-partner-apply` form (`src/app/forms/actions.ts:226`).
- Do not widen or narrow the policies "while you are there".

## SECURITY REQUIREMENTS
- The rehearsal on the branch must include a **hostile authenticated user** (no org role) reading 0 rows and unable to write, a staff-of-another-org case, `internal_team` denied, and anon behaviour exactly as the migration states.
- The docs record contains no owner names, phone numbers or row data.

## IMPLEMENTATION NOTES
- If the branch's migration timestamp differs from `20260922005007`, do **not** rename a file another session owns without asking; add the mapping to the ledger note and to `VERSION_MAP.tsv` when it exists (same pattern as `bookings_no_double_booking` repo `20260916235900` vs prod `20260917200051`).

## ACCEPTANCE CRITERIA (testable)
1. `git log master` contains the branch's migration and rehearsal.
2. `migration-drift.test.ts` passes with `KNOWN_UNAPPLIED = 53` (fails at 54 before the change; the PR shows both runs).
3. The rehearsal passes locally (output in the PR) and is in the CI runner when TMMT-BUILD-002 exists.
4. The docs record exists with date, ledger version, baton id and approval ref.
5. A read-only `pg_policies` query (run by the owner) matches the migration's policy names; the result summary (names only) is in the PR.

## TESTS (must fail on the pre-fix code)
- The branch's rehearsal (name per branch): hostile authenticated denied; staff of another org denied; `internal_team` denied; anon per migration. On master before landing, the rehearsal file does not exist (red = missing).
- `migration-drift.test.ts` constant change: red at 54 after the file is added, green at 53.

## DO NOT CHANGE
- Any `partner_acquisition` policy or grant. PR #255. Other migrations. The prod database.

## OWNER GATE
Merge only (merge = deploy; owner + prod baton for the merge). No SQL apply.
