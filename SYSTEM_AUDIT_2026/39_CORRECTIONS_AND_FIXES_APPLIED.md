# 39 · CORRECTIONS & FIXES APPLIED
**2026-09-03, after the three read-only SELECTs were run with owner approval.**

---

## PART A — Where this audit was WRONG

### A-1. 🔴 The headline finding was wrong. Lead intake was already fixed.

**This audit claimed:** lead intake is still broken for a second reason nobody has noticed.

**The truth:** your team fixed it on 2026-09-01, hours after the telemetry window I analysed.

| Time (UTC, 2026-09-01) | Event |
|---|---|
| 19:29:28 | Env-var error stops — env vars fixed |
| 19:30:09 | `OrgRowShapeError` begins (184 failures) |
| **19:39** | **`e57e22ea9` — "fix(leads): accept the org ids that actually exist"** |
| **23:14** | **`3fa5d1f0a` — same fix applied to dispatch** |
| ~23:29 | Deploy lands; `OrgRowShapeError` stops at 23:28:53 |
| **23:30:30** | **A lead for AIXMOS lands successfully** (`source: integration-test`) |

Both commits are ancestors of `HEAD`. **Lead intake works.**

**Why I got it wrong:** I saw the error stop and treated "no errors since" as ambiguous between *fixed* and *no traffic*. One `git log -- src/lib/agent/tenant.ts` would have resolved it in seconds. I checked the deployment timeline and the error timeline but never checked whether anyone had committed a fix in between. That was a gap in method, not in the evidence available to me.

### A-2. 🔴 The root cause I named was also wrong.

**I claimed:** `tenant-map.generated.ts` puts slugs (`"aixmos"`) where a UUID is required.

**Actual cause:** `resolveOrgBySlugPublic()` never reads that map. It queries `organizations` by `partner_app_slug`. Three orgs were seeded with placeholder ids:

```
aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa   AIXMOS               <- 13th hex digit "a"
bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb   Moe Legacy           <- "b"
cccccccc-cccc-cccc-cccc-cccccccccccc   Operation Overdrive  <- "c"
```

Postgres stores these happily as `uuid`. **Zod 4's `.uuid()` enforces the RFC 9562 version nibble — the 13th hex digit must be `1`–`8`.** `a`, `b`, `c` all fail. Zod 3 accepted them, so this broke on a library upgrade, not on a code change.

Verified against the exact regex from the production error message:
```
FAIL  AIXMOS               aaaaaaaa-…   version nibble "a", must be 1-8
FAIL  Moe Legacy           bbbbbbbb-…   version nibble "b"
FAIL  Operation Overdrive  cccccccc-…   version nibble "c"
PASS  TMMT RENTALS         8e651b25-e7c8-4356-af64-1716a82053b0
PASS  Khan Strategies      370cd891-f6c0-4fcc-a36a-bc25f27ca229
```

**This also explains something the audit could not:** TMMT RENTALS passes validation, which is why GHL-sourced TMMT leads kept flowing the whole time. Only the AIXMOS landing-page funnel was dead.

### A-3. 🟠 I overstated the anonymous-RPC risk.

I described `lead_to_active_customer()` and six others as anonymous-callable business mutators. All seven **return `trigger`**, and PostgREST does not expose trigger-returning functions as RPC endpoints. The grants are wrong and worth revoking, but they were **not** a live hole.

The genuinely anon-callable set is five, of which two are intentional (`submit_customer_intake` — public intake, input-capped; `eval_money_rails` — token-gated). The three worth revoking are the tenancy/privilege probes: `acting_org_id()`, `is_platform_admin()`, `org_id_for_host()`.

### A-4. 🟡 `~/HAILMARY` — I said "empty scaffold", then "unknown".
The first was wrong: `find` returned nothing because the subdirectories are `0700`, not because they are empty. Corrected to UNKNOWN in the same session. Still UNKNOWN.

---

## PART B — What still stands

Everything structural in the audit survived verification, and two findings got **worse**:

| Finding | Status |
|---|---|
| Deploy pipeline jammed — 20/20 BLOCKED, `swarm-coord`, every ~3 min | ✅ **Confirmed, was still live** — now fixed (C-1) |
| `.vercel/project.json` → wrong project | ✅ Confirmed — now fixed (C-2) |
| `exec_va_tasks` runaway | 🔴 **Worse than reported:** 17,761 pending, **0 completed, ever**. Still generating (newest row today 12:00Z) |
| `outreach_touches` RLS-with-no-policy | ✅ Confirmed — fix staged (C-5) |
| Duplicate migration timestamp | ✅ Confirmed — now fixed (C-3) |
| 214 applied vs 41 in repo | ✅ Confirmed |
| Rental core: no bookings/availability/double-booking, 0 tests | ✅ Confirmed |
| Airtable never retired | ✅ Confirmed |
| Money as free text | ✅ Confirmed |
| **Lead volume** | 🔴 **The real problem.** Only **8 leads since 2026-08-19**; last genuine lead **2026-08-31**. The pipe is open and nearly nothing is coming through. |

> **The correction does not make things better. It makes them clearer.** The plumbing was fixed two days ago and the business still has almost no leads. The problem was never only the webhook.

---

## PART C — Fixes applied in this session

All verified: `eslint` 0 errors · `vitest` **479 passing (was 472)** · `next build` succeeds.

| # | Fix | File | Risk |
|---|---|---|---|
| **C-1** | **Stopped the deploy spam.** `swarm-coord` deploys disabled. That branch only carries `board.tsv` (the swarm task board) and never needed to build. | `vercel.json` | None — master unaffected |
| **C-2** | **Repointed the local Vercel link** from `tmmt-command-center` to `tmmt-ops`. Backup at `.vercel/project.json.bak-audit-20260903`. Gitignored, so local-only. | `.vercel/project.json` | None |
| **C-3** | **Broke the duplicate migration timestamp** — `20260827000000_org_ghl_connections.sql` → `20260827000001_…`. Apply order is now deterministic. | `supabase/migrations/` | None — already applied in prod under a different version |
| **C-4** | **Added a regression test for the outage** — pins the three real placeholder org ids so `z.uuid()` cannot be reintroduced. 7 tests. This is the test that would have caught the original bug. | `src/lib/agent/tenant.test.ts` | None |
| **C-5** | **APPLIED 2026-09-03 with owner approval** (versions `20260903185639` + `20260903185722`). Revoked `anon` on 7 trigger fns + 3 identity helpers, added the missing `outreach_touches` read policy, pinned `search_path` on 3 agent-job RPCs. **The `cron.unschedule(2)` line was NOT run** — the exec_va_tasks queue is being kept for AIXMOS triage. | `supabase/migrations/` | Applied + verified |

### C-5 results (measured after)

| Metric | Before | After |
|---|---:|---:|
| Total security lints | 60 | **46** |
| `anon`-callable SECURITY DEFINER fns | 12 | **2** (both intentional) |
| Functions with mutable `search_path` | 3 | **0** |
| Tables with RLS but no policy | 4 | 3 (`outreach_touches` fixed) |

**Two mistakes I made applying it, both caught by verifying rather than trusting the success flag:**

1. **`REVOKE ... FROM anon` was a no-op for 8 of the 10 functions.** Their EXECUTE came from the **PUBLIC** grant (`proacl` entry `=X/postgres`), which `anon` inherits. The statement returned success and changed nothing. Fixed by a second migration revoking from `PUBLIC` — safe because `authenticated` and `service_role` hold their own explicit grants. **Always check `pg_proc.proacl` before revoking in Supabase.**
2. **Three function signatures in the staged draft were wrong** — `claim_agent_job`, `finish_agent_job`, `fail_agent_job` take arguments; the draft wrote `()`. `ALTER FUNCTION` on a non-existent signature aborts the entire migration. Caught by checking `pg_get_function_identity_arguments` before running.

Each revoke in C-5 was checked against live production first: all three identity helpers are called with the **service-role** client (`request-org.ts:41`) or by an authenticated user, and no RLS policy references them for `anon`/`public`. Revoking breaks no live call path.

---

## PART D — What still needs YOU

| # | Decision | Why it is yours |
|---|---|---|
| ~~D-1~~ | ~~Apply the staged hardening migration~~ | ✅ **Done 2026-09-03** |
| D-2 | Turn off pg_cron job 2 (`generate_va_tasks`) | 17,761 rows, 0 ever consumed — but it is your automation |
| D-3 | Supabase → Auth → enable leaked-password protection | Dashboard toggle, one click |
| D-4 | `moe_legacy` still live in the tenant map + a `bbbbbbbb-…` org row | Governance, not engineering |
| D-5 | Classify `~/HAILMARY` | Permission-locked; one `ls` from you |
| D-6 | **Work the 81 approved + 104 waitlisted** | Still the only near-term revenue in the report |
