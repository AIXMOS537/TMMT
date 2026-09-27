# E1 — Build baseline, stack, test reality

- Evidence worker E1, 2026-09-21
- Worktree `C:\dev\wt-master-extraction`, branch `docs/tmmt-master-extraction-2026-09-21` @ `4cca6835` (origin/master)
- Host: Windows 11, Node v24.16.0, npm 11.13.0, Git Bash. **No `.env*` present in the worktree** (checked). Every command ran with no secrets.
- Raw logs: `docs/product/_evidence/_logs/*.log` (install, brand-check, tsc, vitest, lint, build, sql-*).

Status words used: EXISTING/WORKING, EXISTING/PARTIAL, EXISTING/BROKEN, PLACEHOLDER, ORPHANED, LEGACY, PLANNED ONLY, MISSING, UNKNOWN.

---

## 1. Stack

| Area | Finding | Source | Status |
|---|---|---|---|
| Framework | Next.js **16.3.5** App Router. Build is forced onto **webpack** (`next build --webpack`) | `package.json` scripts.build; installed `node_modules/next` 16.3.5 | EXISTING/WORKING |
| React | react / react-dom ^19.2.4 (installed 19.3.0) | `package.json` | EXISTING/WORKING |
| TypeScript | ^5 (installed 5.9.3), `strict: true`, `moduleResolution: bundler`, paths `@/*` → `src/*`, `@aixmos/core` → `packages/aixmos-core/src` | `tsconfig.json` | EXISTING/WORKING |
| Package manager | **npm** (`package-lock.json`; CI uses `npm ci`). No workspaces field | `package.json`, `.github/workflows/verify.yml` | EXISTING/WORKING |
| Runtime | `engines.node: ">=24 <25"`; CI `node-version: 24`. No `.nvmrc` | `package.json` | EXISTING/WORKING (.nvmrc MISSING) |
| DB client | `@supabase/supabase-js` ^2.97 (2.116.0) + `@supabase/ssr` ^0.9. No ORM (no Prisma/Drizzle). Client factories: `src/lib/supabase.ts` (browser), `src/lib/supabase-server.ts` (SSR cookies), `src/lib/supabase-service.ts` (service role, `server-only`) | `src/lib/supabase*.ts` | EXISTING/WORKING |
| Schema | 89 applied-style SQL files in `supabase/migrations/`, plus `_staged/` (12 STAGED + README + adversarial test SQL) and `_parked/` (4). `LEDGER-SNAPSHOT.txt`; `supabase/schema/live-ledger-2026-09-07.tsv`. Out-of-band repairs in `docs/repairs/*.sql` (`.applied.sql` = applied by hand) | `supabase/` | EXISTING/PARTIAL (migration history and prod drift are tracked by hand) |
| Auth | Supabase Auth (cookie sessions through `@supabase/ssr`) plus `src/middleware.ts` (matcher is all non-static paths). Role comes from `profiles.role` (`src/lib/auth-roles.ts`) | `src/middleware.ts:340` | EXISTING/WORKING. Build warns that the "middleware" convention is deprecated in favour of "proxy" |
| Storage | Supabase Storage (`storage.from(...)`) in `src/app/(admin)/document-actions.ts`, `src/app/(learn)/learn/documents/actions.ts`, `src/app/forms/license-upload-actions.ts`, `src/lib/document-storage.ts`, `src/lib/vendor-storage.ts` | grep | EXISTING/WORKING (in code) |
| Payments | `stripe` ^22.2 (22.6.2), used **only** in `src/app/api/agent/stripe/webhook/[slug]/route.ts`, with a per-tenant secret `STRIPE_WEBHOOK_SECRET_<SLUG>`. Selling runs through **GHL checkout links** (`NEXT_PUBLIC_GHL_CHECKOUT_*`) and `src/lib/ghl-payment-sync.ts` | grep | EXISTING/PARTIAL (a webhook receiver only, no Stripe checkout) |
| SMS / voice | `twilio` ^6: `src/lib/agent/twilio-send.ts`, `src/app/api/agent/sms/inbound/route.ts`, `src/lib/agent/voice/ghl-voice-handler.ts` | grep | EXISTING/PARTIAL (env-gated, see activation-gap notes elsewhere) |
| AI | `@anthropic-ai/sdk` ^0.104 (`src/lib/agent/llm-router.ts`, `src/lib/ops-ai.ts`, `src/lib/agents/run-on-case.ts`). Pocket brain = self-hosted HTTP (`POCKET_BRAIN_URL`, `src/lib/pocket-brain.ts`, `src/app/api/pocket/chat/route.ts`). `OPENAI_API_KEY` is read in one place | grep | EXISTING/PARTIAL |
| CRM / integrations | GHL (`src/lib/ghl/*`, webhooks under `src/app/api/webhooks/ghl/*`), ClickUp (`src/lib/clickup`), Airtable (LEGACY; the memory rule says we are moving off Airtable) via `src/app/api/webhooks/airtable/*`, Telegram, Slack webhook, iMessage relay, Resend email | grep | Mixed; Airtable = LEGACY |
| Observability | `@sentry/nextjs` ^10.47 (`sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation*.ts`); Mixpanel browser | `next.config.ts` | EXISTING/WORKING. Build warns that importing `withSentryConfig` from the package root is deprecated |
| UI | Tailwind v4 (`@tailwindcss/postcss`), lucide-react, recharts, leaflet / react-leaflet, dnd-kit | `package.json` | EXISTING/WORKING |
| Validation | zod ^4.3 (4.6.5) | `package.json` | EXISTING/WORKING |
| Unit tests | vitest ^4.1.11. Env `node`, with per-file jsdom for `*.test.tsx`; `@testing-library/react` + jest-dom. Include `src/**/*.test.{ts,tsx}`, `shared/**/*.test.ts` | `vitest.config.ts` | EXISTING/WORKING |
| E2E | Playwright ^1.58 (1.63.0). `playwright.config.ts` (starts `npm run dev` on :3000, loads `.env.local` into the test process); `playwright.prod.config.ts` (defaults to `https://tmmt-ops.vercel.app`) | configs | EXISTING/PARTIAL (not in CI) |
| SQL tests | `scripts/tests/sql/*.mjs`: embedded Postgres through `@electric-sql/pglite` 0.5.8, with its own `package.json` | dir | EXISTING/PARTIAL (not in CI, manual) |
| Lint | ESLint 9 flat config: `eslint-config-next` core-web-vitals + typescript. `react-hooks/set-state-in-effect` and `no-unused-vars` lowered to warnings | `eslint.config.mjs` | EXISTING/WORKING |
| Monorepo layout | Root = the deployed app. `packages/aixmos-core` (`@aixmos/core`, TS source, `transpilePackages`). `apps/engine` (`@aixmos/engine`, a separate Next 16 app on port 3001). `aria/` (a separate Next 16 app on port 4200, its own lockfile, `@anthropic-ai/sdk` ^0.24). `tsconfig` **excludes** `apps/engine`, `packages/aixmos-core`, `aria`, `supabase`, `imports`, `AIXMOS`, `TMMT` | `tsconfig.json` exclude | `apps/engine` and `aria` are not built, typechecked or deployed by the root pipeline: **ORPHANED** from CI/deploy (UNKNOWN whether they are used locally) |
| Edge function | `supabase/functions/intake/index.ts`: a Turnstile-gated anon-write proxy. Its own header says it is "dormant" until the owner sets `TURNSTILE_SECRET_KEY` and the forms are switched over | file header | PLACEHOLDER / PLANNED ONLY (dormant by design) |

