# MASTER FORENSIC SYSTEM AUDIT — TMMT / AIXMOS
**Repository:** `~/projects/TMMT` → `github.com/AIXMOS537/TMMT` (private)
**Production:** Vercel `tmmt-ops` · Supabase `uapxakmlwnpfsftfeezx` (us-west-2, PG 17.6)
**Window audited:** 2026-01-01 → 2026-09-03 (project genesis proved to be **2026-02-17**)
**Method:** repo + all-refs git history + live production database + live Vercel runtime telemetry
**Mode:** READ-ONLY at audit time. No production data, migration, integration, credential or deploy was modified.

> ## ⚠️ CORRECTED 2026-09-03 — read `39_CORRECTIONS_AND_FIXES_APPLIED.md` first
> The three read-only SELECTs in §7 were subsequently run with owner approval and **overturned this report's headline finding.** P0-1 (lead intake) **was already fixed by the team on 2026-09-01** — hours after the telemetry window analysed here. Lead intake is **working**. The root cause was also different from the one stated below. Sections 2, 4 and 7 are corrected in place; the corrections file has the full account.

---

## THE ONE-PARAGRAPH ANSWER

This is **not** a car-rental application that drifted off course. It is a **multi-tenant agency/platform operating system** that was built on top of a car-rental business **which had already stopped operating**. The rental data was migrated out of Airtable on **2026-04-22** and then froze — every operational table carries that exact `created_at` and effectively nothing operational has been written since. Meanwhile, essentially all engineering from June onward went into tenancy, licensing, AI agents, credit/funding, an operator network and sales funnels. **The software is roughly two business models ahead of the business.** The most valuable thing in the system is not code: it is **1,209 people, 876 leads, 1,642 GHL contacts, 104 on a waitlist and 81 approved-but-never-placed** sitting in a database — behind a lead-intake pipe that has been returning HTTP 500 since 2026-08-19 and, as of this audit, **is still broken for a second, different reason that nobody has noticed.**

---

## 1. EVIDENCE BASELINE (all CONFIRMED)

| Measure | Value | Source |
|---|---:|---|
| Tracked files | 1,451 | `git ls-files` |
| TypeScript/TSX source files | 459 | `find src` |
| Page routes | 105 | `src/app/**/page.tsx` |
| API routes | 28 | `src/app/api/**/route.ts` |
| Markdown docs | 362 | `git ls-files docs/` |
| Shell scripts | 153 | extension census |
| Commits reachable from HEAD | **525** | `git log` |
| Commits across **all** refs | **13,313** | `git log --all` |
| Branches | **404** | `git branch -a` |
| Live tables (public schema) | **168** | Supabase `list_tables` |
| Migrations applied in production | **214** | Supabase `list_migrations` |
| Migration files in repo | **41** (+3 parked) | `supabase/migrations` |
| Unit tests | **472 passing / 57 files** | `npx vitest run` |
| TODO/FIXME markers in `src/` | **3** | `git grep` |
| Security lints (ERROR level) | **0** | Supabase advisors |
| Security lints (WARN level) | **56** | Supabase advisors |

Two facts sit oddly together and both are true: **472 tests pass, there are 3 TODOs in 459 files, and there are zero ERROR-level security lints** — this is carefully written code — while **the core business the app is named after has not recorded a transaction since March.** The problem here is not craftsmanship. It is scope and direction.

---

## 2. WHAT WAS ALREADY KNOWN (verified, credited, and corrected)

An audit was already performed by the owner's side on 2026-09-01/02, producing `docs/SCHEMA-DRIFT.md` and `docs/BUSINESS-REQUIREMENTS-SPEC.md` (v3). **Both are good work and largely hold up.** This audit verified them rather than repeating them.

**Verified as still true:**
- Schema drift is real (they measured 220-vs-39; I measure **214 applied vs 41 in repo** — same conclusion, the repo cannot rebuild production).
- The database froze at the 2026-04-22 migration.
- Collections, not demand or pricing, killed the rental business (26 of 31 payments Overdue).
- `active_customers.payment_amount` is free text and unqueryable.

**Corrected by this audit — material, and it changes the top priority:**

