# E5 — Credit Center, AIXMOS, Security Model (evidence)

- Worker: E5, TMMT master product extraction. Date: 2026-09-21.
- Canon: `AIXMOS537/TMMT` @ `origin/master` `4cca6835` (worktree `C:\dev\wt-master-extraction`).
- Method: read-only. Code reads, prod catalog reads, and aggregate `count(*)` on project `uapxakmlwnpfsftfeezx`. No row contents were read from credit, dispute or PII tables. One read-only simulation was run as `authenticated` inside `BEGIN READ ONLY … ROLLBACK` to test the `org_roles` recursion. No writes of any kind. No secrets printed.
- Status words used: EXISTING/WORKING, EXISTING/PARTIAL, EXISTING/BROKEN, PLACEHOLDER, ORPHANED, LEGACY, PLANNED ONLY, MISSING, UNKNOWN.
- Earlier audits this builds on (not redone): `Desktop\TMMT-PHASE-2\TMMT_CREDIT_ENGINE_MASTER_AUDIT.md` (written against `e1b683ff`), `CREDIT_ENGINE_RECOVERY_MAP.md`, `PHASE_2A_SECURITY_EXECUTION_PLAN.md`. Master has moved 4 commits since `e1b683ff` (the `/lp/aixmos` page, Airtable docs, command-hub tenant resolution). None of them touch credit code, so the earlier credit findings still apply to `4cca6835`. Each one repeated here was checked again against the code.

---

## Corrections to the brief (checked today)

1. **PR #224 is MERGED, not on hold.** `gh pr view 224` → `state: MERGED`, `mergedAt 2026-09-21T21:59:38Z`. It is titled "Credit compliance rails, letter engine, brain ingestion (25 orphaned commits) — merge trap resolved". Merge commit `e41b50e5` is an ancestor of `4cca6835`, and so is the CROA letter-gate commit `24e44777`. **D-22b (perform vs refer) is still OPEN.** `croa-gate.ts` says the owner chose to perform credit repair in-house, but the gate that makes this lawful (`croa_contracts_attorney_approved`) is still `false`.
2. **The profiles self-escalation fix IS on prod. Marked CLOSED** (see §C.2).
3. **The `org_roles` 42P17 recursion is CONFIRMED on prod today.** It fails closed (see §C.4).

---

# A. CREDIT CENTER

The owner decided on 2026-09-16 that the credit engine is ACTIVE and part of the rental journey. The code backs this up: it is a real product domain. It is owner-operated and gated, and the customer-facing half does not exist yet.

## A.1 Component inventory (master `4cca6835`)

