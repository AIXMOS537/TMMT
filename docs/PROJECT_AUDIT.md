# PROJECT AUDIT — tmmt-ops (TMMT / AIXMOS)

**Working document for application recovery. State as of `origin/master = a88d8087`, audited 2026-09-08.**
Companion: `REMEDIATION_PLAN.md` (the work queue). This file is the map; it is not proof. Re-validate against code.

Every claim is tagged **VERIFIED** (read in code / run / read from prod), **INFERRED**, or **REPORTED** (another session, not re-checked).
Existing audits are incorporated by reference, not repeated: `docs/commercialization/COMMERCIAL_MASTER.md`, `OWNER_DECISIONS.md` (D-1…D-21), `CLOSURE_STATUS.md`, `docs/SCHEMA-DRIFT.md`, `docs/CIRCULAR-DEPS-BASELINE-20260822.md`, `docs/CONTROL-PLANE-OPERATING-SCRIPT.md`.

---

## 1. Application purpose (VERIFIED from README, routes, schema)

One Next.js app, three faces:

1. **TMMT Rentals back-office** — replaced Airtable for a car-rental business: fleet, leads, background checks, customers, payments, tickets, expenses, timesheets, vendors, plus 8 public intake forms. Staff sign in; customers do not.
2. **AIXMOS platform** — the same engine sold to other operators: multi-tenant orgs, operator onboarding/provisioning, token-metered "Pocket" assistant, credit/funding "learn" journey, licensing/kill-switch plane, dispatch board, owner command hub, GHL-hosted checkout for kits and high-ticket builds.
3. **Ops automation** — webhooks from GHL/Twilio/Stripe/Cal/Airtable, cron jobs, an SMS agent with an LLM, Telegram/Slack/iMessage fan-out to the owner, an ops-command router.

Business context that constrains engineering (REPORTED via OWNER_DECISIONS): no authoritative price list (D-1), no signable rev-share (D-4), checkout URLs unverified (D-5), production write authority stays owner-gated (D-8/D-18), reason codes are business policy (D-9/D-19), vehicle-inclusive offer on hold (D-20), Customer #2 tenancy blocked on one migration (D-21).

## 2. Baseline (VERIFIED 2026-09-08, worktree `C:\dev\TMMT-audit-wt` @ `a88d8087`)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 40 warnings (unused vars, exhaustive-deps) |
| `npx vitest run` | 59 files / 504 tests pass (~10 s) |
| `npm run build` | exit 0, "Compiled with warnings", 145 routes |
| `scripts/compliance-check.mjs` | 0 prohibited, 10 missing-disclosure warnings |
| `scripts/secret-scan.sh` | clean |
| Playwright e2e | NOT RUN — needs a live Supabase + env; `dispatch-rls.spec` self-skips without creds |
| `npm run audit` (route crawl) | NEVER RUN — `audit/FINDINGS.md` has never been committed |

## 3. Technology stack (VERIFIED)

Next.js 16.2 App Router, React 19, TypeScript 5, Tailwind 4, Zod 4, Supabase (`@supabase/ssr` + `supabase-js` 2.97), Vitest 3, Playwright 1.58, Sentry, Node `>=24 <25`, npm (package-lock). Vercel team `team_UzatfZkJUpFKABaO6cZTQUq7`, project `tmmt-ops` (`prj_Cw4lJPwwlYSyVWLvuo98nuk1r5gV`), production branch `master`, `ignoreCommand` = `scripts/vercel-ignore.sh` (docs-only commits never deploy — deliberate). Supabase project `uapxakmlwnpfsftfeezx` (PG 17): 165 tables (all RLS-enabled), 344 policies, 267 functions, 23 views, 9 pg_cron jobs, 7 edge functions, 240 applied migrations vs 45 repo files. Workspace package `packages/aixmos-core` (transpiled). Local dev has no `supabase/config.toml`.

## 4. Architecture (VERIFIED)