Size: **127 `page.tsx`** and **30 `route.ts`** under `src/app`. The build prerendered 151 static pages and printed 36 static (○) routes and 122 dynamic (ƒ) routes.

---

## 2. Real commands

| Purpose | Command | Defined in | Runs in CI? |
|---|---|---|---|
| Install | `npm ci --no-audit --no-fund` | verify.yml | yes |
| Dev | `npm run dev` (`next dev`) | package.json | no |
| Brand map check | `npm run brand:check` (`node scripts/brand-sync.mjs --check`) | package.json, verify.yml | yes |
| Lint | `npm run lint` (`eslint`) | package.json | yes |
| Typecheck | `npx tsc --noEmit` (no npm script) | verify.yml | yes (**missing from `scripts/verify.sh`**, the local gate) |
| Unit tests | `npm test` (`vitest run`) | package.json | yes |
| Build | `npm run build` (`next build --webpack`) | package.json | yes |
| E2E (local) | `npm run test:e2e` (`playwright test`; project `specs`; `audit` is opt-in) | package.json | **no** |
| E2E (prod smoke) | `npm run test:e2e:prod` → `e2e/smoke.spec.ts` against `SMOKE_BASE_URL` or `https://tmmt-ops.vercel.app`; `npm run smoke:prod` (bash) | package.json | **no**. Not run here (production URL) |
| Route audit crawl | `npm run audit` (login, crawl with `--project=audit`, report) | package.json | no |
| SQL rehearsals | `node scripts/tests/sql/<file>.mjs [args]` after `npm ci` inside `scripts/tests/sql` | file headers | **no** |
| Local full gate | `npm run verify` → `scripts/verify.sh` (brand, lint, test, build; `NODE_OPTIONS=--max-old-space-size=12288`) | scripts/verify.sh | n/a (pre-push hook and `ship.sh`) |
| Env check | `npm run check-env` (needs `.env`/`.env.local`; names only) | scripts/check-env.mjs | no |