| Component | Path | Status | Evidence |
|---|---|---|---|
| Owner desk (list/select, assessments, gated rounds) | `src/app/(command)/command/credit-dispute/page.tsx` (437 lines, client component) | EXISTING/PARTIAL | Server actions `listDisputeClients/recordItemAssessment/addDisputeRoundsForClient` (actions.ts:43,173,117). Letters come from `runGatedDisputeProtocol` (page.tsx:18). |
| Owner desk per-client page | `.../credit-dispute/[id]/page.tsx` | EXISTING/BROKEN | `handleGenerate` calls **ungated** `runDisputeProtocol` (`[id]/page.tsx:9,40`), which skips the accuracy policy. Storage is blocked today only by the CROA gate (actions.ts:126). |
| Server actions / authZ | `.../credit-dispute/actions.ts` (257) | EXISTING/WORKING | `requireOwner()` = `isOwnerUser` → `app_metadata.role === 'admin'` (auth-roles.ts:52-56,108-110). The request-scoped client means RLS `dispute_clients_admin_only = is_platform_admin()` (i.e. `profiles.role='admin'`) enforces access. This is a split-brain check: the app reads JWT `app_metadata`, the DB reads `profiles.role`. Both fail closed. |
| Report importers | `src/lib/credit-dispute/importers/{disputefox,myfreescorenow,shared}.ts` + `import/page.tsx` | EXISTING/PARTIAL | Manual paste/CSV. No provider API. The CSV splitter is naive (earlier audit §13.7). SmartCredit importer deleted 2026-09-01. `ReportSource` type still lists `smartcredit` (store.ts:5). |
| Credit store | `dispute_clients` (JSON `payload`) | EXISTING/PARTIAL | Columns: id, client_name, email, source, external_id, payload, imported_at, created_at, updated_at. **No org_id.** SSN last 4, DOB, address and scores sit inside `payload` (actions.ts:14-15 comment; letters/advanced.ts clientBlock). **0 rows on prod.** |
| Legacy browser store rescue | `src/lib/credit-dispute/data/store.ts` | LEGACY (one-way rescue) | `readLegacyClients/clearLegacyClients` for the `aix-dispute-clients` localStorage key. Nothing writes to it. |
| Credit audit (heuristics) | `engine/deep-audit.ts` (271) | EXISTING/PARTIAL | Used by the desk (`deepAuditAll`, page.tsx:21,111). Outputs `removalProbability 0-100` and `confrontationalFact`. ⚖️ COMPLIANCE REVIEW: heuristic flags are shown as FCRA/Metro-2 "violations", and they come with a removal-probability number. |
| Accuracy policy (judgement layer) | `policy/dispute-policy.ts` (553) + tests | EXISTING/WORKING | Rule: no letter without a recorded factual basis. Accurate items get coaching, not a dispute. |
| Gated protocol | `engine/gated-protocol.ts` → `letters/render-from-decision.ts` | EXISTING/WORKING (main desk only) | The only sanctioned decision→letter path. |
| Ungated protocol | `engine/protocol.ts` (`runDisputeProtocol`, `AGGRESSIVE_FCRA_PROTOCOL`) | EXISTING/BROKEN (still wired) | Still reachable from the `[id]` page. |
| Letter generator | `letters/generator.ts` (522) | EXISTING/WORKING (renderer) | Individual `generate*` exports have no callers (ORPHANED). |
| Advanced letters (Metro-2, cease & desist) | `letters/advanced.ts` (203) | ORPHANED | No importers in src. |
| CROA compliance gate (hard) | `shared/compliance-gates/gate.ts` + `gates.config.json` | EXISTING/WORKING | `croa_contracts_attorney_approved=false`, `vdacs_registered_bonded=false`, `no_advance_fee_billing_enforced=false`, `sbf_broker_registered=false`, `multistate_matrix_cleared=false`. Only `croa_contracts_attorney_approved` is checked by any code (actions.ts:126). |
| CPN / rented-tradeline ban | `gate.ts assertNoCpnOrRentedTradelines` | ORPHANED | **No call site in src.** The "permanent prohibition" is not enforced on import or intake. |
| CROA engagement/fee model | `policy/croa-gate.ts` (239) + test | ORPHANED | Imported only by its own test. No UI or billing caller. |
| Attorney gate | same as CROA gate | EXISTING/WORKING (closed) | Letters cannot be stored. The owner must get counsel sign-off (gates.config.json `owner_action_required`). |
| Funding readiness (business) | `engine/funding-readiness.ts` (161) | EXISTING/PARTIAL | Desk-only, score tiers 620/680/720/760. `estimateScoreImpact` is shown on the desk (page.tsx:23,112). ⚖️ Score-projection surface: owner-only today. Must never face customers. |
| Auto-financing readiness (Drive-to-Own) | `src/lib/drive-to-own/financing-readiness.ts` (305) + `FinancingReadinessPanel` on `/status/[token]` | EXISTING/PARTIAL | Explicit rules: "readiness is not approval", no probability of approval, highest stage `ready_to_apply`, consumer pulls their own MFSN report. ⚖️ Its own header says any use to decline or price a rental = adverse action and needs counsel. |
| Public credit/funding intake | `src/app/forms/credit-funding-intake/page.tsx` → `submitCreditFundingIntake` (forms/actions.ts:732) → `credit_funding_sessions` | EXISTING/WORKING | Educational only, no SSN/DOB/hard scores (actions.ts:648). Checks banned terms. Stores disclaimer flags (`no_outcome_promised`, `ai_disclaimer_shown`). **1 row.** Anon INSERT policy `true`. No rate limit in this action (see §C). |
| Admin review of intake | `src/app/(admin)/credit-funding/page.tsx` | EXISTING/WORKING | `isStaffUser` gate (page.tsx:37-38). |
| Credit enrollment/billing tables | `credit_enrollments`, `credit_billing_plans`, `credit_payment_schedule`, `credit_education_acknowledgments`, `credit_product_catalog`, `credit_education_sections` | EXISTING/PARTIAL (schema + drive-to-own readers) | **All 0 rows.** Read by `lib/client-journey/*` and `lib/drive-to-own/*`. There is no billing writer, and the `no_advance_fee_billing_enforced` gate is never checked. |
| Legal page | `src/app/legal/credit/page.tsx` | EXISTING/WORKING (content not legally reviewed here) | — |
| GHL tag constants | `src/lib/credit-dispute/ghl-tags.ts` | ORPHANED (no writer) | Imported for display only. |
| Unapplied normalized schema | `supabase/migrations/20260707120000_dispute_engine.sql` (+ `_rls`) | ORPHANED | Catalog check: none of `tradelines`, `negative_items`, `dispute_rounds`, `croa_contracts`, `credit_profiles` exist on prod. |
| Workstream docs | `workstream-2-credit-funding/{intake,dispute-engine,funding-desk,tradeline-tracker,compliance}/README.md` | PLANNED ONLY | README-only folders. |

Prod counts (aggregate only): dispute_clients 0 · credit_enrollments 0 · credit_billing_plans 0 · credit_payment_schedule 0 · credit_education_acknowledgments 0 · credit_funding_sessions 1.

RLS on credit tables (prod catalog):
- `dispute_clients`: one policy, `dispute_clients_admin_only ALL is_platform_admin()`. **Locked to platform admin, confirmed.**
- `credit_enrollments`, `credit_billing_plans`, `credit_payment_schedule`, `credit_funding_sessions`: each has an `*_org_all` policy `is_staff() OR (org_id IS NOT NULL AND is_org_member(org_id))`. Permissive policies OR together, so the stricter `credit_enroll_staff` (which adds `org_has_module('credit_repair')`) is **made redundant** by `credit_enrollments_org_all`: any staff user gets full access without the module check. Customer self-read goes by email match (`current_profile_email()`).
- `credit_funding_sessions` has 7 overlapping policies, including `anon_insert … true`.

