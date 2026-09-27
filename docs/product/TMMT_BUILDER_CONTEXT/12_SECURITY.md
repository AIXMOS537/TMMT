# 12 — Security model, open findings, rules

Source: SPEC §20, §27 (+ E5 §C, E6 merge controls) · Snapshot 2026-09-21 (SEC-01 updated 2026-09-22) · canon `4cca6835`

> **CURRENT** = "Model", "Done — do not redo", "Findings" (state as of the dates shown), "Merge and deploy controls". **TARGET** = the Owner column's milestone assignments (PM-00…PM-17) and the fixes on branches (`sec/partner-acquisition-rls` REMEDIATED on prod but not on master; Phase 2A A3/A4/A12 open). The "Rules" are binding now.
>
> **Status vocabulary (SPEC §0.5):** OPEN · REMEDIATED · MITIGATED · BLOCKED · OWNER ACTION · ACCEPTED LIMITATION · UNKNOWN. A fixed prod defect is REMEDIATED even if an evidence file predates the fix; an open defect stays OPEN even if a task exists for it. Per-defect owners: `docs/product/_review/DEFECT_TRACEABILITY.md`.

## Model (current)

- **AuthN:** Supabase Auth (email). App signup checks an invite code (`src/app/(auth)/login/actions.ts:51`, durable limit 10/h/IP) and then calls the public `auth.signUp` (`:130`). If GoTrue signup is enabled, a direct `POST /auth/v1/signup` bypasses the invite (`signup_invites` = 0 rows). **AUTH-SIGNUP-001: OPEN / OWNER ACTION REQUIRED; toggle unverified as of 2026-09-22.** Public-signup containment ≠ tenant authorization: RLS and server authz must stay safe for an already-authenticated hostile account whatever the toggle says.
- **AuthZ, app side:** JWT `app_metadata.role` → tier (`src/lib/auth-roles.ts`). Middleware `src/middleware.ts` (Edge) plus layout/page guards.
- **AuthZ, DB side:** `profiles.role` via SECURITY DEFINER helpers `is_platform_admin()`, `is_admin()`, `is_staff()` (**global**), `is_internal_ops()` (**includes investor**) and `is_org_member(org)`. Nothing syncs the app side and the DB side. Both fail closed.
- **RLS:** on for 178/178 tables. 17 have zero policies (service-role only). There are 348 policies, and `is_staff()` appears in 189 of them. 22 literal-`true` policies. **Anon holds INSERT/UPDATE/DELETE grants on 167 tables; RLS is the only gate.**
- **Tenant isolation:** the customer path (`is_org_member`) is sound but untested in CI. **Staff are global** via `is_staff()`. Verdict: adequate for one house operator, **not ready for multi-tenant partners**.
- **Service role:** ~60 files use it (`src/lib/supabase-service.ts` is `server-only`). Public-reachable users are signature- or secret-gated, except `api/forms/submit` and `api/leads/webhook` (durable rate limit only).
- **Rate limiting:** `rate_limit_hit` RPC is **live on prod** (the "STAGED" comment in `rate-limit-durable.ts:10-20` is stale). Middleware uses an in-memory limiter for POST `/forms*`. There is no limit on webhooks, `cube/application`, `voice/ghl`, `license/*` or `submitCreditFundingIntake`.

## Done — do not redo

Profiles self-escalation **REMEDIATED on prod** 2026-09-21 23:41Z (ledger `20260921234148`, prod baton 8, trigger `profiles_block_protected_self_edits`; authenticated column UPDATE only on `full_name, phone, updated_at`; CI regression 2A-A3 still open). **`partner_acquisition` P0 REMEDIATED IN PRODUCTION + POST-APPLICATION VERIFIED 2026-09-22 00:50Z** (ledger `20260922005007 partner_acquisition_least_privilege`, baton 9, approval `PARTNER-ACQ-RLS-P0-2026-09-21`, prepared commit `620e100e` on `sec/partner-acquisition-rls`, not merged). Historical root cause: `authenticated ALL USING (true)`. Current: ordinary authenticated cannot read/update/delete; anon cannot read; narrow intake INSERT allowed (anon + authenticated); platform admin manages; the view does not bypass; `internal_team` intentionally denied; 0 rows after the rolled-back verification. Exposure (~51 min): no evidence found; logs cannot attribute direct SQL, so do not claim no access occurred. Follow-ups (separate): branch landing (TMMT-SEC-008), `KNOWN_UNAPPLIED` 54→53, `internal_team` future access = product decision. TRUNCATE grants removed. Anon/authenticated RPC revokes. Remediation wave PRs #190–#218. C-20 replay, C-21 containment (#244–#246). Next RCE fix (#234). Quarantine of unverified payment follow-ups (#241). Prod write baton RPCs. Durable rate limiter. GHL voice secret compare is constant-time.