---

## 3. Diagnostics baseline (this worktree, no env, 2026-09-21)

| Step | Result | Counts | Duration | Status |
|---|---|---|---|---|
| `npm ci --no-audit --no-fund` | PASS (exit 0) | 664 packages; deprecation warnings only (`whatwg-encoding`, `scmp`, `eslint@9.39.5` "no longer supported") | 28 s | EXISTING/WORKING |
| `npm run brand:check` | PASS | "up to date (3 tenants)" | 2 s | EXISTING/WORKING |
| `npm run lint` | PASS (exit 0) | **0 errors, 39 warnings**: 36 × `react-hooks/set-state-in-effect`, 3 × `@typescript-eslint/no-unused-vars` (for example `src/lib/credit-dispute/data/store.ts:3` `DisputeLetterBatch`) | 32 s | EXISTING/WORKING |
| `npx tsc --noEmit` | PASS (exit 0, no output) | 0 errors | 16 s | EXISTING/WORKING |
| `npm test` (vitest) | **FAIL on Windows** (exit 1) | 152 files: 150 pass, 2 fail. Tests: **2320 pass / 2 fail / 14 skipped (2336)** | 17 s | EXISTING/PARTIAL (both failures are host-platform artifacts, see below; they very likely pass on Linux CI) |
| `npm run build` | **PASS** (exit 0) with **no env at all** | 151 static pages generated; TypeScript step 15 s; compiled with warnings | 102 s | EXISTING/WORKING |
| SQL rehearsals (pglite, in-memory) | 8 of 11 PASS as-is | see §3.3 | 12–53 s each | EXISTING/PARTIAL |

### 3.1 The two vitest failures (not code bugs, but real test-design risks)

1. `src/lib/guards/ticket-requester-is-not-the-customer.test.ts:38`, "finds the call sites it is meant to police": `expected 0 to be greater than 0`.
   - Cause: `execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'")` runs through cmd.exe on Windows. The single quotes are passed through literally, so the file list comes back **empty**.
   - The sentinel caught it. But the file's other 3 tests PASSED while examining **zero files**, which is a live zero-target case on any Windows machine (the local army runs on Windows).
2. `src/lib/agent/compliance/record-opt-out.test.ts:137`: `recordGlobalOptOut at index 12115 is not on an opt-out branch`.
   - Cause: `core.autocrlf=true` on this host, so `src/app/api/agent/sms/inbound/route.ts` is checked out with **CRLF**. The test's fixed 2200-character look-back window therefore no longer reaches the `control.kind === 'opt_out'` guard.
   - `.gitattributes` only forces LF on `*.sh`/`*.command`/a few scripts, not on `*.ts`.

On the Linux CI runner (LF, sh) both should pass. That is UNKNOWN until checked on the verify run, and verify.yml has no Windows leg.

### 3.2 Build warnings (first distinct, no secrets)

