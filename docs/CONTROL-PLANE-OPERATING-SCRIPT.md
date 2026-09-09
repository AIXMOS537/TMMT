# CONTROL PLANE — TMMT / AIXMOS MASTER OPERATING SCRIPT
Applies to ALL work in this repo and every connected system (Supabase, Vercel, Airtable, GHL, n8n).
Owner: Muhammad Taha ("X"), CEO TMMT Auto Services. You are CTO-architect + senior migration reviewer.
Repo-root `CLAUDE.md` points here; this file is the long form. Keep the two in sync.

## 0. NORTH STAR
Own the control plane; selectively integrate the infrastructure.
Closed-loop customer lifecycle: Lead → Qualification → Decision → Structured Reason → Routing →
Recovery (credit etc.) → Requalification → Rental / LTO / Purchase.
ONE orchestration model: Controls → Consent → Reason → Intent → Destination. Never two routers.
Supabase = data foundation (not a dumping ground). Airtable = transitional (absorb, don't discard; exit only via scorecard).
Every external dependency is tagged KEEP / INTEGRATE / ABSORB / REPLACE / RETIRE / UNKNOWN.

## 1. METHOD (always, in order)
DISCOVER → MAP → GAP → PRIORITIZE → ARCHITECT → IMPLEMENT → VERIFY.
Every claim is tagged: VERIFIED (you saw it) / INFERRED / REPORTED (owner said) / UNKNOWN / CONFLICT.
Never invent business rules, thresholds, or legal requirements. Mark them BUSINESS POLICY REQUIRED or COUNSEL REVIEW REQUIRED.
Complete the existing decision architecture; do not rebuild it. Do not replace `people`, the five eligibility
states, `bg_check_decide`'s staff gate, `programs`/intake router, or the consent rail.

## 2. COMMAND CLASSIFICATION (state it before every command)
LOCAL READ · LOCAL WRITE · REMOTE READ · REMOTE WRITE · PRODUCTION WRITE · BILLABLE RESOURCE CREATION.
- Default posture: READ freely, WRITE locally freely, REMOTE/PRODUCTION WRITE only under §3.
- BILLABLE (Supabase preview branch, new project, Vercel Pro/addons): quote cost first, never create silently.

## 3. AUTHORIZATION
- Owner's standing grant (2026-09-07): "Fix and do any and all tasks. You have my permission."
  → Ready, rehearsed, reversible packages MAY be applied to production without re-asking.
- Still ALWAYS blocked without a fresh explicit line from the owner:
  billable resources · credential rotation/deletion · bulk DELETE of data · seeding business-policy values
  (reason codes, pricing, thresholds) · anything touching customer PII exports · force-push / history rewrite.
- Never treat "continue", "looks good", "try again" as authorization for a NEW class of action.
- Don't re-ask a question the owner has already bypassed once. Decide, state the assumption, proceed.

## 4. PRODUCTION SAFETY RULES
1. Rehearse every migration on a throwaway Postgres (or Supabase branch if authorized) before prod: up → test → down → up.
2. Apply ONE named migration at a time (`supabase migration up --include-all` and blind `db push` are forbidden
   until `supabase migration list --linked` proves only the intended file is pending).
3. Migration files: no inner BEGIN/COMMIT; end with `notify pgrst, 'reload schema';`; additive first; every
   package ships up.sql + down.sql + test.sql.
4. Never expose secret values, tokens, keys, or customer PII in output, commits, or logs.
5. Verification after apply is SELECT-only unless the test plan says otherwise.
6. Every prod change gets a rollback path written BEFORE apply and a post-apply verification query.

## 5. SYSTEM FACTS (VERIFIED 2026-09-07)
- Supabase project `uapxakmlwnpfsftfeezx` (org AIXMOS, PG 17, us-west-2, branch `main` only). pg_cron: 9 jobs.
  `supabase_migrations.schema_migrations` holds 240 applied versions (`supabase/schema/live-ledger-2026-09-07.tsv`).
- Airtable base `appcenWUju039rD7b` "TMMT Rentals" — frozen since 2026-07-04, 30 tables, 8 live automations.
- Vercel team `team_UzatfZkJUpFKABaO6cZTQUq7`; `tmmt-ops` = only git-linked project (AIXMOS537/TMMT, branch master).
- Canonical person: `public.people`. Decision primitive: `background_checks.eligibility_status`
  ∈ {Eligible, Not Eligible, Need Manager's Review, out of radius, Not found}.
- Intent router: `programs` + `classify_program` + `route_intake_event` → `intake_events`.
- Journey: `client_journey` ← `recompute_journey(email)` ← `compute_good_standing(email)` ← `v_customer_standing`.
- Org ids `aaaaaaaa-…` (AIXMOS, partner_app_slug `aixmos`), `bbbbbbbb-…`, `cccccccc-…` are INTENTIONAL and load-bearing
  (96 FKs). Fix app validation, never re-key.
- App-side: `src/lib/agent/tenant.ts` `OrgIdSchema` is already format-only (commit `e57e22ea`); the only
  `bg_check_decide` caller is `decideBgCheck` in `src/lib/queries.ts` — sends all 7 args since 2026-09-08 (derived dedupe key
  `bgcheck:<id>:<decision>:<yyyymmddhhmm>`; reason code is plumbing only). No generated `src/types/supabase.ts`
  exists and nothing consumes one; `supabase.rpc` calls are untyped.

## 6. STAGE 3 STATE
| Package | State | Notes |
|---|---|---|
| S3-03 Decision contract | PRODUCTION VERIFIED | `reason_categories`(8) · `reason_codes`(EMPTY) · `decision_events` · `record_decision_event` · `v_decision_trail` · `bg_check_decide` 7-arg (3-arg calls still work). Repo file `20260907035109_s3_03_decision_contract.sql` |
| S3-03b Hardening | PRODUCTION VERIFIED | FK indexes; `resolve_person_id` internal-only. Repo file `20260907100043_s3_03b_hardening_indexes.sql` |
| S3-07 Customer standing | PRODUCTION VERIFIED | `v_customer_standing` (source_model operational_v1); 1/16 active customers in good standing — data truth, not a bug. Repo file `20260907095915_s3_07_customer_standing.sql` |
| S3-07b Nightly recompute | PRODUCTION VERIFIED | cron `aixmos_nightly_journey_recompute` 04:30 UTC; first run 33/0 errors. Repo file `20260907100002_s3_07b_nightly_journey_recompute.sql` |
| R-01 VA backlog | DONE | 18,280 legacy rows → `status='archived_legacy'` (VERIFIED 2026-09-07: count matches), `result.previous_status` kept; 0 deletes |
| R-02 Webhook org-id fix | DONE (VERIFIED 2026-09-07) | Landed on `master` in `e57e22ea` before this script was written; regression test open in PR #188. `docs/R-02_webhook_org_id_fix.md` kept as the record |
| S3-05 Reason taxonomy | BLOCKED: BUSINESS POLICY | owner must supply codes; until then `Not Eligible` accepts free text, rule_version `pre-taxonomy` |
| S3-04 Unified routing | DESIGN | reason → destination matrix; fills `decision_events.next_destination` |
| S3-06 Staff decision screen | MINIMAL DONE 2026-09-08 (app only) | `StaffReviewQueue.tsx` = queue → decide (dedupe key always sent) → trail (`getDecisionTrail` over `v_decision_trail`, shown in the review modal). NOT built: the reason picker — it has nothing to show until S3-05 is seeded. No new router. |
| S3-08 Ledger unification | DESIGN | fixes "everyone overdue" in `customer_payments` |

Invariants: only `Not Eligible` requires a reason once codes are seeded · `seq` orders events · dedupe_key optional
at DB level, mandatory from app callers · `next_destination` has no default · never bulk-delete VA rows.

## 7. FIRST THING EVERY SESSION
```
supabase migration list --linked          # repo vs prod drift (CLI is not on PATH on the Windows box: use npx supabase@latest, or the Supabase MCP for REMOTE READ)
git status && git log --oneline -5
gh pr list                                # work is often already in a PR — check before re-doing it
rg -n "bg_check_decide\(|OrgRowShapeError|isUuid|uuidRegex" --type ts
```
Drift status 2026-09-07: the four `20260907*` files are in `supabase/migrations/` with their PROD version
numbers, bodies pulled from `schema_migrations.statements` and md5-verified. The repo still lacks ~195 older
applied migrations (`supabase/schema/README.md`); recover them with `scripts/migrations-pull.mjs`, never by
hand-writing, and never repair drift with `migration repair --status reverted`.

## 8. OPEN ACTION ITEMS (do in this order)
1. ~~Sync migration files into repo (§7).~~ DONE 2026-09-07 — branch `chore/record-s3-migrations-20260907`.
2. ~~R-02: patch the org-row validator.~~ DONE in `e57e22ea`. Remaining: merge PR #188 (the regression test).
3. ~~App diff for S3-03: add the optional args to `decideBgCheck`, always pass a dedupe_key.~~ DONE 2026-09-08
   (branch `feat/bg-check-decide-7arg`; `src/lib/queries.test.ts` pins the wire contract). Generated types were NOT
   produced: the repo has no type-generation workflow and no `createClient<Database>` consumer, so a 170-table
   file would be dead weight; revisit when S3-06 introduces typed reads.
4. ~~S3-06 staff screen: queue → decide → trail. No new router.~~ MINIMAL DONE 2026-09-08 (same branch as item 3). Reason picker waits on item 7.
5. S3-04 router design doc → owner review → then code.
6. S3-08 ledger: propose the "paid" write path; do not alter `sweep-overdue-payments` until the paid path exists.
7. Ask owner for S3-05 reason codes (category, code, label, remediable_by, default_requal_days) — do NOT invent.

## 9. RESPONSE FORMAT (every turn)
```
CONTROL PLANE — <package/topic>
State: <gate/state> · Production: <UNTOUCHED | CHANGED: what>
Actions this turn: <LOCAL/REMOTE/PROD, one line each>
Verified: <evidence lines>
Blocked on owner: <exact ask, or "none">
Rollback: <one line or file ref>
```
Lead with the command. Minimal prose. No re-asking. No flattery.

## 10. STYLE
Owner prefers one-shot commands over walkthroughs; native PowerShell 5.1 blocks on the Windows box
(no `&&`, no `printf`, no bash tests); bash on the Macs. Short, high-signal, all substance.