## A.2 Target journey status (master code + prod)

| Step | Status | Evidence / gap |
|---|---|---|
| CREDIT REPORT | EXISTING/PARTIAL | Manual paste/CSV importers (DisputeFox, MFSN). No file upload, no provider pull. Stored as JSON in `dispute_clients.payload` (0 rows). Consumer self-pull via MFSN is the stated model (financing-readiness.ts header). |
| ITEM | EXISTING/PARTIAL | `payload.negativeItems` only. Positive tradelines are dropped. No normalized item table on prod. |
| CUSTOMER-ASSERTED ERROR | MISSING on master · **in progress in C1** (`policy/assertion.ts`, `assertion-panel.tsx`, uncommitted) | Master has only the staff `FactualBasis` enum through `recordItemAssessment`. |
| EXPLANATION | EXISTING/PARTIAL | `FactualBasis` + reason on the assessment (dispute-policy.ts). It is staff-entered, not customer attestation. |
| EVIDENCE | MISSING on master · C1 adds `EvidenceRef` type (no storage bucket, no table) | Buckets on prod: `staff-documents`, `vehicle-media`, `program-documents`. None is for credit. |
| CASE | EXISTING/PARTIAL (the client record acts as the case) · C1 adds `case-state.ts` + staged `20260922120000_credit_case_foundation_STAGED.sql` (NOT applied) | No org_id, no case table. |
| REVIEW | EXISTING/PARTIAL | The owner's accuracy call is persisted (`recordItemAssessment`). No reviewer≠drafter rule and no audit events on master. C1 adds `needs_review→approved/returned` transitions. |
| CORRESPONDENCE | EXISTING/PARTIAL, **gated off** | Letters rendered by the gated path; storage refused while `croa_contracts_attorney_approved=false`. The `[id]` page still uses the ungated generator (BROKEN). Client-built letter bodies are accepted by `addDisputeRoundsForClient` (C1 moves rendering server-side). Nothing is mailed. |
| TRACKING | MISSING | No sent log, tracking number, due dates or cron. Rounds never advance (earlier audit §13.2). |
| RESPONSE | MISSING on master · C1: "response only against a `sent` round" | — |
| OUTCOME | MISSING | No per-item/bureau outcome record. |
| FINANCIAL READINESS | EXISTING/PARTIAL | Business: `engine/funding-readiness.ts` (desk). Auto: `drive-to-own/financing-readiness.ts` → `/status/[token]` panel. Public education intake: `credit_funding_sessions`. No lender matching or funding hand-off in canon; those exist only in the rescued AIX-CREDIT-DISPUTE code. |

## A.3 Relationship to C1 (`C:\dev\wt-credit-c1`, another session — read-only)

- Branch `feat/credit-c1-grounded-cases` at `e1b683ff` (behind master by 4 non-credit commits). **All C1 work is uncommitted.** It changes 16 files (+1259/−476): desk actions/pages, store, deep-audit, gated-protocol, protocol, generator, advanced, render-from-decision, dispute-policy, types, verify.yml. It adds `engine/case-state.ts` (+test), `policy/assertion.ts`, `assertion-panel.tsx`, `gate-coverage.test.ts`, `letters/grounding.test.ts`, `actions.c1.test.ts`, `scripts/tests/sql/credit-isolation.rehearsal.mjs`, and `supabase/migrations/_staged/20260922120000_credit_case_foundation_STAGED.sql`.
- C1 fills CUSTOMER-ASSERTED ERROR, EVIDENCE (refs), CASE state, REVIEW transitions and RESPONSE capture. It makes rounds append-only, renders letters server-side, and forbids automatic escalation (case-state.ts header). It **does not** add tracking/mailing, outcomes, lender matching, or a customer-facing Credit Center.
- Extraction rule: treat C1 as the in-flight owner of credit steps 3-8. This document does not propose competing changes to those files.

## A.4 Rescued `C:\Users\taha1\Projects\AIX-CREDIT-DISPUTE` (manifest T10, preserved at `CONSOLIDATION-2026-09-21\...\10-aix-credit-dispute-REQUIRES-REVIEW`)

Byte-compared today against canon `src/lib/credit-dispute/`:

| Item | Classification | Evidence |
|---|---|---|
| `types.ts`, `engine/protocol.ts`, `engine/funding-readiness.ts`, `importers/{disputefox,myfreescorenow,shared}.ts` | ALREADY IN CANON | 0 diff lines |
| `engine/deep-audit.ts` (5 diff lines), `letters/generator.ts` (41), `letters/advanced.ts` (12), `data/store.ts` (104, localStorage version) | SUPERSEDED | Canon is newer (gated/policy-aware, DB-backed) |
| `supabase/migrations/20260707120000_dispute_engine.sql`, `20260707130000_primary_sources.sql` | ALREADY IN CANON (unapplied there too) | recovery map §4 |
| `importers/smartcredit.ts` (243) | SUPERSEDED / in canon history (deleted 2026-09-01) | — |
| `engine/application-matcher.ts` (210), `engine/funding-package.ts` (160), `20260707140000_applications_funding.sql` (credit_applications, lender_data_points, funding_handoffs, client_application_profiles — none on prod), `app/{applications,funding}/page.tsx` | USEFUL CANDIDATE — **REQUIRES HUMAN REVIEW** | The only lender-matching / funding hand-off logic anywhere. Must be rewritten with org_id + RLS. MCA/RBF referrals hit `sbf_broker_registered=false`. ⚖️ |
| `data-points/catalog.ts` (339), `data/data-points-synced.json`, `app/data-points/page.tsx`, `scripts/sync-device-knowledge.ts` | REQUIRES HUMAN REVIEW | Possible third-party course/chat-archive content (source provenance). |
| `data/applications-store.ts`, `lib/supabase.ts`, `.env.local` | SUPERSEDED / never recover | localStorage PII pattern; trivial client; secret file (not opened). |
| `app/{dashboard,import,disputes/[id]}`, CLI `generate-dispute.ts`, `import-*.ts`, `data/templates/*`, 7 docs | SUPERSEDED (UI) / REQUIRES HUMAN REVIEW (templates may be sample data) | — |