> `BUSINESS-REQUIREMENTS-SPEC.md` §1.5 states the lead webhook has 500'd **935 times** since 2026-08-19 because Vercel production is missing Supabase env vars.
>
> Live Vercel telemetry says the true count was **2,197**, and that **this error stopped at 2026-09-01T19:29:28Z** — the env vars *were* fixed.
>
> **41 seconds later a completely different error took over the same route:** `OrgRowShapeError: Org row failed schema validation for slug:aixmos — path ["id"], "Invalid UUID"`, **184 occurrences**, running until 2026-09-01T23:28:53Z.
>
> **The outage was fixed and immediately re-broken by a second, unrelated defect. The doc records the first cause as current. It is not.** See §4 P0-1.

This is exactly the failure mode the audit was commissioned to catch: a fix that looked complete because the original error disappeared.

---

## 3. WHAT ACTUALLY EXISTS (the honest architecture)

```
        Airtable  ──(still upstream, never replaced)──┐
   GoHighLevel ───(1,642 contacts, live)──────────┐   │
                                                  ▼   ▼
  public forms ──▶ /api/leads/webhook ──▶ [ 500 ] ──X  incoming_leads (876)
  (8 pages, all 200 OK — they look alive)                    │
                                                             ▼
                                              people (1,209) · intake_events (880)
                                                             │
                                                             ▼
                                            exec_va_tasks (17,806 and climbing)
                                                             │
                                                        ( nothing sends )

  FROZEN SINCE 2026-04-22 ─────────────────────────────────────────
  fleet(43)  active_customers(35)  customer_payments(31)  tickets(308)
  waitlist(104)  background_checks(299)  insurance(24)  contracts(2)

  BUILT BUT NEVER USED ────────────────────────────────────────────
  bookings(0)  payments(0)  vehicles(2)  vehicle_damage_reports(0)
  vehicle_media(0)  contract_instances(0)  lto_agreements(0)
  documents(0)  form_submissions(0)  tasks(0)  dispute_clients(0)
```

**The system has two of everything that matters.** A live, Airtable-shaped rental model (`fleet`, `active_customers`, `customer_payments`) that the admin UI actually reads and writes, and a cleaner, "proper" rental model (`vehicles`, `bookings`, `payments`) that was designed, migrated, RLS'd — and **never wired to a single line of application code**. `git grep` finds **zero** occurrences of `from("bookings")`, `from("vehicles")` or `from("payments")` in `src/`. The good schema is dead; the legacy schema is load-bearing.

---

## 4. PRIORITIZED FINDINGS

### P0 — STOP EVERYTHING

**P0-1 · ~~Lead intake is still broken, for a second reason.~~ → RESOLVED 2026-09-01, before this audit ran.**
**The stated root cause above was wrong.** `resolveOrgBySlugPublic()` does not read the static tenant map at all — it queries `organizations` by `partner_app_slug` (`tenant.ts`). The real cause: three orgs were seeded with placeholder ids — `aaaaaaaa-…`, `bbbbbbbb-…`, `cccccccc-…`. Postgres stores these fine as `uuid`; **Zod 4's `.uuid()` enforces the RFC 9562 version nibble** (13th hex digit must be 1-8), so `a`/`b`/`c` fail. Zod 3 accepted them — it broke on upgrade. AIXMOS (`aaaaaaaa-…`) failed; TMMT RENTALS (`8e651b25-…`) passed, which is why GHL-sourced TMMT leads kept flowing throughout.
**Already fixed** in `e57e22ea9` — keeps the shape check, drops the version demand. Both fix commits are ancestors of HEAD.
**Now covered by a regression test** added 2026-09-03: `src/lib/agent/tenant.test.ts` (7 tests) pins the three real placeholder ids so `z.uuid()` cannot be reintroduced here.

**P0-2 · Production deploys are jammed by an automation loop. CONFIRMED.**
The **20 most recent `tmmt-ops` deployments are all `state: BLOCKED`** — every one from branch `swarm-coord`, author `swarm@tmmt`, message "swarm: update coordination state", firing roughly **every 3 minutes and still running during this audit**. Nothing else can deploy cleanly through that noise, and it burns account quota continuously.
**Fix:** stop the swarm coordination push loop, or stop it writing to a branch Vercel builds.

**P0-3 · The repo cannot rebuild production.** 214 applied vs 41 in repo. Already documented in `docs/SCHEMA-DRIFT.md`; re-confirmed. It is P0 because P0-1's fix touches org identity, and there is no reproducible schema to test it against.