```
Browser ──(anon key, cookies)──▶ Next.js (Vercel)
   │  middleware.ts: host→tenant, public-path allowlist, JWT app_metadata.role → tier, fail-closed
   │  route groups: (admin)27 (command)14 (learn)11 (pocket)7 (operator)4 (program)4 (auth)3
   │                (executive|investor|partner|vendor)1 each, +36 ungrouped (forms, lp, legal, kits, build…)
   │  22 "use server" action files · 26 API routes (14 use service-role)
   ▼
Supabase Postgres ── RLS (is_platform_admin / is_staff / is_org_member) ── SECURITY DEFINER RPCs
   │  pg_cron ×9 · edge functions ×7 (intake, operator-checkin/provision, blast-operators, capture-drive, provision-on-payment, handoff-slack-notify)
   ▼
Integrations: GHL (8 webhook routes, 8 outbound fetches) · Twilio (inbound HMAC) · Stripe/Cal (per-slug webhooks, verify-only) ·
              Airtable (2 webhooks, 5 fetches) · ClickUp · Anthropic (8 s timeout+retry) · LiteLLM/Ollama (Pocket brain) ·
              Telegram/Slack/iMessage (owner fan-out) · Sentry · Mixpanel
Devices:      license plane (/api/license/*), partner flash-drive fleet (launchd scripts → PostgREST), captain :7777,
              ops-command intake, mesh/fleet shell scripts (not in the app)
```

Dependency graph: `src/` is a DAG (0 cycles, verified with madge 2026-08-22; not enforced). `src` imports `shared/` (compliance gates, owner-approval gate) and `config/` (verticals, identity) — both **outside** the Vercel `APP_PATHS`, see F-06.

## 5. Application surfaces (VERIFIED, Recon A)

110 `page.tsx`. Public: `/login*`, `/forms/*` (19 incl. catch-all), `/legal/*`, `/kits`, `/build*`, `/try`, `/upgrade`, `/dealers`, `/join`, `/lp/[org]/[sku]`, `/offline`, `/whoami`, `/clock` (signed-in). Gated by tier: owner=all; executive=`/executive`+desk; operator=`/operator*`+desk; vendor=`/vendor`; investor=`/investor`+`/partner`; staff=desk. `/money` owner-only. Layout-level checks exist only for `(admin)`, `(program)`, `(command)/dispatch`; every other group's auth is middleware-only (INFERRED risk if the matcher is ever bypassed).

API routes and gates: see table in Recon A (retained in `REMEDIATION_PLAN.md` appendix). Public by design: `/api/forms/submit`, `/api/leads/webhook`, `/api/health`, `/api/agent/health`, `/api/auth/callback`. Weak: `/api/license/heartbeat` (body `organization_id` + `hardware_uuid`, no secret). Plain `!==` secret compare: airtable ×2, ghl/overdue, ghl/voice, cron/journey-recompute, mission/generate.

Dead links shipped in nav/API responses (VERIFIED): `/fleet`, `/appointments` (command hub nav), `/internal/{sync,cases,dashboard,ledger}` (ops-command responses), `/client/{billing,credit,training,path,documents}` (journey alerts). The guard test `src/app/internal-links.test.ts` only scans JSX `href=` under `src/app`, so it cannot see these.

No no-op buttons, no "coming soon" pages, no `console.log` handlers found.

## 6. Data model (VERIFIED counts; entity narrative from `docs/DATABASE-SCHEMA.md` + `BUSINESS-REQUIREMENTS-SPEC.md`)

Canonical person `people`; leads `incoming_leads`; eligibility `background_checks.eligibility_status` (5 free-text states, three hard-coded copies in the app); decision trail `decision_events` + `v_decision_trail` (S3-03, live); customer standing `v_customer_standing` → `compute_good_standing` → `client_journey`; payments `customer_payments` (Title-Case free-text status); orgs `organizations` (96 tables carry `org_id`, 22 carry `organization_id` — two column names for one concept); roles `profiles.role` (DB) vs `org_roles` (org-scoped) vs JWT `app_metadata.role` (what the app actually reads); licensing `organization_licenses` + partner `partner_*` (parallel, unshared); tokens `tmmt_token_ledger`; money meter; agent `agent_conversations/messages`; dispatch `incidents/units/assignments`. Four tables have RLS with zero policies by design (`signup_invites`, `tmmt_token_ledger`, two snapshot tables). Schema drift: 195 applied migrations have no repo file (`supabase/schema/README.md`); no generated types anywhere.