1. `[@sentry/nextjs] Importing withSentryConfig from @sentry/nextjs is deprecated … will stop working in v11`. Source: `next.config.ts:4`.
2. `The "middleware" file convention is deprecated. Please use "proxy" instead.` Source: `src/middleware.ts`.
3. Edge Runtime: "A Node.js API is used (process.cwd …)". Import trace `next/headers` ← **`src/lib/supabase-server.ts`**, pulled into the edge (middleware) bundle.
4. Edge Runtime: "process.features … not supported". Trace `@sentry/nextjs/build/esm/edge/index.js`.
5. webpack PackFileCacheStrategy "Serializing big strings (113–267 KiB)". Performance only.
6. Experiments enabled: `clientTraceMetadata`, `serverActions` (bodySizeLimit 20 MB).

No ENV-REQUIRED build failures. Env is read lazily, as `verify.yml` claims. Nothing in the build step exercises runtime env: all 122 dynamic routes are unexecuted at build time.

### 3.3 SQL rehearsals (`scripts/tests/sql`, embedded pglite, never touch a real DB)

| Script | Result | Notes |
|---|---|---|
| agent-queue-migrations.rehearsal | PASS, 8 ok | |
| g01-migration.rehearsal | PASS, 4 ok | |
| g02-internal-destinations.rehearsal | PASS, 6 ok | |
| g02-shadow-eligibility.rehearsal | PASS, 12 ok | |
| least-privilege-va-tasks-agent-rpcs.rehearsal | PASS, 4 ok | |
| prod-write-baton.rehearsal | PASS, 12 ok | loads `supabase/migrations/20260916193606_ops_prod_write_baton.sql`, runs it twice (idempotent) |
| profiles-access-columns.rehearsal | PASS, 21 ok | slowest, 53 s |
| quarantine-unverified-payment-followups.rehearsal | PASS, 6 ok | |
| automation-repairs.pglite.test | as-is: **3 FAIL by design**. With `--repaired`: 3 PASS | Without the flag it runs the OLD fixtures (`fixtures/*-old.sql`) and demonstrates 3 defects: contract date inversion, classifier source identity, lease terminal reap. `--repaired` applies `docs/repairs/{contracts-date-order,classify-va-tasks-source-identity,agent-jobs-terminal-lease-reap}.sql` and all pass. The exit code of the bare run does not say "expected red" |
| automation-migrations.rehearsal | exit 1: `pass both migration paths` | Needs 2 path arguments (the STAGED lease + contracts migrations). The `docs/repairs` versions I guessed failed, so the correct targets are UNKNOWN |
| classifier-migration.rehearsal | exit 1: `pass the migration path` | Needs a path argument. The guessed repair file failed, so the correct target is UNKNOWN |

None of these runs in CI or from `scripts/verify.sh`. They protect prod SQL only when someone remembers to run them. Status: EXISTING/PARTIAL.

---

## 4. Env var names by integration (names only)

Read by the app (`src`, `shared`, `packages`, `sentry.*`, edge function). 123 distinct names. `src/lib/env-example.test.ts` enforces that every `process.env.X` in src/shared/packages appears in `.env.example`, and it passes. Per-tenant templated names are not visible to that regex.