## A.5 Compliance/legal review flags (no guaranteed-score or financing claims)

1. ⚖️ D-22b perform-vs-refer is OPEN, while `croa-gate.ts` asserts "perform in-house". Counsel is needed before `croa_contracts_attorney_approved` is flipped (CROA 15 USC 1679; VA 59.1-335.1 registration and bond).
2. ⚖️ `deep-audit.ts` `removalProbability` and "confrontational facts", plus `estimateScoreImpact` on the desk. These are outcome/score projections. Keep them owner-only. They must not reach customer-facing copy, `/lp/[org]/[sku]`, `/upgrade` or GHL.
3. ⚖️ `assertNoCpnOrRentedTradelines` is never called. The permanent CPN/rented-tradeline ban is not enforced on import (`upsertDisputeClient`) or intake.
4. ⚖️ `no_advance_fee_billing_enforced` and `vdacs_registered_bonded` are never checked by code. The only guard today is that there is no credit billing writer at all.
5. ⚖️ Financing readiness on `/status/[token]` is fine as education. Using it to decline or price a rental is FCRA adverse action (the file says so itself).
6. ⚖️ `[id]` page ungated generator + `upsertDisputeClient` ungated arbitrary-payload write (can inject `disputeRounds` and bypass the CROA gate on storage). Earlier audit §13.1/13.3, still present on master.
7. Marketing surfaces that import funding-readiness vocabulary (`src/app/lp/[org]/[sku]/copy.ts`, `src/app/upgrade/page.tsx`, `src/app/legal/sms/page.tsx`, `src/lib/ghl-offers.ts`) need a banned-claims copy review.

---

# B. AIXMOS

Principle checked: **AIXMOS acts only through authenticated, scoped TMMT services.** Findings:
- No `child_process`, `exec`, `spawn`, `eval` or `new Function` in `src/`, `aria/`, `apps/engine` or `packages/aixmos-core`.
- No LLM tool/function-calling anywhere. The SMS agent returns a JSON schema with a fixed `next_action` enum (`src/lib/agent/llm-router.ts:4-16`), and a deterministic state machine performs every action.
- The only place AI output reaches the DB is the agent spine's `agent_complete_job`. It uses dynamic SQL, but only into the `source_table.target_field` named in `agent_definitions` (`20260826003221_agent_spine_definitions_jobs_and_dispatch.sql:180`).

## B.1 Model providers / gateways

| Call site | Provider / endpoint | Reachable from Vercel? |
|---|---|---|
| `src/lib/agent/llm-router.ts:1,21-24,63-64` | Anthropic SDK (`claude-sonnet-4-6`, `claude-haiku-4-5-20251001`), `ANTHROPIC_API_KEY` | Yes |
| `src/lib/ops-ai.ts:31,56,65,127,136` | Anthropic via fetch (`ANTHROPIC_OPS_MODEL`, default `claude-sonnet-4-20250514`) | Yes |
| `src/lib/pocket-brain.ts:14-18,70-85` | OpenAI-compatible LiteLLM :4000 / Ollama (`POCKET_BRAIN_URL`, example is a tailnet IP) | **Only with a public URL.** Returns 503 when unset (`api/pocket/chat/route.ts:82`) |
| `src/lib/captain-client.ts:4,32` | "captain" agent host, default `http://127.0.0.1:7777` (`AIXMOS_AGENT_HOST`) | **No.** Times out after 1.5 s and falls back to the first candidate |
| `src/lib/agent/handoff.ts:54-58`, `src/lib/notify.ts:40` | iMessage relay on a Tailscale 100.x address | No (skipped silently). The Slack leg works |
| DB agent spine (`agent_definitions.model` default `'rick'`) | Local Ollama via an off-repo worker (`agent_worker` role) | Not from Vercel. Depends on BRAINIAC/M1 |
| `aria/app/api/{chat,voice}/route.ts` | Ollama `127.0.0.1:11434` (Anthropic fallback), face server `127.0.0.1:7788`, ElevenLabs | Not deployed |
| `src/lib/agents/run-on-case.ts:55,62-64` | Reads `OPENAI_API_KEY` but makes **no call** | Stub |

## B.2 Components