## 7. Authentication / authorization (VERIFIED, Recon B)

- Identity: Supabase Auth email+password; sign-up invite-gated with hashed codes; server reads use `auth.getUser()` everywhere (no `getSession()`).
- Role source: **JWT `app_metadata.role` only** (`src/lib/auth-roles.ts`), mapped to tiers, unknown → `none`. `profiles.role` is not read by app code; `org_roles` only by dispatch. This means D-21's "`profiles.role='admin'` is read as platform admin" is a **database-side** (RLS helper) hazard, not an app-side one.
- Enforcement: middleware tier map (fail-closed on Supabase error) + layout checks in three groups + per-action checks in most server actions + RLS. No area relies only on client-side hiding.
- Tenant: org from host, inbound `x-aixmos-org` header deleted; writes stamp `acting_org_id()`. Exceptions: `/api/audit/events` writes `organization_id` verbatim (key-gated only); heartbeat trusts body `organization_id`.
- Abuse control: `src/lib/rate-limit.ts` is an in-memory Map per serverless instance — resets on every cold start, so it does not limit anything under fan-out. No captcha.
- Good patterns to keep: `ghl/webhook-auth.ts` (HMAC, timing-safe, 5-min replay, DB idempotency), `program-applications-server.ts` (single authz rule, 404-not-403), `workflow-actions.ts:320` (re-read ownership through RLS before service-role write).

## 8. External integrations (VERIFIED, Recon C)

Live and wired: GHL (in+out), Twilio inbound, Airtable, ClickUp, Anthropic, Pocket brain, Telegram/Slack/iMessage fan-out, Sentry, Mixpanel. Verify-only: Stripe, Cal.com (per-slug secrets, undocumented in `.env.example`, no event dedupe). Built but **no production caller**: `twilio-send.ts` (the only gated SMS sender), `ghl/client.ts sendConversationMessage` (ungated). Dead in env/docs: OpenAI, NVIDIA, CREDIT_ENGINE_*, n8n, Resend/SMTP. No GHL fetch has a timeout or retry. **No code moves money** — checkout is URL redirects to GHL; a structural test blocks any Stripe money call without a gate reference.

## 9. Machine / device integrations (Recon D) — verification classes

| Path | Class | Notes |
|---|---|---|
| License plane `/api/license/{provision,heartbeat,revoke}` | CODE VERIFIED | provision = one-time SHA-256 token; heartbeat = `organization_id`+`hardware_uuid` only (uuid echoed into `audit_events`); revoke = `X-Admin-Key` timing-safe. No in-repo client. No device→server ack of a wipe. |
| Partner flash-drive fleet (`scripts/partner-deploy/**`, launchd → PostgREST) | CODE VERIFIED as scripts; NOT VERIFIED deployed | anon key + tenant id; `heartbeats_anon_insert` lets any anon-key holder forge heartbeats/audit rows for any tenant; soft-disable/legal-hold markers are read by nothing; only `wipe` enforces. Parallel to the license plane, no shared code. |
| Captain dispatch `:7777` | NOT VERIFIED | server not in repo; client fails open to null. |
| Pocket brain (Ollama/LiteLLM) | CODE VERIFIED | 30 s timeout, token refund on failure. |
| Ops command intake | CODE VERIFIED (route) / NOT VERIFIED (driver) | bearer, timing-safe, fail-closed; `command_router.py` is external. |
| Telegram notify | CODE VERIFIED | fire-and-forget. |
| Offline desk merge | CODE VERIFIED | session + tier + `acting_org_id()`. |
| Mesh/fleet shell scripts (`scripts/mesh`, `swarm.sh`, `FLEET-UP.sh`) | scripts only | not in the deployed app. |
| `mesh_nodes` table + 2 functions | DB-only orphan | no migration file, zero `src` references. |

Claims the code does not implement (VERIFIED): "HMAC" is unkeyed SHA-256; "Secure Enclave attestation" only stores a public key; "license JWT" is an unsigned digest with no consumer; `bin/issue-key` references `src/lib/license.ts`, which does not exist; `HOUSE_ORGS` hard-coded allowlist bypasses licensing. REAL DEVICE VERIFIED: **nothing** in this audit.