### P1 — CRITICAL

**P1-1 · The repo deploys to the wrong Vercel project. CONFIRMED — not previously documented.**
`.vercel/project.json` → `tmmt-command-center` (`prj_FNLA…`, **not** git-linked). The real production project is `tmmt-ops` (`prj_Cw4l…`, linked to `AIXMOS537/TMMT`). A `vercel` CLI deploy from this checkout targets the wrong project.

**P1-2 · 50 `SECURITY DEFINER` functions are RPC-callable by role.** 12 by `anon`, 38 by `authenticated`. The `anon` set includes **business-state mutators**: `lead_to_active_customer()`, `submit_customer_intake()`, `auto_route_intake()`, `on_new_lead()`, `expense_fill_from_vehicle()`, `notify_new_fleet_vehicle()` — several are trigger functions that should never have been RPC-exposed — plus `is_platform_admin()` and `acting_org_id()`, which let an anonymous caller probe the tenancy model. No ERROR-level lints and RLS is on for all 168 tables, so this is hardening, not a breach.

**P1-3 · Zero test coverage of the rental core.** 472 tests pass and cover brand, tenancy, GHL, agent compliance, PII redaction and money-meter. **None** cover bookings, availability, double-booking, vehicle state or payments. Double-booking prevention **does not exist in any form** — there is no availability check anywhere in `src/`.

**P1-4 · `moe_legacy` is still a live tenant.** `tenant-map.generated.ts:60` ships a `moe_legacy` tenant (displayName "AIXMOS Credit") with brand assets, and production retains `portal_clients` / `partners` / `partner_referrals` from `moe_legacy_001–003` migrations. Given the 2026-07-01 terminal cut this is a **governance conflict requiring an owner decision**, not something an audit should silently resolve.

### P2 — IMPORTANT
- `exec_va_tasks` = **17,806 rows, +614 in the two days** since the last audit read 17,192. A generator with no consumer.
- **Duplicate migration timestamp:** two files both named `20260827000000_*` (`acting_org_id_matches_is_org_member`, `org_ghl_connections`) — ordering is undefined.
- 4 tables have RLS enabled with **no policy** (`customer_payments_snapshot_20260706`, `outreach_touches`, `signup_invites`, +1). `signup_invites` is deliberate; `outreach_touches` fails closed and is why it holds 0 rows.
- `customer_payments_snapshot_20260706` — a one-off snapshot left in production.
- Leaked-password protection is disabled in Supabase Auth.
- `pg_net` and `vector` extensions installed in `public`.

### P3 — STRATEGIC
- Airtable was never replaced (§5). Decide deliberately: finish the migration or formally keep Airtable as system-of-record for Leads/Ops Locations.
- Multi-tenancy is **partially built** — `organizations`(9), `organization_domains`, host-based tenant resolution, per-tenant branding, licensing. It is further along than the business needs and is the direct cause of P0-1.

---

## 5. AIRTABLE PARITY — THE HEADLINE

**The Airtable replacement was never completed, and Airtable is still an active upstream system.** `src/app/api/webhooks/airtable/route.ts` receives Airtable automations and calls `fetchAirtableRecord()` to pull live records; migration `20260826_port_live_airtable_automations` ports automations rather than retiring them; `npm run export-operators` reads *from* Airtable.

What actually happened: **the data was copied on 2026-04-22 and the workflow was not.** Views, interfaces, forms, rollups and automations were partially rebuilt as bespoke React pages, and three of the four Interfaces screens shipped reading a `status` column that does not exist (the real columns are `vehicle_status` / `appointment_status` / `contract_status`) — showing empty kanbans for months without erroring, because there is no generated `Database` type to catch it. Full matrix: `06_AIRTABLE_PARITY.md`.

---

## 6. GIT FORENSICS — THE MISSING FOUR MONTHS

**Genesis: `f96102263`, 2026-02-17, followed 2026-02-18 by `bff7389a0` — "TMMT Rentals app: 18 admin pages, 8 public forms, Supabase integration."** The project is a car-rental admin app, by its own first commit.

