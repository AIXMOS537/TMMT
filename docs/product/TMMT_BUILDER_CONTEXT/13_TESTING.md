# 13 — Testing: commands, baseline, required matrix, Definition of Done

Source: SPEC §4.3, §4.4, §24, §25, §31.2 (+ E1 §2, §3, §5, §6) · Snapshot 2026-09-21 · canon `4cca6835`

> **CURRENT** = "Commands", "Baseline", "Zero-target traps" (what runs and what fails today). **TARGET** = "Required test matrix" (release gates; most rows have no test yet — PM-01/PM-05/PM-06/PM-18/GHL M9). The "Definition of Done" is binding now.

## Commands

| Purpose | Command | In CI (`verify.yml`)? |
|---|---|---|
| Install | `npm ci --no-audit --no-fund` | yes |
| Dev | `npm run dev` | – |
| Brand map | `npm run brand:check` | yes |
| Lint | `npm run lint` | yes |
| Typecheck | `npx tsc --noEmit` (no npm script) | yes — **missing from local `scripts/verify.sh`** (the build type-checks only what it bundles, not tests) |
| Unit tests | `npm test` (`vitest run`) | yes |
| Build | `npm run build` (`next build --webpack`) | yes |
| E2E local | `npm run test:e2e` | **no** (hits whatever `.env.local` points at = prod) |
| E2E prod smoke | `npm run test:e2e:prod` | **no** — do not run against prod without owner OK |
| SQL rehearsals | `cd scripts/tests/sql && npm ci`, then `node scripts/tests/sql/<file>.mjs [args]` | **no** |
| Local gate | `npm run verify` (brand, lint, test, build) | pre-push hook |

Runtime: Node `>=24 <25`. There is no `.env` in a clean worktree; build and tests run without secrets.

## Baseline (clean worktree, no env, 2026-09-21)

| Step | Result |
|---|---|
| `npm ci` | PASS (664 packages) |
| brand:check | PASS (3 tenants) |
| lint | PASS, 0 errors, 39 warnings (36 `set-state-in-effect`) |
| `tsc --noEmit` | PASS, 0 errors |
| vitest | **2320 pass / 2 fail on Windows / 14 skipped** (152 files, 2336 tests) |
| build | PASS with no env; 151 static pages; 122 dynamic routes not executed |
| SQL rehearsals | 8/11 pass as-is; 1 red **by design** without `--repaired`; 2 need path arguments whose intended targets are **undetermined** (`automation-migrations`, `classifier-migration`) — `pending` until evidence is found (TMMT-BUILD-002) |
| CI (`verify.yml`) | brand:check, lint, `tsc --noEmit`, vitest, `next build` **only**. E2E and the SQL rehearsals are **not in CI** |

**Compiling ≠ healthy.** A green baseline says nothing about the 122 dynamic routes, prod data, the 7 ghost-table screens or any send/money path.

**The 2 Windows-only failures (known; not code bugs, but real test-design risks):**
1. `src/lib/guards/ticket-requester-is-not-the-customer.test.ts:38`: `execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'")` passes the single quotes literally through cmd.exe, so the file list is empty. The sentinel fails, and the other 3 tests pass **vacuously** (FS-20).
2. `src/lib/agent/compliance/record-opt-out.test.ts:137`: with `core.autocrlf=true`, `src/app/api/agent/sms/inbound/route.ts` checks out with CRLF, and the fixed 2200-char look-back window misses the opt-out guard. `.gitattributes` forces LF only on `*.sh`/`*.command`/a few scripts.

A baseline of "2 fail on Windows" is expected until TMMT-BUILD-004 lands. **Any other failure is yours.**

## Zero-target / vacuous-pass traps (do not add more)

1. Glob-based guard tests that find 0 files and pass (FS-20). Every scan test must assert a non-zero target count.
2. Fixed-character-window source scans (CRLF-sensitive).
3. E2E specs that **skip** (not fail) without env (`all-scopes`, `customer2-tenant-isolation`, `dispatch-rls`, `masked-rpc-access`, `internal-ops-fail-closed`, `renter-journey`, `audit`), so isolation proofs report green-with-skips.
4. `automation-repairs.pglite.test.mjs` exits non-zero by design without `--repaired`; two rehearsals need path args.
5. `pii-guard.yml` passes with "structural checks only" when `PII_DENYLIST` is unset.
6. `fake-supabase` (25 test files) cannot see schema or column drift. A test against `fake-supabase` does **not** prove a column exists.
7. "Build green" executes none of the dynamic routes and no DB call.
8. `mission-daily.yml` is green on a 307; `session-autopilot.yml` is green while every action is refused.

## Required test matrix (release gates, SPEC §25.2)

| Area | Tests required |
|---|---|
| **Money** | processor webhook signature + replay; unique processor event id; no "Paid" without evidence; **GHL tag never creates Paid**; deposit lifecycle; refund/failed; late fee never revenue; no interest allocation; commission/tokens only from verified payments |
| **Permissions** | middleware tier × route-group matrix (7 tiers + signed-out + the future `customer` tier × the 12 route buckets = 11 `(group)` folders + ungrouped, SPEC §6.1; plus machine APIs); open redirect; operator home; customer path; owner-only routes; profiles protected columns |
| **Tenant isolation** | two orgs: staff of A cannot read/write B on every `*_org_all` table; customer sees only own rows; anon cannot choose `org_id`; `partner_acquisition`, `change_log` closed (GHL **M9** is the release blocker) |
| **CRM routing** | each intake surface resolves org server-side; E.164 dedupe; DNC/opt-out respected; stage map never defaults silently (GHL M7/M9) |
| **Rental state** | every allowed transition; every forbidden transition rejected; overlap guard; hold expiry; no status write outside the function |
| **Comms** | DNC/opt-out/DND fail closed at send; owner-hold honoured; drainer idempotent |
| **Credit** | CROA gate; CPN ban; no projections on customer surfaces (credit track) |
| **Crons/machine APIs** | reachable with secret, 401 without, **never 307** |
| **Platform hygiene** | LF `.gitattributes` for `*.ts`; guard tests fail on zero targets; E2E fail (not skip) in CI when env is expected |

**Every authorization test includes a hostile authenticated user** (signed in, no org role, no staff role) and a user from a second org.

Prerequisite for E2E in CI: a **non-production Supabase** (GHL B-7, owner decision). Until it exists, DB-shaped tests use **PGlite rehearsals** (`scripts/tests/sql/*.mjs`, pattern: fixture roles `anon`/`authenticated`/`service_role`, `set local role`, assert).

## Definition of Done (every PR, SPEC §31.2)

1. `npm run build` passes.
2. `npx tsc --noEmit` passes.
3. `npm run lint`: 0 errors, no new warnings.
4. `npm test` passes on Linux CI. New logic has unit tests. DB-shaped logic has a PGlite rehearsal wired into CI.
5. **Happy path and failure path** both tested. Every write checks its result; no silent `void` on an important side effect.
6. **Permissions:** the route/action is covered by the tier matrix; checks are server-side, not UI hiding.
7. **Tenant isolation:** any new table/policy has a two-org test; no client-supplied `org_id` is trusted.
8. **Mobile:** usable at 375 px (customer and field screens are designed mobile first).
9. **Loading, error and empty states** are present and human-worded.
10. **Docs:** route registry row updated; SoR matrix updated if a field's writer changes; migration ledger updated.
11. Money / send / sign / prod-deploy changes carry the owner gate and baton. No customer send is switched on in the same PR as the code that sends.
12. No secrets or PII in code, logs, fixtures or docs.

Also: **new tests must fail on the pre-fix code.** Show the red run in the PR description.
