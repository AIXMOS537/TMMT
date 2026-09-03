# 29 · MASTER GAP ANALYSIS

| # | Area | Current state | Target | Gap | Impact | Risk | Depends on | Pri |
|---|---|---|---|---|---|---|---|---|
| 1 | Lead intake | 🔴 500s; 2,381 failures | Leads land reliably | Non-UUID org ids vs UUID schema | **All inbound leads lost, invisibly** | Critical | — | **P0** |
| 2 | Deploy pipeline | 🔴 20/20 BLOCKED | Clean deploys | `swarm-coord` push loop every 3 min | Cannot ship the fix for #1 | Critical | — | **P0** |
| 3 | Schema reproducibility | 214 applied / 41 in repo | Repo rebuilds prod | ~173 migrations | No safe testing of #1 | Critical | — | **P0** |
| 4 | Vercel project link | Points at `tmmt-command-center` | `tmmt-ops` | Wrong `project.json` | CLI deploys go astray | High | — | P1 |
| 5 | Anon RPC exposure | 12 definer fns anon-callable | Intake only | 4 trigger fns + 3 identity helpers exposed | Unauth writes; tenancy enumeration | High | — | P1 |
| 6 | Authed RPC exposure | 38 definer fns | Verified guards | `onboard_org_member`, `tmmt_token_grant`, `bg_check_decide` unverified | Privilege escalation | High | — | P1 |
| 7 | Rental core tests | 0 | Core covered | No booking/availability/payment tests | Regressions invisible | High | #10 | P1 |
| 8 | Money as data | Free text, 32/35 rows | `amount_cents` | Type + backfill | **No revenue reporting or auto-billing** | High | — | P1 |
| 9 | `moe_legacy` tenant | Live in tenant map + DB | Removed/decided | Governance | Sovereignty conflict | High | owner | P1 |
| 10 | Double-booking | **Does not exist** | Exclusion constraint | Whole feature | Two customers, one car | High *(on restart)* | vehicles | P1 |
| 11 | Duplicate models | `fleet`/`vehicles`, `active_customers`/`bookings` | One each | Decision + migration | Repeat of the Interfaces bug | High | owner | P1 |
| 12 | Monitoring | None | Uptime + alert | Health check | **13-day undetected outage** | High | — | P1 |
| 13 | Generated DB types | None | `createClient<Database>` | Type generation in CI | Column typos = silent `undefined` | High | #3 | P1 |
| 14 | `outreach_touches` | RLS, no policy | Policy | 1 policy | Outreach cannot record | Medium | — | P2 |
| 15 | `exec_va_tasks` | 17,806, +614/2d | Bounded | Stop generator | Unreadable queue depth | Medium | — | P2 |
| 16 | Staging env | None | Staging/branch DB | Supabase branching | Every change hits prod | Medium | — | P2 |
| 17 | Airtable | Still upstream | Decided | Retire or formalise | Split-brain writes | Medium | owner | P2 |
| 18 | Migration timestamps | Duplicate `20260827000000` | Unique | Rename | Undefined order | Medium | — | P2 |
| 19 | Middleware duplication | 2 files, 3 allowlists | 1 each | Consolidate | Auth mistake risk | Medium | — | P2 |
| 20 | Snapshot table | In `public`, no policy | Archived | Move | Payment data exposure | Medium | — | P2 |
| 21 | Photo/damage capture | Absent | In-form camera | Feature | Undocumented damage = loss | Medium *(on restart)* | — | P2 |
| 22 | Arrears automation | None | Grace + late fee + `PAYMENT_ISSUE` | Feature | **The failure that killed the business** | High *(on restart)* | #8 | P2 |
| 23 | Stale docs | `ARCHITECTURE.md` 3 mo old | Current | Rewrite/date | Misleads newcomers | Low | — | P3 |
| 24 | Git history | 12,788 unreachable | Tagged | Tag before gc | Permanent loss on `gc` | Medium | — | P3 |
| 25 | Dispute engine | UI, no schema, legal gate | Decided | Legal review | **Regulatory exposure** | High | legal | P3 |
| 26 | Multi-tenancy | Partial, 1 real tenant | Frozen or finished | Decision | Unpaid complexity causing #1 | High | owner | P3 |
| 27 | Repo size | 6.9 GB, 404 branches | Lean | Prune | Slow clones | Low | #24 | P4 |
| 28 | Leaked-password protection | Off | On | One click | Weak passwords | Low | — | P4 |
| 29 | Extensions in `public` | `pg_net`, `vector` | Own schema | Move | Hardening | Low | — | P4 |
| 30 | `search_path` on 3 fns | Mutable | Pinned | 1 migration | Hardening | Low | — | P4 |