| # | Component | Status | Auth / scope | Covers |
|---|---|---|---|---|
| 1 | SMS sales agent: `api/agent/sms/inbound/route.ts` → `lib/agent/process-inbound.ts` (+ guard, persona, compliance, audit, redact-pii, state-machine, webhook-replay, tenant) | **EXISTING/WORKING** | Twilio HMAC, fails closed, timing-safe (`route.ts:68-90`). Replay gate (`:168-190`). Org resolved by Twilio number. Service role. Kill switch + licence + daily LLM spend cap (`guard.ts:44-118`). PII redacted before the model call. **Drafts held for owner approval by default** unless `B3_AUTO_REPLY_ORGS` (`auto-reply-policy.ts:28-39`). Prod: `agent_messages` 0 rows, `agent_conversations` 0 rows (never ran live) | comms, CRM, customers |
| 2 | `lib/agent/twilio-send.ts sendSms` | ORPHANED | test-only caller | — |
| 3 | `lib/agent/handoff.ts` | WORKING (Slack) / PARTIAL (iMessage, tailnet-only) | host allowlist, phone redaction | support |
| 4 | GHL voice (Bella): `api/agent/voice/ghl/route.ts`, `lib/agent/voice/*` | **EXISTING/BROKEN-ish (PARTIAL)** | `x-ghl-voice-secret` header only, no rate limit. With no `org_slug` it falls back to the nil-UUID org (`ghl-voice-handler.ts:42-66`); the licence guard then throws, so the route returns 500. Stores AI reply as outbound message **without** the owner-approval hold that SMS uses (`ghl-voice-leads.ts:111-117`; stored, not sent) | comms, CRM |
| 5 | Cal / Stripe per-tenant webhooks `api/agent/{cal,stripe}/webhook/[slug]` | EXISTING/WORKING (no AI) | per-tenant HMAC / Stripe signature, replay gate | CRM, payments |
| 6 | Ops AI fact-check + owner draft refine `lib/ops-ai.ts` ← `app/ops-actions.ts` | EXISTING/WORKING | session. Refine is owner-only. Fails safe (`ai_aligned=false` when no model) | operations |
| 7 | Pocket assistant `api/pocket/chat` + `lib/pocket-brain.ts` | EXISTING/PARTIAL (dead on Vercel unless a public brain URL is set) | session + durable rate limit + token spend. Org resolved via service role from the user's email | support, knowledge (no retrieval) |
| 8 | Dispatch captain ranking `(command)/dispatch/actions.ts:164-184` | EXISTING/PARTIAL (AI never runs on Vercel) | staff or `org_roles` row. Output validated against known unit ids | fleet, operations |
| 9 | `lib/agents/run-on-case.ts` (from `lib/routing/execute.ts:196`) | PLACEHOLDER (template draft, no AI) | service role, called from intake/GHL auto-ops | tasks |
| 10 | `lib/aixmos-prequal*.ts` (declined BG check → AIXMOS prequal lane) | EXISTING/WORKING (rules, not AI) | admin server action. Consent required before `request_handoff` | CRM, customers |
| 11 | DB agent spine `agent_definitions` (3 rows) / `agent_jobs` (32 rows) | EXISTING/PARTIAL | RLS `is_platform_admin()` only. Worker RPCs revoked from anon/authenticated; scoped `agent_worker` login. **No consumer in `src/`**; the worker runs off-repo against local models. Agents: `expense-categoriser` → `expenses.expense_type`, `intake-router` → `intake_events.program` | analytics/bookkeeping, CRM routing |
| 12 | `packages/aixmos-core` | EXISTING/WORKING (no AI) | imported by 23 files in `src/app/(learn)/learn/*` (tsconfig alias, `transpilePackages`). Coach/readiness engines are rules-based. `cube/config.ts:31,35` has localhost defaults | documents, customers (credit/funding education) |
| 13 | `apps/engine` | ORPHANED | standalone Next app (:3001), excluded from tsconfig, not in `vercel.json`. Duplicates `(learn)` | — |
| 14 | `aria/` | ORPHANED (and unsafe if deployed) | `/api/chat` has **no auth** (`aria/app/api/chat/route.ts:11`). `portrait/route.ts` reads the local filesystem. Localhost-only | support/voice avatar |
| 15 | `workstream-1-aixmos-core/` | PLANNED ONLY | README/TASKS only | fleet economics, provisioning |
| 16 | `AIXMOS/` static site | LEGACY (retired, `README-RETIRED.md`) | only `npm run sync:aixmos-people` (Airtable) | — |
| 17 | Agent controls `/pocket/agents` pause/resume | EXISTING/WORKING | session, then service-role write to `organization_licenses` | operations |
| — | `/lp/aixmos` public front door (commits `b7ce2458`, `2b119fcf`) | EXISTING (marketing page) | public | — |

## B.3 Responsibility map → foundation vs new build

| Responsibility | Existing foundation | Verdict |
|---|---|---|
| Operations | ops-ai (6), agent controls (17), dispatch captain (8, local-only) | Foundation exists. Needs a cloud-reachable model path for captain |
| Customers | SMS agent (1), prequal handoff (10), aixmos-core learn (12) | Foundation exists |
| Fleet | captain ranking (8), unreachable on Vercel | NEW BUILD (or a public, authenticated gateway) |
| Maintenance | none | NEW BUILD |
| Comms | SMS agent (1, owner-hold), handoff (3), voice (4, partial) | Foundation exists. Voice needs the approval hold + org fallback fix |
| CRM | SMS/voice writes, cal/stripe webhooks, intake-router agent | Foundation exists |
| Documents | aixmos-core (rules) | NEW BUILD for AI document handling |
| Tasks | run-on-case template (9) | PLACEHOLDER → new build |
| Analytics | expense-categoriser (11, local worker) | PARTIAL. Depends on local machine uptime |
| Support | pocket chat (7), handoff (3) | PARTIAL |
| Knowledge retrieval | none (no embeddings/vector store in canon) | NEW BUILD |

