# QA, Security & Scale-Readiness Report

**Date:** 2026-06-16
**Scope:** everything built this cycle — Memory Fabric, Quo support→routing,
channel topology, installation lock, HAILMARY — checked, smoke-tested, security-
tested, and assessed for multi-tenant growth.

## Verdict
**Ready for daily internal use and a pilot.** Build is green, security advisors
show **0 errors**, all new tables are RLS-protected, and cross-tenant routing
isolation is verified. One gating item before *external client logins*: add
org-scoped RLS for client self-service (see Residual #4). Today's model is
provider-operated, which is correct for daily-drive + pilot.

## 1. Build & compile
- `npm run build` — **green** (Next 16 / Turbopack), all routes compile.
- Repo scanned clean of stray artifacts.

## 2. Security advisors (Supabase)
- **0 ERROR**, 89 WARN, 2 INFO across the whole project.
- **My 9 new tables: zero findings** — RLS correctly enabled with policies.
- Flagged: 4 of my `SECURITY DEFINER` RPCs were anon-callable — **fixed** in
  `20260616500000_multitenant_hardening.sql`:
  - `assign_work`, `rank_work_candidates` → `REVOKE FROM PUBLIC`, granted
    `service_role` only.
  - `backend_unlocked_for`, `is_owner` → anon revoked; kept `authenticated`
    (needed by middleware + RLS) + `service_role`.
- Remaining WARNs are pre-existing/project-wide (52 definer fns, public-form
  `rls_policy_always_true`, `extension_in_public` for pgvector/pg_net) — see
  Residual.

## 3. RLS & data isolation
- RLS enabled on all 9 new tables: `memory_entities/events/facts`,
  `customer_services`, `verticals`, `routing_candidates`, `work_assignments`,
  `installations`, `comm_channels`.
- Model = **provider-operated**: provider staff (`is_staff`) manage; client-org
  users have **no direct table access** (so no client sees another client's
  rows). Service role (server) bypasses for ingestion/routing.
- Owner-only facts gated by `is_owner()`; backend lock owner-exempt in SQL.

## 4. Multi-tenant correctness (the growth-critical fix)
- **Found:** `cases` had no `org_id`, and `rank_work_candidates` didn't scope by
  tenant → risk of assigning one tenant's work to another's people.
- **Fixed:** added `cases.org_id`; ranking now only considers candidates in the
  case's org **or** the shared pool (`org_id IS NULL`); ingestor stamps the case
  with the service's org.
- **Smoke-tested live:** a TMMT case sees 18 candidates (14 staff + 4 shared
  vendors); a **Pilot-org case sees only the 4 shared** — the 14 TMMT staff are
  excluded. **No cross-tenant leak.**

## 5. Smoke tests performed (live DB)
| Test | Result |
|---|---|
| `recall("Lopez")` returns role + numbers + history | ✅ |
| Routing: case → rank full pool → atomic assign | ✅ (assigned to employee) |
| Multi-tenant isolation (Pilot ≠ TMMT pool) | ✅ |
| Opted-in gate lookup (entity + customer_services) | ✅ |
| Personal line is `do_not_contact` (guard) | ✅ |
| All 6 migrations applied; RLS on all new tables | ✅ |

## 6. Fail-closed checks
- `/api/webhooks/quo` (x-quo-webhook-secret), `/api/webhooks/ghl`
  (x-ghl-webhook-secret), `/api/memory` (Bearer `MEMORY_API_TOKEN`),
  `/api/cron/quo-poll` (CRON_SECRET) all **reject without the secret**.
- Capture (`logMemoryEvent`) and routing/escalation are **fail-open** — they
  never block or crash the primary path; idempotent via `dedupe_key`.

## 7. Sustainability for growth
- **Tenancy:** per-`organization` + `installations`; routing/data org-scoped.
- **Vertical-agnostic:** new business lines = `verticals` + `routing_candidates`
  rows, no code change.
- **Indexes:** time/entity/actor/source on events; GIN on capability/vertical
  arrays; per-org indexes on cases/candidates.
- **Vendor-neutral brain:** `remember/recall` stable; recall can move to pgvector
  semantic / hosted backend with no caller change.

## 8. Residual recommendations (prioritized)
1. **Before external client logins:** add org-scoped RLS (use existing
   `is_org_member`/`org_roles`) to `memory_*`, `cases`, `routing_candidates`,
   `customer_services` so client staff read only their org. (Today: provider-only
   access — safe, but not self-service.)
2. **Supabase Auth dashboard:** enable **Leaked Password Protection** (advisor WARN).
3. **Schema hygiene (low risk):** move `vector`/`pg_net` out of `public` schema.
4. **Public-form tables** (`incoming_leads`, `tickets`, …) have permissive
   policies for anon insert — review their SELECT exposure (pre-existing).
5. **Scale ops:** enable Supabase PITR/backups; tune pgvector `ivfflat lists`
   once `memory_events` grows; add load tests for the webhook + routing path.
6. **Secrets:** rotate `MEMORY_API_TOKEN`/webhook secrets on a schedule; keep all
   service keys server-side (never shipped — see `docs/SECURITY-LICENSING.md`).

## 9. Migrations in this cycle (all applied live)
`20260616000000_memory_fabric` · `100000_quo_support_dispatch` ·
`200000_work_routing` · `300000_installation_licensing` · `400000_comm_channels` ·
`500000_multitenant_hardening`.
