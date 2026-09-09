# 04 · DEVELOPMENT TIMELINE 2026

Reconstructed from all git refs, the 214 applied production migrations (which survive the history rewrite and are the most reliable chronology), and live telemetry.

| Period | What happened | Evidence | State today |
|---|---|---|---|
| **Feb 17–18** | Project born. Next.js scaffold → **"TMMT Rentals app: 18 admin pages, 8 public forms, Supabase integration"**. Dark mode, docs, schema. | `f96102263`, `bff7389a0` | Orphaned from `master` |
| **Mar 24–31** | Supabase Auth designed and built: SSR client, middleware session check, route-group layouts. First RLS migration. | `2d270a602`…`dda226905`, `20260331_enable_rls.sql` | **Still the live auth model** |
| **Apr 22** | 🔴 **THE MIGRATION.** Supabase project created; Airtable data copied in. Every rental table's `created_at` = this date. | Project `created_at` 2026-04-22; DB audit | **Frozen ever since** |
| **May 12–20** | Heaviest schema month: document uploads, partner portal RLS, workflow engine, ops command centre, program cube, vendor verticals, client journey, organizations + licences, dealer core, partner revenue splits. | ~40 applied migrations | Mostly live, partly unused |
| **May 30** | Rescue dispatch built and merged (PR #5). Mapbox→Leaflet swap. USB kits + GHL/Stripe checkout. Vercel split into 3 apps. | `4ab1f3292`, `604c25ece` | `incidents`(0), `units`(3) — **dispatch is dormant** |
| **Jun 4** | ⚠️ **`master` history begins here.** Everything above is orphaned. | `git log` | — |
| **Jun 9–11** | Credit/funding sessions, operator training + certification, affiliate scoreboard, **B3 AI sales agent** (conversations, messages, audit events), lead-routing engine, kill switch. | ~30 migrations | Agent tables **0 rows** |
| **Jun 13–22** | Tenancy hardening phase 1, memory fabric, quo support, work routing, installation licensing, comm channels, multitenant hardening, token ledger, garage, mesh nodes, **`exec_va_tasks` queue + `generate_va_tasks()`**. | ~35 migrations | Queue now **17,806 rows** |
| **Jul 1** | Moe Legacy soft-cut migration. | `cut_moe_legacy_soft_v1` | Tenant map **still ships `moe_legacy`** |
| **Jul 7–9** | Operator provisioning, seat caps, collections truth view, PII side-door lockdown. | ~12 migrations | Live |
| **Jul 16–22** | Compliance-gated prequalified leads, **DNC readable so the gate fails closed**, outreach engine + round robin, money meter, detail line data model. | ~20 migrations | Outreach built; **`outreach_touches` = 0 rows** |
| **Aug 19** | 🔴 **Lead intake starts 500ing** (missing Supabase env on Vercel production). | Vercel: first seen 2026-08-19T22:27:12Z | 2,197 failures |
| **Aug 20–28** | People/form spine, missing RLS policies, GHL webhook idempotency, tasks table, admin-only sensitive tables, **agent spine**, routing engine (9 migrations in one night), **`port_live_airtable_automations`**. | ~30 migrations | Live |
| **Aug 27** | Host-based tenancy wired into middleware. | `be9b38ee0` | **Root cause of P0-1** |
| **Aug 31–Sep 1** | Signup invites, dispute engine RLS, program documents, dispute clients out of localStorage, packages price columns. | 8 migrations | Dispute engine tables **absent from production** |
| **Sep 1 19:29** | ✅ Env vars fixed — the 2,197-error run **stops**. | Vercel telemetry | — |
| **Sep 1 19:30** | 🔴 **`OrgRowShapeError` begins 41 seconds later.** 184 more failures to 23:28. | Vercel telemetry | **Believed fixed; is not** |
| **Sep 1–2** | Owner-side audit produced `SCHEMA-DRIFT.md` and `BUSINESS-REQUIREMENTS-SPEC.md` v3. | `074fc0cc9` | Good work; §1.5 now outdated |
| **Sep 3** | This audit. Swarm pushing a blocked deploy every 3 minutes. | Vercel | **Active** |

## The shape of the year
**Feb–Apr:** a car-rental app was built and its data migrated.
**May–Aug:** the rental business wound down while engineering accelerated into tenancy, licensing, agents, credit/funding and an operator network.
**The divergence point is 2026-04-22.** After that date the software and the business stopped describing the same company.