## 10. Critical user journeys (status = evidence available today)

| # | Journey | Status | Evidence |
|---|---|---|---|
| J1 | Public lead form → `incoming_leads` → routing → GHL | PARTIAL | unit tests on catalog/routing; e2e smoke exists but NOT RUN here; org-id regression pinned |
| J2 | Background check submit → staff queue → decide (7-arg) → trail | PASS (unit) / NOT E2E | `queries.test.ts` 15 tests; shipped in `0890d02f` |
| J3 | Login → tier → correct home; wrong tier bounced | PASS (unit) / NOT E2E | `auth-roles.test.ts`; middleware untested |
| J4 | Operator claims lead / cross-refers | PARTIAL | `lead-pool.test.ts`; actions untested |
| J5 | Inbound SMS → agent reply | BROKEN (compliance) | replies bypass `assertSmsAllowed`; `opted_out` never read; no `MessageSid` dedupe (fix exists only on divergent `main`) |
| J6 | GHL payment webhook → `customer_payments` → affiliate accrual | PASS (unit) | `ghl-payment-sync.test.ts`, `referrals.test.ts`; route untested |
| J7 | License provision → heartbeat → kill | CODE VERIFIED / INSECURE | see §9 |
| J8 | Learn funnel → application → submit | BROKEN (fake) | `submitApplicationStub` marks "submitted" with `AIX-STUB-` ref in production |
| J9 | Dispatch incident → assignment | PARTIAL | `dispatch-rls.spec` (needs creds); actions untested |
| J10 | Offline merge | CODE VERIFIED | route untested |
| J11 | Pocket chat with token metering | PASS (unit) | `token-ledger.test.ts` |
| J12 | Ops command → fan-out | CODE VERIFIED | route untested |

## 11. Current problems (summary; full register in `REMEDIATION_PLAN.md`)

**P0** — live SMS path has no opt-out read, no replay dedupe, bypasses the A2P gate; DNC list referenced nowhere.
**P1** — fake "AI reviewed" fallback; fake lender submission in prod; compliance-gate edits under `shared/`/`config/` never deploy; heartbeat/audit-ingest trust body org id; partner-plane forgeable heartbeats; mislabeled security claims in shipped code/docs.
**P2** — in-memory rate limiter; 5 non-timing-safe secret compares; Stripe/Cal no event dedupe; GHL idempotency silently degrades; 8 dead links; CI required-check name mismatch; phone normalizer disagreement; pricing constants in 4 places; `CUBE_DEMO_CONTROLS` on any non-production deploy.
**P3** — 27/28 API routes and 22/22 action files untested; tests/build not in pre-push; 39 env vars undocumented; 9 Supabase client sites (4 service-role factories without `server-only`); five role vocabularies; two money/date formatters with different output; no rollback runbook; DEPLOY.md stale; 195 migrations missing from repo; DB advisor: 876 multiple-permissive policies, 44 initplan, 59 unindexed FKs.
**P4** — dead directories (`apps/engine`, `aria`, `web/build-page`, `config-from-lexar`, `imports/finance`), 40 lint warnings, unused indexes ×151.

## 12. Unknowns requiring the owner

1. Are partner flash-drive tenants live anywhere? (decides P1 vs latent for the partner plane)
2. Should `/learn/status` submission be hidden until a real lender path exists, or is the stub acceptable behind an explicit "demo" banner? (product behaviour)
3. Which of `apps/engine`, `aria`, `web/build-page`, `config-from-lexar`, `imports/finance` may be deleted? (irreversible)
4. Is `HOUSE_ORGS` bypass of licensing intended to stay in shipped code?
5. Is the divergent `main` branch to be salvaged (SMS fix) then retired?
6. D-9/D-19 reason codes, D-21 tenancy migration, DB advisor cleanups — all production writes, owner-gated.

## 13. Session continuity

Last updated 2026-09-08 by the recovery-lead session. Worktree `C:\dev\TMMT-audit-wt`, branch `audit/app-recovery-20260908`. Shared checkout `C:\dev\TMMT-LIVE` belongs to sibling sessions — never reset/clean it. Next step: execute `REMEDIATION_PLAN.md` Batch 1.