**Principle violations / flags:**
- **(a)** `aria/api/chat` is unauthenticated. It is not deployed today; if it were, it would break the principle.
- **(b)** Voice agent: the nil-UUID org fallback plus no owner-approval hold is inconsistent with SMS.
- **(c)** Three features (captain, pocket brain, agent spine worker) assume endpoints on BRAINIAC/M1/tailnet. On Vercel they silently degrade.
- **(d)** Pocket chat resolves the org from the user's email using the service role. This is scoped, but it is not RLS-enforced.

---

# C. SECURITY MODEL (current state, prod catalog + code, 2026-09-21)

## C.1 Authentication
- Supabase Auth (email). App signup `src/app/(auth)/login/actions.ts:51` checks the invite code (durable rate limit 10/h/IP at `:61`, claims invite `:108-114`), then calls the **public** `supabase.auth.signUp` (`:130`). No DB-level hook requires an invite, and `signup_invites` has **0 rows**. So a direct `POST /auth/v1/signup` with the anon key bypasses the invite gate whenever GoTrue signup is enabled. Last observed `disable_signup=false` on 2026-09-17 (`supabase/migrations/20260917160000_profiles_protect_access_columns.sql:53`, `docs/security/PROFILES-ACCESS-COLUMNS.md:55`). Whether the owner has done Phase-2A **A4a** (dashboard toggle) is **UNKNOWN**: not verified, because the brief forbids calling the endpoint. There is no `supabase/config.toml` in the repo.
- Open redirect in `src/app/api/auth/callback/route.ts:18,32`: the guard only rejects a leading `//`. Tested with Node's WHATWG URL: `new URL("/\\evil.com", origin)` → `https://evil.com/`. `?next=/%5Cevil.com` decodes into that form.

## C.2 Authorization
- **`profiles.role` is authoritative in the DB.** Helper definitions on prod (all `SECURITY DEFINER`, `search_path public,pg_temp`):
  - `is_platform_admin()` = `profiles.role = 'admin'`
  - `is_admin()` = `role='admin'` OR `portal_role ∈ {admin, super_admin}`
  - `is_staff()` = `role ∈ {admin, internal_team}` OR `portal_role ∈ {team_member, manager, admin, super_admin}`
  - `is_internal_ops()` = `role ∈ {admin, internal_team, investor}`. ⚠ It includes `investor`, and it is used by 18 policies (including `credit_funding_sessions` DELETE and `credit_payment_schedule` DELETE).
  - `is_org_member(org)` = row in `org_roles` OR (`profiles.organization_id = org` AND `role ∈ {admin, internal_team}`)
- Policy counts: 348 policies in public. **`is_staff()` appears in 189** (broad, as noted before). `is_platform_admin()` 35, `is_internal_ops()` 18.
- **Profiles self-escalation: CLOSED.** Ledger `20260921234148 profiles_protect_access_columns` is applied. Trigger `profiles_block_protected_self_edits` is on `public.profiles`, enabled `O`. It blocks INSERT by anon/authenticated and any self-change outside `{full_name, phone, updated_at}`, which covers `role`, `portal_role`, `email` and `organization_id`. Column grants: `authenticated` has table-level `SELECT` only, and column `UPDATE` on `full_name, phone, updated_at` only. So the chain "open signup → set own role=admin" is closed at two layers. **Gap:** `scripts/tests/sql/profiles-access-columns.rehearsal.mjs` exists but is **not run by CI** (no `rehearsal` in `.github/workflows/*`). Phase-2A **A3** (regression tests in CI, branch `sec/2a-profiles-regression`) is still open.
- App layer: `getAppRole` reads JWT `app_metadata.role` (`src/lib/auth-roles.ts:52-56`), which users cannot change. `user_metadata` is not used for authZ. Split-brain with `profiles.role`: nothing syncs them. It fails closed.

