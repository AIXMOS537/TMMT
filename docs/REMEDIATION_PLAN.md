# REMEDIATION PLAN — tmmt-ops

**Work queue for application recovery. Ordered by dependency, root cause before symptom.**
Baseline `origin/master = a88d8087` (2026-09-08). Map: `PROJECT_AUDIT.md`. Owner decisions: `docs/commercialization/OWNER_DECISIONS.md`.

Rules: smallest coherent change per batch · no fake success, no weakened tests, no `any`, no removed security checks · production DB writes, money, external sends and deploy config are OWNER-GATED (D-18) · every fix gets a regression test where one can exist · update this file before ending a session.

Severity: **P0** data loss / security / unusable · **P1** critical workflow broken · **P2** important defect · **P3** architecture/reliability · **P4** polish.
Status: TODO · IN PROGRESS · DONE (commit) · BLOCKED (why) · OWNER (decision id).

---

## Batch 1 — app-only, no owner decision needed (start here)

| ID | Sev | Area | Symptom | Root cause | Files | Fix | Verify | Risk | Status |
|---|---|---|---|---|---|---|---|---|---|
| F-01 | P0 | SMS agent | Opted-out lead still gets a full LLM reply; Twilio retry re-runs LLM + re-inserts + re-sends | `incoming_leads.opted_out` written at `sms/inbound/route.ts:121` but never read; no `MessageSid` idempotency | `src/app/api/agent/sms/inbound/route.ts`, `src/lib/agent/process-inbound.ts` | Port the divergent-`main` fix `8dfb6b7c` onto master: read `opted_out` before replying (clear on opt-in), record `MessageSid`. The unique-index migration (`agent_messages.provider_message_sid`) goes to `supabase/migrations/_staged/` — **applying it is OWNER-GATED**; until applied, the SID is recorded but not enforced, so also add an app-side pre-check `select 1 from agent_messages where provider_message_sid = $sid`. | New `route.test.ts` (from `main`, adapted): opt-out honoured, replay dropped before LLM | Medium: route rewrite; keep Twilio signature + guard order | DONE b09da410 (PR #194); index STAGED |
| F-02 | P0 | SMS agent | Live TwiML reply path never calls the shared A2P gate | Replies are built as TwiML, not via `sendSms()`; `assertSmsAllowed` only wired in the unused `twilio-send.ts` | `src/lib/agent/process-inbound.ts` (reply construction) | Call `assertSmsAllowed({vertical, type:'transactional'})` before returning a reply body; on HOLD return empty TwiML and log a structured line | Unit test: restricted vertical + marketing → blocked; transactional → allowed | Low | DONE b09da410 (PR #194) |
| F-03 | P0 | Outbound messaging | No code path consults a do-not-contact list; `sendConversationMessage`/`addContactTag` have no gate | Gate exists only around the Twilio SDK; `owner-approval-enforcement.test.ts` only matches `twilio`/`stripe` imports | `src/lib/ghl/client.ts`, `shared/compliance-gates/*`, `src/lib/owner-approval-enforcement.test.ts` | Wrap `sendConversationMessage` and `addContactTag` in a `assertOutboundAllowed()` that checks `assertSmsAllowed` + opt-out + DNC (DNC read is against `do_not_contact_numbers`, read-only). Extend the structural test to fail on ungated calls to these two functions. | Unit tests per gate; structural test red→green | Low today (0 callers), prevents the next wiring from being ungated | DONE b09da410 (PR #194); addContactTag → F-03b |
| F-04 | P1 | Ops AI review | `fallbackReview()` returns `aligned:true, score 0.5` when Anthropic is unset or errors — "AI passed" is fabricated | `src/lib/ops-ai.ts:26-28,150-158` | Return `{reviewed:false, reason}`; callers in `ops-actions.ts` must refuse to publish on `reviewed:false` and show the reason | Unit: no key → not reviewed; publish blocked | Low | DONE ae1a3c22 (PR #195) |
| F-05 | P1 | Learn funnel | `/learn/status` marks an application "submitted" with a fabricated `AIX-STUB-` reference; no lender is called | `packages/aixmos-core/src/submission-adapter.ts:22-27` wired as the live adapter | Make submission require an explicit `NEXT_PUBLIC_LEARN_SUBMISSION_MODE=demo` to use the stub; default (unset) renders "Submission not yet available" and does not change state. Keep the stub for demos. | Unit on the adapter selector; page shows unavailable state by default | Low; **product behaviour** — flagged as Unknown #2, proceed with safe default | NO CHANGE NEEDED — button already hidden unless `CUBE_DEMO_CONTROLS`; staff manual-packet path is the real one (VERIFIED in `learn/status/page.tsx`) |
| F-06 | P1 | Deploy | Edits to `shared/` (compliance gates, owner-approval gate) and `config/` (verticals, identity, tenant JSON) never trigger a production deploy | `scripts/vercel-ignore.sh` `APP_PATHS` omits them; also lists a non-existent `sentry.client.config.ts` | `scripts/vercel-ignore.sh` | Add `shared config eslint.config.mjs` to `APP_PATHS`; drop the missing sentry file | Verified on real commits: config-only 784b64bf SKIP→BUILD, docs-only 36c4ef16 SKIP→SKIP | None | DONE 47ab5201 (PR #193) |
| F-07 | P2 | Secrets | Plain `!==` secret compare (timing side-channel) | Each route hand-rolls its check | `api/webhooks/airtable/route.ts:24`, `airtable/locations/route.ts:26`, `webhooks/ghl/overdue/route.ts:22`, `agent/voice/ghl/route.ts:39`, `cron/journey-recompute/route.ts:11`, `mission/generate/route.ts:12` | Use `timingSafeEqualString` from `src/lib/ghl/webhook-auth.ts` (export it or move to `src/lib/secure-compare.ts`) | Unit test on the helper; route tests for 401 on mismatch | Low | DONE ac2b0edb (PR #195); 7 routes (marketing-kpi-ghl added) + structural test |
| F-08 | P2 | Navigation | 8 dead links shipped | Links live in `src/lib` object literals; guard test only scans JSX under `src/app` | `src/lib/command-hub-nav.ts:46,52`, `src/lib/ops-command/execute.ts:27-29,251,258`, `src/lib/client-journey/journey-alerts.ts` | Point `/fleet`→`/interfaces/vehicles`, `/appointments`→`/interfaces/appointments`; `/internal/*` and `/client/*` → existing equivalents or remove; extend `internal-links.test.ts` to scan `href:` literals in `src/lib` | Extended test red→green | Low | DONE ae1a3c22 (PR #195); link guard now scans src/lib |
| F-09 | P2 | CI gate | Documented required check `verify` never matches the job name `brands · lint · test · build`; unit tests and build absent from pre-push | `.github/workflows/verify.yml` job name; `verify.checks` has `test`/`build` commented out with a stale note | `verify.yml`, `verify.checks`, `.github/workflows/session-autopilot.yml` | Give the job `id: verify` and a stable `name: verify`; add `test|npx vitest run` and `brand|npm run brand:check` to `verify.checks` (both ~10 s); leave `build` for CI | Push a branch; confirm check names in `gh pr checks` | Low; branch protection itself is an owner setting | DONE ac2b0edb (PR #195). NOTE: branch protection is unavailable on this GitHub plan (403 Pro required) — pre-push gate is the real gate |
| F-10 | P2 | Demo controls | Role-switcher active on any non-`production` deploy (previews) | `src/lib/cube-demo-controls.ts:19-21` keys on `NODE_ENV` | Key on explicit `NEXT_PUBLIC_CUBE_DEMO_CONTROLS === "1"` only | Unit test | Low | NO CHANGE NEEDED — `NODE_ENV=production` in every Vercel build incl. previews; switch is dev-only (VERIFIED) |
| F-11 | P2 | Rate limit | In-memory Map per instance; ineffective under serverless fan-out | `src/lib/rate-limit.ts` | Back with a Postgres RPC (`rate_limit_hit(key, window, max)` on a small table) with in-memory fallback; **RPC creation is OWNER-GATED** → stage the migration, wire the app to use it when present | Unit on fallback; RPC test SQL in `_staged/` | Medium | DONE (app half) / OWNER (migration) |
| F-02b | P3 | SMS agent | Org → A2P vertical is proxied by `partner_app_slug`; no org maps to a restricted vertical today | `organizations` has no vertical column | `src/lib/outbound-gate.ts orgSmsVertical` | Add `organizations.sms_vertical` (**OWNER-GATED** migration) and read it | Gate test with a restricted org | Low | OWNER |
| F-03b | P2 | Outbound messaging | `addContactTag` (10 call sites) can fire GHL automations that message people; no gate | tag API takes a contact id, not a phone | `src/lib/ghl/client.ts`, callers | Resolve phone from the GHL contact (one lookup) and run the outbound gate before tagging; or classify tag-driven automations as owner-approved workflows | Unit per call site | Medium | TODO (needs owner view on tag-driven sends) |

## Batch 0 — P0 found after the initial audit (2026-09-08 afternoon)

| ID | Sev | Symptom | Evidence | Fix | Status |
|---|---|---|---|---|---|
| F-31 | **P0** | `public.is_internal_ops()` FAILS OPEN: returns true when `profiles` is missing and on ANY exception (`exception when others then return true`). It gates **18 policies on 8 tables** (cases, credit_funding_sessions, credit_payment_schedule, crm_sync_records, customer_intake_forms — a `{public}` policy on intake PII —, program_applications, program_audit_log, sync_events), including two DELETE policies. Every sibling helper (`is_staff`, `is_platform_admin`, `is_org_member`) is LANGUAGE sql and fails closed. | VERIFIED 2026-09-08 from `pg_get_functiondef` and `pg_policies`; fix NOT in `schema_migrations` | Fix commit `46ceeab6` is pushed on `docs/owner-action-sheet` and included in `origin/master` by merge `aa2e4d32`; migration `20260908120000_is_internal_ops_fail_closed.sql` rewrites the predicate as LANGUAGE sql with no handler, leaves policies untouched, and deliberately preserves `investor`. **Production DDL — OWNER applies (D-18).** | OWNER (apply) |
| F-32 | P1 | 13 `org_id`-bearing tables/views have zero org-scoped policy (`cases`, `customer_payments`, `background_checks`, `documents`, `insurance`, `intake_events`, `agent_jobs`, `automation_outbox`, `comm_channels`, `installations`, `v_customer_standing`, `incident_assignments_v`, `customer_payments_snapshot_20260706`) | REPORTED by the sibling session, on master in `docs/security/TENANT-ADMIN-INVARIANT.md`; not re-verified here | Extends D-21 from two tables to a matrix; design the `is_org_member` migration once, apply table-by-table under the gate | OWNER (D-21) |
| F-33 | P2 | Unattributed concurrent edits appeared inside this session's worktree `C:devTMMT-audit-wt`: `.gitattributes` (LF for shell scripts), `scripts/verify.sh`, `content/consumer-facing/{README,disclaimer}.md`, `src/components/Sidebar.tsx`, `src/app/(command)/command/credit-dispute/page.tsx`, `src/lib/credit-dispute/engine/deep-audit.ts`, a constant-time compare in `api/cron/marketing-kpi-ghl/route.ts` (adopted into PR #195 with a note), and a `git add` of everything. Neither Claude session wrote them. | git status in the worktree; sibling session's commit inventory | Preserved: full staged state saved to `.aixmos/unattributed-staged-audit-wt.patch` in the shared checkout before unstaging (working tree untouched). Owner or the third writer decides disposition. Not committed by this session. Update: the third writer's 8 commits reached master in `aa2e4d32` (docs, e2e specs, the F-31 migration file); none of the edits inside `C:devTMMT-audit-wt` were among them, so those stay unattributed. | PRESERVE |

## Batch 2 — consistency and consolidation (after Batch 1 is green)

| ID | Sev | Area | Symptom | Fix | Status |
|---|---|---|---|---|---|
| F-12 | P2 | Phone normalisation | Two implementations disagreed (`leads/webhook/route.ts` rejected non-NANP; `people/upsert.ts` never rejected) | `src/lib/phone.ts` keeps both policies, named (`normalizeNanpPhone` strict for public entry points, `normalizePhoneLoose` for existing records); both callers import the one they mean; no behaviour change | DONE a6140925 (PR #196) |
| F-13 | P2 | Pricing constants | 4 unsynchronised tables (`SKU_PRICE_CENTS`, `PROGRAM_SKUS`, `highTicketTiers`, two `9700` consts) | One `src/lib/pricing/catalog.ts` **that only re-exports the values that exist today** — no new prices (D-1 is open); callers import from it | TODO |
| F-14 | P3 | Supabase clients | 9 construction sites, 4 service-role factories without `server-only` | Collapse to `supabase-service.ts`; delete `agent/supabase-server.ts` after re-pointing 12 importers | TODO |
| F-15 | P3 | Role vocabularies | 5 definitions (`AppRoleToken`, `USER_ROLES`, `AccessTier`, `OperatorTier`, verticals stages) | Make `auth-roles.ts` the source; derive `USER_ROLES`; add a test that the DB enum list matches | TODO |
| F-16 | P3 | Eligibility status | Free text with 3 hard-coded copies | Import `BG_CHECK_DECISIONS` from `queries.ts` everywhere; test that the copies are gone | TODO |
| F-17 | P3 | Formatting | Two `formatCurrency`/`formatDate` with different output | Re-export `src/lib/utils.ts` versions from `packages/aixmos-core`; delete duplicates | TODO |
| F-18 | P3 | Idempotency | Stripe/Cal webhooks have no event-id dedupe; GHL degrades silently to in-memory | Reuse `consumeGhlEventId` pattern with a generic `webhook_events` table (**OWNER-GATED** migration) + loud metric when fallback engages | TODO / OWNER |
| F-19 | P3 | Timeouts | No GHL/Airtable/ClickUp fetch has a timeout | One `fetchWithTimeout()` helper (8 s default) used by all outbound clients | DONE 315ccdd2 (PR #197); 25 sites in 11 files + structural bare-fetch guard |

## Batch 3 — tests where none exist (interleave with Batch 1/2 fixes)

| ID | Sev | Target | Minimum coverage | Status |
|---|---|---|---|---|
| T-01 | P3 | `src/middleware.ts` | public paths, tier map, fail-closed on Supabase error, org header stripped | TODO |
| T-02 | P3 | Webhook routes (ghl ×6, airtable ×2, stripe, cal, twilio) | signature/secret rejection, idempotent replay, happy path with mocked DB | TODO (F-01, F-07 create the first ones) |
| T-03 | P3 | Server actions with authz (`operators`, `dispatch`, `credit-dispute`, `workflow`, `document`) | non-staff rejected, org-scoped access enforced | TODO |
| T-04 | P3 | License plane routes | provision one-shot, heartbeat kill path | TODO (after F-20 design) |
| T-05 | P3 | Structural | `internal-links` scanning `src/lib`; outbound-send gate test (F-03) | TODO |

## Batch 4 — device/licensing hardening (needs owner scope; design first)

| ID | Sev | Symptom | Proposed correction | Status |
|---|---|---|---|---|
| F-20 | P1 | Heartbeat authenticates with `hardware_uuid` alone, which the app echoes into `audit_events`; `/api/audit/events` trusts body `organization_id` | Issue a per-installation secret at provision (already returns a digest — make it the credential), require it on heartbeat/audit ingest, bind `organization_id` server-side from the credential | OWNER (protocol change; devices must be re-provisioned) |
| F-21 | P1 | Partner plane: any anon-key holder can forge heartbeats/audit rows for any tenant; soft-disable/legal-hold read by nothing | Tighten `heartbeats_anon_insert`/audit policies to require the redeemed install token; or fold the partner plane into the license plane | OWNER (DB policy change; are partner tenants live? Unknown #1) |
| F-22 | P2 | Mislabeled security claims in code/docs (HMAC, attestation, JWT, `bin/issue-key` → missing `src/lib/license.ts`) | Correct the comments/docs now (no behaviour change); implement real signing under F-20 | TODO (docs) / OWNER (impl) |
| F-23 | P2 | `HOUSE_ORGS` static licensing bypass | Move to a DB flag on `organizations` (`license_exempt`) — **OWNER** | OWNER |

## Batch 5 — hygiene and cleanup (only after functionality is verified)

| ID | Sev | Item | Status |
|---|---|---|---|
| F-24 | P3 | `.env.example`: add the 39 env vars the code reads (names only), remove the 10 it never reads | TODO |
| F-25 | P3 | Rollback runbook: none exists; add `docs/ROLLBACK.md` (Vercel promote previous READY, migration down.sql order, revoke paths) | DONE faff2926 (PR #198) |
| F-26 | P3 | DEPLOY.md: "every push to master deploys" is stale (ignoreCommand) | DONE faff2926 (PR #198) |
| F-27 | P3 | `scripts/circular-deps.mjs` and `brand:check` not enforced anywhere | add to `verify.checks` (F-09) | TODO |
| F-28 | P4 | Dead directories: `apps/engine`, `aria`, `web/build-page`, `config-from-lexar`, `imports/finance` | OWNER (Unknown #3) — deletion is irreversible | OWNER |
| F-29 | P4 | 35 repo-wide hook-pattern lint warnings remain after local unused-code cleanup | TODO |
| F-30 | P3 | Schema of record: 195 applied migrations missing from repo; `mesh_nodes` orphan | run `scripts/migrations-pull.mjs` (needs DB URL — OWNER supplies) | OWNER |

## Owner-gated production items (tracked, not executed)

| Item | Decision | Notes |
|---|---|---|
| Apply `agent_messages.provider_message_sid` unique index (F-01) | D-18 gate | staged migration + rollback + test SQL shipped with F-01 |
| Customer #2 tenancy migration (`customer_payments`, `background_checks` → `is_org_member`) | D-21 | not written yet |
| Seed `reason_codes` | D-9 / D-19 | business policy |
| DB advisor: 876 multiple-permissive policies, 44 `auth_rls_initplan`, 59 unindexed FKs, 151 unused indexes, 2 extensions in `public`, 2 anon-executable SECURITY DEFINER fns (`eval_money_rails` token-guarded, `submit_customer_intake` input-capped — both intentional), leaked-password protection off | owner | performance items are safe but still prod DDL |
| Vercel branch protection / required checks | owner | F-09 makes the names stable first |

## Verification log

| Date | What | Result |
|---|---|---|
| 2026-09-08 | Baseline on `a88d8087` (worktree) | tsc 0 · lint 0/40w · vitest 504/504 · build exit 0 · compliance 0 prohibited · secrets clean · e2e NOT RUN · crawl NEVER RUN |

## Exact next step

Batch 1, F-06 first (one-line deploy gate fix, zero risk), then F-01/F-02/F-03 together as one PR ("SMS compliance"), then F-04, F-05, F-07, F-08, F-09, F-10. Each PR: branch from `origin/master`, tests, `verify.checks` gates, CI green, PR for owner merge.

## Appendix — API route gate table (from Recon A, 2026-09-08)

public: `/api/health`, `/api/agent/health`, `/api/auth/callback`, `/api/forms/submit` (+IP RL, +CORS), `/api/leads/webhook` (+RL, +CORS, service role), `/api/agent/voice/ghl` GET.
signature: `/api/agent/sms/inbound` (Twilio), `/api/agent/stripe/webhook/[slug]`, `/api/agent/cal/webhook/[slug]`, `/api/webhooks/ghl*` (HMAC or secret), `/api/webhooks/ghl/{contact,appointment,form}`.
shared secret: `/api/webhooks/airtable*`, `/api/webhooks/ghl/overdue`, `/api/cron/*`, `/api/mission/generate`, `/api/ops/command` (timing-safe), `/api/audit/events` (timing-safe), `/api/license/revoke` (timing-safe).
session: `/api/offline/merge`, `/api/pocket/chat`, `/api/cube/application` (per-row token).
weak: `/api/license/heartbeat`; one-time token: `/api/license/provision`.