| Integration | Names |
|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` (edge fn and legacy) |
| Legacy Command Center DB | `COMMAND_CENTER_SUPABASE_URL`, `COMMAND_CENTER_SUPABASE_SERVICE_KEY` (LEGACY; CC is retired) |
| GHL (server) | `GHL_API_KEY`, `GHL_LOCATION_ID`, `GHL_RESTORATION_LOCATION_ID`, `GHL_CONVERSATION_PROVIDER_ID`, `GHL_EMAIL_FROM`, `GHL_WEBHOOK_SECRET`, `GHL_VOICE_WEBHOOK_SECRET`, `GHL_OVERDUE_WEBHOOK_SECRET`, `GHL_AUTO_OPS`, `GHL_CLIENT_ALERTS`, `GHL_FORM_AUTO_CASE`, `GHL_CASE_STATUS_MAP_JSON`, `GHL_PIPELINE_STAGE_MAP_JSON`, `GHL_STAGE_OPS_JSON`, `GHL_CF_CASE_REF_KEY`, `GHL_CF_TRACK_URL_KEY`, `GHL_CF_PORTAL_URL_KEY`, `GHL_CF_LOGIN_URL_KEY`, `GHL_KPI_SUBSCRIBER_TAG_PATTERNS`, `GHL_KPI_STRATEGY_APPOINTMENT_PATTERNS`, `GHL_DEFAULT_ASSIGNEE_EMAIL` |
| GHL checkout / links (public) | `NEXT_PUBLIC_GHL_CHECKOUT_{97,3750,7500,15000,25000,OPS_KIT,OPS_KIT_USB,OPS_MONTHLY,COMMAND_KIT,COMMAND_KIT_USB,COMMAND_MONTHLY,DEALER_BUNDLE,DEALER_MONTHLY,LLC}`, `NEXT_PUBLIC_GHL_CONSULT_CALL`, `NEXT_PUBLIC_GHL_OPERATOR_APPLY`, `NEXT_PUBLIC_GHL_CREDIT_GUIDANCE`, `NEXT_PUBLIC_GHL_UPSELL_PIPELINE_URL` |
| Stripe / Cal (per-tenant, templated) | `STRIPE_WEBHOOK_SECRET_<SLUG>`, `CAL_WEBHOOK_SECRET_<SLUG>` (`src/lib/agent/tenant-webhook-secret.ts`; unset = 401) |
| Twilio / SMS agent | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `B3_KILL_SWITCH`, `B3_AUTO_REPLY_ORGS`, `CONTACT_CONSENT_MODE` |
| AI | `ANTHROPIC_API_KEY`, `ANTHROPIC_OPS_MODEL`, `OPENAI_API_KEY`, `POCKET_BRAIN_URL`, `POCKET_BRAIN_KEY`, `POCKET_BRAIN_MODEL`, `POCKET_BRAIN_TIMEOUT_MS`, `POCKET_BRAIN_MAX_TOKENS`, `POCKET_COST_PER_JOB`, `POCKET_CLOUD_EQUIV_USD`, `POCKET_REFERRAL_RATE`, `MEMBER_97_MONTHLY_TOKENS`, `AIXMOS_AGENT_HOST`, `AIXMOS_AGENT_TOKEN` |
| Email | `EMAIL_LIVE`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_OUTBOX_DIR` |
| Notifications | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_CHAT_ID`, `SLACK_WEBHOOK_URL`, `IMESSAGE_RELAY_URL`, `IMESSAGE_RELAY_TOKEN`, `IMESSAGE_NOTIFY_TO`, `MISSION_GREETING_NAME` |
| ClickUp | `CLICKUP_API_TOKEN`, `CLICKUP_TEAM_ID`, `CLICKUP_DEFAULT_LIST_ID`, `CLICKUP_LIST_{FLEET,OPS,OPS_GENERAL,REPO,TICKETS}`, `NEXT_PUBLIC_CLICKUP_WORKSPACE_URL` |
| Airtable (LEGACY) | `AIRTABLE_API_KEY`, `AIRTABLE_PAT`, `AIRTABLE_BASE_ID`, `AIRTABLE_LEADS_TABLE`, `AIRTABLE_OPS_LOCATIONS_TABLE` |
| Internal secrets / auth | `CRON_SECRET`, `OPS_COMMAND_SECRET`, `ADMIN_KEY`, `AUDIT_INGEST_KEY`, `SYNC_WEBHOOK_SECRET`, `TMMT_OPS_DEFAULT_ASSIGNEE`, `MONEY_METER_FREE_FOREVER_EMAILS` |
| Edge function | `TURNSTILE_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Deno.env) |
| Observability / analytics | `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_MIXPANEL_TOKEN` |
| Site / cube URLs (public) | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_OWNER_HUB_HOST`, `NEXT_PUBLIC_AIXMOS_SITE_URL`, `NEXT_PUBLIC_AIXMOS_LEARN_BASE_URL`, `NEXT_PUBLIC_PARTNER_SITE_URL`, `PARTNER_APP_URL`, `NEXT_PUBLIC_AFFILIATE_APPLY_URL`, `NEXT_PUBLIC_ENGINE_URL`, `NEXT_PUBLIC_WORKFORCE_URL`, `NEXT_PUBLIC_CUBE_{SAME_ORIGIN,PERSISTENCE,LEARN_URL,WORK_URL,COMMAND_URL,FLEET_URL,DEMO_CONTROLS}`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_PHONE` |
| Platform supplied | `NODE_ENV`, `NEXT_RUNTIME`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_GIT_PREVIOUS_SHA` (ignore script) |
| Test / E2E only | `E2E_TMMT_EMAIL`/`_PASSWORD`, `E2E_PILOT_EMAIL`/`_PASSWORD`, `E2E_ADMIN_EMAIL`/`_PASSWORD`, `E2E_TMMT_ORG_ID`, `E2E_PILOT_ORG_ID`, `E2E_STAMP`, `AUDIT_BASE_URL`, `SMOKE_BASE_URL`, `PW_REUSE_WEB_SERVER` |
| CI secrets | `CRON_SECRET`, `MISSION_API_BASE` (mission-daily), `PII_DENYLIST` (pii-guard), `GITHUB_TOKEN` |

`.env.example` also lists `OLLAMA_URL`, `AIRTABLE_BASE_NAME` and `AIRTABLE_PEOPLE_TABLE`, which nothing in src/shared/packages reads. They are probably read by scripts; otherwise treat them as ORPHANED names.

---

## 5. Test inventory

### 5.1 By type

| Type | Files | Tests | Runs in CI | Notes |
|---|---|---|---|---|
| Vitest unit/integration (`src/**`, `shared/**`) | **152** (151 src + `shared/compliance-gates/sms-gate.test.ts`) | 2336 (2320 pass / 2 fail on Windows / 14 skipped) | **yes** (`npm test`) | 8 are `.tsx` component tests (jsdom). 15 are API route tests. 25 use `src/lib/testing/fake-supabase.ts` (an in-memory fake that cannot catch schema drift, per the memory note "schema-drift-fallbacks") |
| of which static source scans | 27 files use `readFileSync`/`readdirSync`/`execSync` over the source tree | | yes | Guard-style tests: owner approval, env-example parity, migration drift (`src/lib/db/migration-drift.test.ts`), policy correlation, opt-out wiring, ticket requester |
| of which security/compliance-named | 29 files (rls, guard, gate, auth, secret, tenant, role, policy, consent, opt-out, compliance, owner-approval, fail-closed…) | | yes | |
| Playwright E2E (`e2e/`) | **10 specs**: all-scopes (13), audit (1 crawl), customer2-tenant-isolation (4), dispatch-rls (1), internal-ops-fail-closed (4), masked-rpc-access (3), net-only-refactor (5), rental-quote (5), renter-journey (11), smoke (8) | ~55 | **no** | Needs a dev server plus `.env.local`. **The Supabase-backed specs hit whatever `.env.local` points at, which is the production project** (there is no staging DB; the memory note says preview = prod DB) |
| SQL rehearsals (pglite) | **11** in `scripts/tests/sql` | ~75 `ok` assertions | **no** | see §3.3 |
| SQL adversarial script | `supabase/migrations/_staged/TRIAGE_ADVERSARIAL_TESTS.sql` | | no | manual |

### 5.2 Coverage map (non-test source files → test files)

| Domain | Src files | Test files | Status |
|---|---|---|---|
| `src/components` | 44 | 7 | EXISTING/PARTIAL |
| `src/app/(admin)` | 40 | 4 | thin |
| `src/app/(command)` | 35 | 6 | thin |
| `src/app/api` (30 route.ts) | 29 | 15 | EXISTING/PARTIAL (webhooks well covered) |
| `src/lib/agent` | 28 | 17 | EXISTING/WORKING |
| **`src/app/forms`** | **25** | **1** | **largely untested** (public intake, license upload) |
| `src/lib/ghl` | 18 | 5 | EXISTING/PARTIAL |
| `src/lib/credit-dispute` | 15 | 5 | EXISTING/PARTIAL (14 skipped behind the CROA gate by design) |
| `src/app/(pocket)` | 14 | 1 | thin |
| `src/app/(learn)` | 14 | 1 | thin |
| `src/lib/platform` | 9 | 7 | good |
| `src/app/(operator)` | 9 | 2 | thin |
| **`src/app/(auth)`** | **8** | **0** | **MISSING** |
| `src/app/legal` | 7 | 0 | MISSING (static) |
| `src/lib/drive-to-own` | 7 | 6 | good |
| **`src/lib/routing`** | **6** | **0** | **MISSING** (lead routing engine) |
| **`src/lib/ops-command`** | **6** | **0** | **MISSING** |
| **`src/lib/crm-sync`** | **6** | **0** | **MISSING** |
| `src/app/(program)` | 6 | 0 | MISSING |
| `src/lib/rental-pricing` | 5 | 5 | good |
| `src/lib/mission` | 5 | 3 | ok |
| **`src/lib/client-journey`** | **5** | **0** | **MISSING** (behind the daily cron) |
| `src/lib/clickup` | 5 | 0 | MISSING |
| `src/lib/marketing-kpi` | 3 | 0 | MISSING (behind the weekly cron) |
| `src/lib/intake`, `tailor`, `testing` | 3 each | 0 | MISSING |
| `src/app/(vendor)`, `(partner)`, `(investor)`, `(executive)`, `partners` | 3 each | 0 | MISSING |
| `src/lib/client-rental` | 2 | 0 | MISSING |
| `src/lib/workflow`, `people`, `fleet`, `command-center-bridge`, `client-updates`, `agents` | 1 each | 0 | MISSING |
| `src/lib/*.ts` (flat) | 66 | 44 | EXISTING/PARTIAL |

Flat `src/lib` files with no sibling test (28): academy, analytics, captain-client, case-fields, cube-demo-controls, db-vocab, **dispatch-queries**, dispatch-types, **document-storage**, notify-telegram, notify, offer-labels, **ops-policy**, osm-cache, osm-geocode, **pocket-brain**, pocket, portal-links, program-documents, **rental-record-validation**, **rental-write-validation**, rentals-portal, supabase-server, supabase-service (a factories test exists: `supabase-factories.test.ts`), supabase, vendor-storage, vendor-verticals, workflow.

Largest untested areas: public forms (25/1), auth pages (8/0), lead routing, CRM sync and ops-command (6/0 each), client-journey plus marketing-kpi (both cron-driven, 0 tests), the rental write/record validators, and every non-TMMT role app ((vendor)/(partner)/(investor)/(executive)).

### 5.3 Zero-target / vacuous-pass risks

1. **`ticket-requester-is-not-the-customer.test.ts`**: uses a `git ls-files` glob with POSIX quotes. On Windows it scans **0 files**, so 3 of its 4 tests pass vacuously. Only the sentinel test fails.
2. **`record-opt-out.test.ts`**: uses a fixed character window. It is sensitive to CRLF and other formatting, so it can go red on correct code, or green if a guard shifts within range. Fragile.
3. **E2E conditional skips**: they skip, not fail, when env is missing.
   - `all-scopes.spec.ts:154` (no Supabase env)
   - `customer2-tenant-isolation.spec.ts:63`, `dispatch-rls.spec.ts:9`, `masked-rpc-access.spec.ts:33` (no E2E_* creds)
   - `internal-ops-fail-closed.spec.ts:53/79/94`
   - `renter-journey.spec.ts:150` (skipped when AUDIT_BASE_URL is non-localhost)
   - `audit.spec.ts`: the signed-in pass is skipped when there is no login
   - So the tenant-isolation and RLS proofs report green-with-skips on any machine without prod creds, and they are not in CI at all.
4. **`e2e/customer2-tenant-isolation.spec.ts:45`** hardcodes a default TMMT org UUID. `PILOT_ORG` defaults to `""`, which forces a skip.
5. **CROA gate**: `render-from-decision.test.ts` uses `describe.skipIf`. By design exactly one branch runs, and the refusal path is asserted. Not vacuous; this is likely the source of the 14 skipped tests.
6. **`automation-repairs.pglite.test.mjs`** exits non-zero by design without `--repaired`. Two rehearsal scripts need undocumented path args. None of these is wired to CI, so a regression in staged SQL is caught only by hand.
7. **pii-guard.yml**: if the `PII_DENYLIST` repo secret is unset, `ultimatrix.sh scan` prints "structural checks only" and continues (`ultimatrix.sh:196`). It can pass while checking no PII values. Whether the secret is set: UNKNOWN.
8. **`fake-supabase`** (25 files): database-shaped tests run against an in-memory fake, so schema or column drift in prod is invisible to them. `migration-drift.test.ts` only compares repo files, not the live DB.
9. The build compiles but executes none of the 122 dynamic routes. "Build green" says nothing about runtime env or DB.

---

## 6. CI (`.github/workflows/`)

| Workflow | Trigger | What it does | Status |
|---|---|---|---|
| `verify.yml` (job name `verify`) | PR, push to master | Node 24, `npm ci`, brand:check, lint, `tsc --noEmit`, `npm test`, `npm run build`. No secrets | EXISTING/WORKING (Linux only; no e2e, no SQL rehearsals) |
| `pii-guard.yml` (`pii-scan`) | push, PR | `ultimatrix.sh scan` using the `PII_DENYLIST` secret | EXISTING/PARTIAL (vacuous if the secret is unset) |
| `mission-daily.yml` | cron `0 13 * * *` plus manual | POSTs to `$MISSION_API_BASE/api/mission/generate` (default the **prod** URL) with `x-cron-secret`; `notify` defaults to **true**, so Telegram messages go out | EXISTING (a live-comms automation run from GitHub. Owner-gated category) |
| `session-autopilot.yml` | cron every 6 h plus manual | Opens PRs for `claude/*` branches, **enables auto-merge**, deletes merged or stale `claude/*` branches (`contents: write`) | EXISTING. **Risk:** auto-merge to master = auto prod deploy, which conflicts with the prod-write-baton rule once branch protection allows auto-merge. Whether auto-merge is actually enabled on the repo: UNKNOWN |

The local gate `scripts/verify.sh` runs brand, lint, test and build. It does **not** run `tsc --noEmit`, so local and CI gates differ.

---

## 7. Deployment, crons, functions

- **Vercel project:** `tmmt-ops` (`DEPLOY.md:11,22`), URL `https://tmmt-ops.vercel.app`. `tmmtrentals.com` is attached but its DNS is unpublished (`DEPLOY.md:21`). There is **no `.vercel/project.json`** in the repo or worktree, so the linkage exists only in the Vercel dashboard (UNKNOWN from source).
- **Branch → prod:** `vercel.json` `git.deploymentEnabled: { master: true, swarm-coord: false }`. "Every push to master deploys tmmt-ops" (`DEPLOY.md:27`).
- **Ignored build step:** `scripts/vercel-ignore.sh`.
  - Always skips `swarm-coord`.
  - Builds only when the diff touches src, public, packages, shared, config, package*.json, next.config, middleware.ts, tsconfig, postcss, sentry configs, instrumentation, vercel.json or eslint config.
  - Docs-only commits (such as this branch) never deploy.
- **Previews:**
  - `ENVIRONMENTS.md:13` describes a `develop` preview lane, and a `develop` remote branch exists.
  - Env vars are set for "Production + Preview" (`DEPLOY.md:55`). Per the memory note, **preview deployments use the production Supabase DB**. There is no staging database in config.
  - Per the memory note, Vercel Hobby with a private repo deploys only the owner's tip commit.
- **Crons (`vercel.json`):**
  - `/api/cron/marketing-kpi-ghl` at `0 13 * * 1` (weekly, Monday)
  - `/api/cron/journey-recompute` at `0 4 * * *` (daily)
  - Both accept `Authorization: Bearer $CRON_SECRET` (fallback `OPS_COMMAND_SECRET`) or `x-cron-secret`, and answer 401 when unset (`src/app/api/cron/*/route.ts:7-12`).
  - The lib code behind both crons (`client-journey`, `marketing-kpi`) has **0 tests**.
  - The GitHub Actions cron `mission-daily` covers `/api/mission/generate`.
- **Runtimes:** Node serverless by default. 2 routes set `export const runtime = "nodejs"` explicitly. No `maxDuration` is set anywhere. The middleware runs on the Edge runtime, and the build warns that `src/lib/supabase-server.ts` gets pulled into it.
- **Supabase Edge Functions:** exactly one, `supabase/functions/intake` (Deno, `supabase-js@2.45.4` from esm.sh). Its own header marks it dormant (PLANNED ONLY). The memory note lists 6/7 prod edge functions as unversioned in the repo, so the repo does **not** hold the source for the functions running in prod (UNKNOWN which).
- **Other deployables not wired:** `apps/engine` (port 3001), `aria/` (port 4200), `packages/aixmos-core` (transpiled into the main app only). None has its own Vercel config in the repo, so these are ORPHANED from deploy.