**Mainline history was rewritten.** `master` starts 2026-06-04. All 331 commits from Feb–May — auth design, the original rentals app, dispatch, the Vercel/GHL work — survive **only in unreferenced branches**. Commits appear in near-exact duplicate pairs (same message, different SHA), the signature of a history rewrite where both object sets persist. This is consistent with the documented 2026-07-04 sovereignty scrub and the `claude/history-scrub-runbook` branch.

**Consequence:** `git log` on `master` cannot answer "what happened this year", which is precisely why this audit had to reconstruct from `--all`. Nothing is lost yet, but 12,788 unreachable commits across 404 branches are one `git gc --prune` away from being lost. Full timeline: `04_DEVELOPMENT_TIMELINE.md`.

---

## 7. THE THREE READ-ONLY CHECKS — RUN 2026-09-03, RESULTS BELOW

Run with explicit owner approval. **They overturned P0-1.** Results:

| Query | Result |
|---|---|
| `organizations` | `id` is `uuid`, **no `slug` column**. 9 rows. 3 carry non-RFC-4122 placeholder ids (`aaaaaaaa-…`, `bbbbbbbb-…`, `cccccccc-…`) — the actual root cause. |
| `incoming_leads` | newest **2026-09-01 23:30:30Z**, org = AIXMOS, source = `integration-test` → **the fix works**. 876 total; only **8 since 2026-08-19**; last *real* lead 2026-08-31. |
| `exec_va_tasks` | **17,761 `pending`**, 45 `blocked_dnc`, **0 completed ever**. Newest row 2026-09-03 12:00Z — pg_cron job 2 is still generating daily. |

The original queries, for reference:

```sql
-- 1. Confirms P0-1's exact root cause (slug in DB vs slug in generated map)
select id, slug, name from public.organizations order by created_at;

-- 2. Distinguishes "intake fixed" from "no traffic since"
select max(created_at), count(*) filter (where created_at > '2026-09-01') from public.incoming_leads;

-- 3. Sizes the runaway queue before touching it
select status, count(*) from public.exec_va_tasks group by status;
```

---

## 8. IF THIS WERE MY BUSINESS, HERE IS EXACTLY WHAT I WOULD DO NEXT

**This week — restore the money pipe, and nothing else.**
1. Run the three SELECTs above. Fix the org-id mismatch (P0-1). Redeploy. Post a test lead and *watch a row land*. Until a lead provably arrives, every other task is decoration.
2. Kill the `swarm-coord` deploy loop (P0-2) — you cannot ship a fix through 20 blocked deployments.
3. Point `.vercel/project.json` at `tmmt-ops` (P1-1).

**Next two weeks — harvest what you already own.**
4. You have **81 approved-never-placed** people and **104 on a waitlist**, already consented, already in GHL. That is the entire near-term revenue opportunity and it needs no new software. Work it through the existing GHL round-robin, manually, draft-never-send.
5. Run `scripts/migrations-pull.mjs --dry-run` and commit the 173 missing migrations so the repo can rebuild production.

**Then — and only then — decide the identity question.**
The audit's real finding is that **this codebase is three products wearing one repo**: a rental OS, a credit/funding business, and a multi-tenant platform for reselling both. All three are half-built; none is finished. The rental business is not currently operating, so the rental OS is the *least* urgent of the three despite giving the repo its name.

**My recommendation: stop building the platform.** Multi-tenancy, licensing, installation locks, the token ledger and the operator network are what broke lead intake (P0-1 is literally a tenancy bug killing leads) and there is no second tenant paying for them. Freeze that surface. Run the credit/funding + lead business on GHL as the CRM with this app as the intake and ops desk, and let the rental OS stay frozen until there are vehicles again. Build once you have a customer for it — right now the code is ahead of the business in every direction except the one that makes money.

**What to stop building immediately:** white-label/dealer SaaS, the dispute engine (9 tables, never applied to production), the `bookings`/`vehicles` parallel schema, and anything else that adds a table before it adds a customer.

---

## REPORT INDEX
`01`–`38` accompany this file; `01_MASTER_EXECUTIVE_SUMMARY.md` is the short form for a non-technical reader, `29_GAP_ANALYSIS.md` and `37_MASTER_BACKLOG.md` are the working documents.

**Evidence standard:** every claim above is CONFIRMED against repo, git, live DB or live Vercel telemetry. Where evidence was insufficient it is labelled UNKNOWN and listed in `38_CEO_CTO_FINAL_ASSESSMENT.md` rather than guessed.