## Findings (severity = original rating; Status = current, 2026-09-22)

| Sev | ID | Finding | Status | Owner |
|---|---|---|---|---|
| P0 (historical) | SEC-01 | `partner_acquisition` authenticated `ALL true` (+ anon insert added 2026-09-21) — root cause | **REMEDIATED** on prod 2026-09-22 00:50Z (ledger `20260922005007`, baton 9, `620e100e`); `internal_team` denied by design; follow-ups OPEN (branch landing, `KNOWN_UNAPPLIED`, `internal_team` decision); PR #255 stays on hold | `sec/partner-acquisition-rls` workstream; landing = TMMT-SEC-008. **Do not touch the policies** |
| HIGH | SEC-02 | AUTH-SIGNUP-001 public signup bypasses invite | **OPEN / OWNER ACTION** (unverified 2026-09-22) | owner (2A-A4a toggle; A4b server-side invite); TMMT-AUTH-004 integrates with A4b, never forks it |
| HIGH | SEC-03 | `is_staff()` global across 189 policies → cross-org staff reads | **OPEN** | PM-02 (TMMT-DATA-003) / GHL M9 |
| HIGH | SEC-04 | master unprotected (free private plan) + `session-autopilot.yml` latent auto-merge / branch delete | **OPEN — LATENT RISK** (auto-merge off; recent merges human; not an incident; not resolved) | owner (PM-00 TMMT-SEC-004) |
| HIGH | SEC-05 | GHL tag/event **can** create "Paid" `customer_payments`, no org, no processor proof; fires commission + tokens (CODE CAPABILITY; never fired on prod) | **OPEN** (latent) | PM-00 contain (TMMT-SEC-002), PM-06 fix |
| HIGH | SEC-06 | Deployed edge `intake` v7 (caller-chosen columns, service role) and `capture-drive` (not in repo) | **OPEN / OWNER ACTION** | owner via GHL track (B-4/B-5) |
| HIGH | SEC-07 | ANON-TENANT-001: six anon-writable tables with caller-chosen `org_id` | **OPEN** (M1 migration not applied) | GHL track M1; `vehicle_handover` slice PM-08 |
| MEDIUM | SEC-08 | DNC bypass on outbound GHL tag/field/stage writes; email branch | **OPEN** | PM-00 contain (TMMT-SEC-003), GHL M8 / PM-18 |
| MEDIUM | SEC-09 | Open redirect `api/auth/callback?next=/%5Cevil.com` (`route.ts:18,32`) | **OPEN** | PM-00 (TMMT-SEC-001) |
| MEDIUM | SEC-10 | No tenant-isolation or privilege regression tests in CI | **OPEN** | PM-01 (TMMT-BUILD-002) / GHL M9 / 2A-A3 / TMMT-AUTH-005 |
| MEDIUM | SEC-11 | Middleware blocks crons and machine APIs; loosening it re-arms the mission-daily broadcast | **OPEN** | PM-01 (TMMT-BUILD-001 after TMMT-SEC-005) |
| MEDIUM | SEC-12 | `change_log` authenticated ALL `true` | **OPEN** | PM-00 (TMMT-SEC-006) |
| MEDIUM | SEC-13 | `org_roles` 42P17 recursion | **OPEN** | Phase 2A **A12** owns it (PM-02 #6 = reference) |
| MEDIUM | SEC-14 | Public lead webhook overwrites an existing lead by phone | **OPEN** | GHL track M8 |
| MEDIUM | SEC-15 | Staff can sign any `staff-documents` path across orgs (`(admin)/document-actions.ts:39-61`) | **OPEN** | **PM-02** item 9 (TMMT-DATA-005); SPEC §20.3 now agrees (SI-03 resolved) |
| MEDIUM | SEC-16 | Default ACL on `supabase_admin`-owned new tables re-grants TRUNCATE + ALL to anon/authenticated | **OPEN** (MITIGATED by checklist once TMMT-BUILD-007 lands) | PM-01 |
| MEDIUM | SEC-17 | Credit: ungated `[id]`, arbitrary payload, CPN ban unenforced | **OPEN** | credit track C1 |
| MEDIUM | SEC-18 | Voice agent nil-UUID fallback; no owner hold | **OPEN** | PM-15 (TMMT-AI-001) |
| MEDIUM | SEC-19 | `is_internal_ops()` includes investor; `rental_ledger` investor INSERT/UPDATE | **OPEN** | PM-02 (TMMT-DATA-004) |
| MEDIUM | SEC-20 | PARTNER-TENANT-001 caller-chosen tenant on partner telemetry | **OPEN** | GHL track B-8; PM-17 gate before the first external partner |
| LOW | SEC-21 | PII in logs (`record-opt-out.ts:55`, `degraded.ts:106`, `login/actions.ts:101,117`); no Sentry scrubber | **OPEN** | PM-17 (TMMT-OPS-001) |
| LOW | SEC-22 | `aria/` unauthenticated chat (not deployed) | **OPEN** (MITIGATED by quarantine guard once TMMT-AI-002 lands; deletion = owner) | PM-15 |
| LOW | SEC-23 | `insurance.login_*` credential columns (empty) | **OPEN** | PM-02 (TMMT-DATA-004) |
| LOW | SEC-24 | Stale comments; `vendor-files` bucket drift | **OPEN** | PM-01 (TMMT-BUILD-007) |
| OWNER | SEC-25 | credential rotation, Docker port firewall, secret clean-up, watchdog, staff password rotation | **OWNER ACTION** | owner |

## Merge and deploy controls (facts)

- **Every push to master deploys `tmmt-ops`.** master is **unprotected** and cannot be protected on the current plan (GitHub protection APIs return 403). Any identity with write access can merge, and a merge is a deploy. The baton is enforced only by a local hook. Agents also use the `AIXMOS537` identity.
- `session-autopilot.yml` (every 6 h, `contents: write`, `pull-requests: write`) contains `gh pr merge --auto --merge` (line ~76) and `git push origin --delete` (line ~94). **Classification: LATENT RISK — not an active incident, not resolved.** Evidence: repo `allow_auto_merge=false`; recent merges were human; master has no technical branch protection; the workflow can enable auto-merge for `claude/*` once the owner follows its setup comment.
- `mission-daily.yml` (13:00 UTC) defaults to `audience=team`, `notify=true` (lines 41-42), and `curl --fail-with-body` passes on 307. It is dead-green today and would **re-arm a team broadcast** when middleware lets `/api/mission/*` through.
- Preview deploys use the **production** DB.

## Rules (binding for every change)

1. **RLS must withstand a hostile authenticated account.** Assume signup may be open. Any policy that trusts `authenticated` alone, or `WITH CHECK (true)`, is a finding. Every policy change is tested with (a) a hostile authenticated user with no org role, (b) a staff user of another org, (c) anon, and (d) the legitimate user.
2. **Never trust a client-supplied `org_id`.** Derive the tenant server-side.
3. **The service role is server-only.** Import it only via `src/lib/supabase-service.ts` in server code. Never expose it to a client component or an edge path. A service-role writer reachable from a public route needs signature/secret auth **and** a durable rate limit. Remember: a public path is a public **write** path, so trace its writer.
4. **Prod write baton** before any prod migration, prod SQL write, prod config/env change, merge to master, or live-automation switch-on: `ops.prod_baton_status()` → `ops.acquire_prod_baton(...)` → `ops.assert_prod_baton(...)` before each write → `ops.release_prod_baton(...)`. If `acquired` is false, STOP and report the holder. Never steal the baton. **Builders do not do this themselves; the owner does.**
5. New tables: `REVOKE ALL … FROM anon, authenticated`, then grant exactly what is needed (SEC-16).
6. Middleware changes need the tier × route matrix test, and every newly public path needs a named writer audit.
7. Secret searches print **path + type only**, never values. No `.env*` is read into output.
8. No PII in logs. Use the redaction helper. Fixtures use synthetic data only.
9. Do not open or push rescue bundles; they contain credentials-named files.