## C.3 RLS coverage (prod)
- 178 public tables, **0 with RLS off**.
- **17 with RLS on + zero policies** (deny-all to anon/authenticated; service-role only): `garage_gates, garage_history, garage_builds, garage_ledger, garage_mods, exec_va_tasks_dnc_remediation_20260906, exec_va_tasks_dnc_remediation_20260916, exec_va_tasks_quarantine_20260916, payment_obligation_reconciliation, customer_payments_snapshot_20260706, partner_tenants, partner_licenses, partner_install_tokens, signup_invites, tmmt_token_ledger, ghl_webhook_events, rate_limit_buckets`.
- **TRUNCATE:** 0 tables grant TRUNCATE to anon or authenticated (the earlier finding is remediated). But the schema default ACL for objects created by `supabase_admin` still grants `anon`/`authenticated` `arwdDxtm` (includes `D`=TRUNCATE). The `postgres` default ACL grants `arwdxtm` (no TRUNCATE). New tables created as `supabase_admin` will re-open TRUNCATE unless revoked.
- Anon still holds INSERT/UPDATE/DELETE **grants** on 167 tables. RLS is the only gate there, so any permissive policy becomes a real write path.
- **22 literal-`true` policies.** Anon INSERT (intentional public intake): `background_checks, waitlist, appointments, tickets, customer_inspection_photos, vehicle_handover, vehicle_onboarding_inspections, customer_intake_forms (public), credit_funding_sessions, team_onboarding`. Public read: `packages, entitlements, package_entitlements`. Service-role-only: `partner_heartbeats, partner_audit_events, audit_events, agent_conversations, agent_messages, exec_va_tasks`. Authenticated read: `do_not_contact_numbers`. **Authenticated ALL `true`: `change_log` and `partner_acquisition`** (see HIGH below).

## C.4 Tenant isolation
- 119/178 public tables carry `org_id`/`organization_id`/`tenant_id`. Pattern `*_org_all`: `is_staff() OR (org_id IS NOT NULL AND is_org_member(org_id))`. Because `is_staff()` is global rather than per-org, **any staff user of any org sees every org**. There are 9 organizations on prod.
- **`org_roles.tenant_admin_write` self-recursion: CONFIRMED.** The policy runs `EXISTS (SELECT 1 FROM org_roles r …)` inside a policy on `org_roles`. A read-only simulation as `authenticated` (`BEGIN READ ONLY; SET LOCAL ROLE authenticated; … select count(*) from org_roles; ROLLBACK`) returned `42P17 infinite recursion detected in policy for relation "org_roles"`. It fails closed. Helpers still work because they are SECURITY DEFINER. This is Phase-2A **A12**, open. `org_roles` has 1 row.
- `dispute_clients` has **no org column**, so it is platform-admin only; there is no tenant model for credit cases yet (C1 staged migration pending).
- **Test coverage:**
  - `e2e/customer2-tenant-isolation.spec.ts` and `e2e/dispatch-rls.spec.ts` are real two-user tests against live Supabase with the anon key. The dispatch test skips unless `E2E_*` env vars are set, and customer2 expects 2 tables to fail by design (`:25-29`).
  - `scripts/tests/sql/*.rehearsal.mjs` are real Postgres (PGlite) tests on copied fixtures, not run in CI.
  - `src/lib/engagement-rls.test.ts` is structural only.
  - There is no pgTAP / `supabase/tests`. The planned matrix is `docs/saas/TENANT_ISOLATION_TEST_MATRIX.md`.
  - C1 adds an uncommitted `credit-isolation.rehearsal.mjs`.

## C.5 Service role, public endpoints, webhooks, rate limiting
- About 60 `src` files use the service role (`src/lib/supabase-service.ts` is `server-only`). Public-reachable service-role users:
  - `api/agent/sms/inbound` (Twilio HMAC)
  - `api/agent/{stripe,cal}/webhook/[slug]` (per-tenant signature)
  - `api/agent/voice/ghl` (static header secret, no rate limit)
  - `api/webhooks/ghl/*` (`verifyGhlWebhook`: HMAC when a signature header is present, else a static secret; replay check + event-id dedupe)
  - `api/webhooks/airtable*` (`x-sync-secret`)
  - **`api/forms/submit` and `api/leads/webhook` (no auth, durable rate limit)**
  - `(auth)/login/actions.ts` (invite lookup)
  - `forms/license-upload-actions.ts` (single-use token)
- Rate limiting: **`rate_limit_hit(p_key,p_window_ms,p_max_hits)` EXISTS on prod** (service_role EXECUTE, anon no). So `isRateLimitedDurable` is live wherever a service-role backend is passed (signup/sign-in, forms/submit, leads/webhook, pocket/chat, intake). The "STAGED" comment in `src/lib/rate-limit-durable.ts:10-20` is **stale**. In-memory `isRateLimited` is used by `middleware.ts:217` (POST /forms*). There is **no limit at all** on the webhooks, `cube/application`, `voice/ghl`, `license/*`, or the public server action `submitCreditFundingIntake` (`src/app/forms/actions.ts:732`), apart from the middleware POST /forms* in-memory limit.
- Middleware blocks `/api/cron/*`, `/api/ops/command`, `/api/mission/*`, `/api/license/*` and `/api/audit/*` for session-less callers, and `src/middleware.test.ts:237-238` asserts this. So the Vercel crons (`marketing-kpi-ghl`, `journey-recompute` in `vercel.json`) get a 307 to /login. This is a reliability issue, not an exposure.

