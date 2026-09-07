# AIXMOS triage repair — session handoff index

A fresh Claude Code process needs **no conversational memory**. Everything is here.

## Read in this order
| # | File | Why |
|---|---|---|
| 1 | `OWNER_MEASUREMENT_PACKET_20260906.sql` | Q1–Q5. **Hash-pinned — NEVER EDIT.** |
| 2 | `CRON_EXECUTION_EVIDENCE.sql` | C1–C4. Separate file *because* editing the packet breaks its hash. |
| 3 | `MIGRATION_B_DESIGN.md` | Revisions 1–5. **Read Rev 5 first — it retracts Rev 3/4.** |
| 4 | `20260907000000_people_organizations_STAGED.sql` | Migration B. Staged, not applied. |
| 5 | `VA_TASKS_IDENTITY_REGRESSION_TESTS.sql` | T1–T7. |
| 6 | `TICKET_COLLECT_IDENTITY_DECISION.md` | Contract record; owner chose customer-level. |

Rollback lives outside the repo, in
`~/Brain/vault/02-Needs-You/rollback/` (function + DNC backlog).
Full narrative: `~/Brain/vault/07-Ventures/AIXMOS/PART-37-…md`.
All artifacts are mirrored to `~/Brain/vault/07-Ventures/AIXMOS/staged-20260906/`.

## ⚠️ Traps that have already cost time

**Never edit the measurement packet.** Its SHA-256
`b61cae59e3bb7d984d524cce5a4831e92c458a66674d5bacd2b64fddffe3642d`
is pinned in the authorization prompt. Any edit fails the integrity gate. Put new
queries in a companion file.

**An unchanged row count is NOT idempotency evidence on its own.** A sweep that
never ran leaves the count unchanged too. The discriminator is `max(sweep_date)`:
idempotent v2 does `ON CONFLICT DO UPDATE`, which rewrites `sweep_date` and bumps
`last_seen_at`/`seen_count` **without inserting**. Same count, opposite meaning.
See `CRON_EXECUTION_EVIDENCE.sql` C3.

**The 2026-09-06 baseline is a snapshot, not a target.**
`pending 18,910 · frozen 10,933 · fenced 240`. Legitimate later growth makes the
PRODUCER invariant read GROWING — that is the check working. **Never delete rows
or rewrite the baseline to make it green.**

**`people.tenant_slug` is site provenance, not tenancy.** It has 2 possible values
(`aixmos`, `tmmt_property`) against 9 organizations. Do not map it onto orgs. The
real org resolver already exists: `src/lib/platform/tenant-org.ts`
(`orgIdForTenantSlug`, `orgIdForHostStatic`) plus `public.org_id_for_host()` over
`organization_domains`.

**`$50` — POLICY UNVALIDATED.** The only occurrence anywhere is
`having sum(t.amount) >= 50` in the generator. That is evidence of what the code
does, **not** of intended policy — not the operator, threshold, unit, currency, or
exceptions. Do not infer it. It blocks nothing else.

**Two retracted conclusions — do not resurrect them.**
1. "364 has no evidentiary basis" — false; it is the headline of
   `SYSTEM_AUDIT_2026/40_AIXMOS_TRIAGE_CONTROL_PLANE.md`.
2. "The classifier has a cross-status defect" — false; classifying every row is
   the documented contract. **Never add a status filter to make counts look cleaner.**
3. "No org↔tenant mapping exists" — false; see `tenant-org.ts`. A negative grep is
   not absence of a mechanism.

## State
- **Migration A** — 3 categories deployed + idempotent; `bgcheck_review` awaits Q1.
- **Migration B** — staged, owner chose many-to-many; awaits measurements + review.
- **Applied to production so far:** v2 DNC enqueue filter; 142-row DNC backlog
  remediation (ledger `exec_va_tasks_dnc_remediation_20260906`); MCP owner gate wiring.
- **Repo/DB divergence:** DB has `20260903193917_classify_va_tasks_fn`, repo has only
  `194001`. Pre-existing, not ours.
- Staged artifacts are **untracked** on branch `preview/rename-moe-legacy-to-aixmos-credit`.