## C.6 Sensitive data, storage, logging
- SSN last 4, DOB, address and tri-bureau scores live inside `dispute_clients.payload` (JSON, 0 rows). The table is locked to `is_platform_admin()`, and letters print SSN last 4 and DOB (`letters/advanced.ts` clientBlock, orphaned). The public intake stores no SSN/DOB (forms/actions.ts:648). `no-browser-pii.test.ts` guards against client-side PII storage.
- Buckets on prod: `staff-documents`, `vehicle-media`, `program-documents`, all `public=false`. Policies: staff_documents CRUD, program_documents staff ALL, vehicle_media staff ALL + client read. The repo also references a `vendor-files` bucket (`20260516120000_workflow_engine.sql:543`) that is **not on prod** (drift). Signed URLs: `(admin)/document-actions.ts:39-61` gives any staff user a 1 h signed URL for any `staff-documents` path. Only `licenses/background_checks/` is owner-restricted, and there is no org check.
- Logging: emails/IPs at `login/actions.ts:101,117`, a plaintext phone at `lib/agent/compliance/record-opt-out.ts:55`, and a stringified payload at `lib/degraded.ts:106`. Sentry has no `beforeSend` scrubber. No SSN/DOB or full-body logging was found. `redactPii` is applied before model calls and Slack.

## C.7 Findings by severity

| Sev | Finding | Evidence | Status |
|---|---|---|---|
| ~~CRITICAL~~ | Profiles self-escalation to admin | ledger `20260921234148`; trigger `profiles_block_protected_self_edits`; column UPDATE grants = full_name, phone, updated_at | **CLOSED 2026-09-21** |
| **HIGH** | `partner_acquisition` policy `partner_acq_authenticated ALL true` for `authenticated`. With signup open (or any customer account), any logged-in user can read and alter supply-side PII (owner_name, phone, email, finance status, note payment). 0 rows today. Migration `20260921233517` added anon insert today | catalog `pg_policies` | OPEN |
| **HIGH** | Public signup bypasses the invite gate (GoTrue signup enabled; the invite is app-only) | `login/actions.ts:51-130`; `signup_invites` 0 rows | OPEN unless owner did A4a (UNKNOWN). Severity drops to MEDIUM now that the escalation is closed, **but** it is still HIGH in combination with the `true` authenticated policies above |
| **HIGH** | `is_staff()` is global, not per-org, across 189 policies. Any staff/`portal_role=team_member` user reads every tenant; `*_org_all` short-circuits on `is_staff()` | catalog | OPEN (known) |
| MEDIUM | `change_log` authenticated ALL `true` (any user can edit/delete ops change history) | catalog | OPEN |
| MEDIUM | `org_roles` 42P17 recursion (fails closed; breaks tenant-admin self-management) | read-only simulation | OPEN (2A-A12) |
| MEDIUM | Open redirect `api/auth/callback?next=/%5Cevil.com` | `route.ts:18,32`; Node URL test | OPEN |
| MEDIUM | Public lead webhook (no auth, org by `?org=` slug, service role) overwrites name/email of an existing lead by phone match | `api/leads/webhook/route.ts:111-130` | OPEN |
| MEDIUM | Staff can sign any `staff-documents` path across orgs | `(admin)/document-actions.ts:39-61` | OPEN |
| MEDIUM | Default ACL for `supabase_admin`-owned new tables re-grants TRUNCATE + ALL to anon/authenticated | `pg_default_acl` | OPEN (latent) |
| MEDIUM | CPN/rented-tradeline ban not enforced (`assertNoCpnOrRentedTradelines` has no caller); ungated `[id]` letter path; `upsertDisputeClient` accepts arbitrary payload | §A.5 | OPEN (compliance) |
| MEDIUM | Voice agent: nil-UUID org fallback; AI reply stored with no owner hold | `ghl-voice-handler.ts:42-66`, `ghl-voice-leads.ts:111-117` | OPEN |
| MEDIUM | `is_internal_ops()` includes `investor`, granting DELETE on credit tables | function def + policies | OPEN (review intent) |
| MEDIUM | No tenant-isolation or privilege regression test in CI | `.github/workflows/*` | OPEN (2A-A3) |
| LOW | Vercel crons 307'd to /login by middleware (reliability) | `middleware.test.ts:237`, `vercel.json:31-39` | OPEN |
| LOW | PII in logs (phone, email/IP); no Sentry scrubber | §C.6 | OPEN |
| LOW | `aria/` unauthenticated chat (not deployed) | `aria/app/api/chat/route.ts:11` | ORPHANED |
| LOW | `rate-limit-durable.ts` header says RPC is staged; it is live | prod catalog | doc drift |
| LOW | `vendor-files` bucket in migrations but not on prod | `storage.buckets` | drift |

## C.8 Phase-2A open items referenced (from `PHASE_2A_SECURITY_EXECUTION_PLAN.md`, read-only)

| Item | Status |
|---|---|
| A1 profiles fix | **DONE** (applied, confirmed above) |
| A4a disable signup | UNKNOWN (owner dashboard) |
| A4b server-side invite `admin.createUser` | open |
| A3 CI regression tests | open (not pushed) |
| A9 credential rotation | owner |
| A10 Docker port firewall | owner, admin |
| A7/A8 secret clean-up | owner |
| A11 watchdog restarting retired TMMT OS | open |
| A12 `org_roles` recursion | open, confirmed |

**Tenant-isolation verdict:** RLS is on everywhere and fails closed at the table level. **Isolation between tenants is NOT enforced for staff**, because `is_staff()` is global. The customer path (`is_org_member`) is sound but untested in CI. Two authenticated-`true` policies (`partner_acquisition`, `change_log`) sit outside the tenant model entirely. Credit data has no tenant column. Verdict: **EXISTING/PARTIAL — adequate for a single house operator, not ready for multi-tenant AIXMOS partners.**
