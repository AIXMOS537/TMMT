# PRODUCTION MIGRATION PROVENANCE DELTA (lane R2, delta 1 + ledger drift register)

**Produced:** 2026-09-22 (UTC) · **Lane:** R2 evidence (read-only) · **Base package:** `EXTRACTION_FINAL_REPORT.md` §12/§15 and `TMMT_CURRENT_STATE_CHECKPOINT.md` §2 (frozen, not edited).
**What was touched:** nothing. Production `uapxakmlwnpfsftfeezx` was read through `execute_sql` as catalog metadata, `supabase_migrations.schema_migrations` (including the `statements` column), `ops.prod_baton_status()`, `ops.prod_write_baton` rows (metadata) and aggregate counts. No writes, no DDL, baton not acquired (`prod_baton_status` = `{"state":"free"}` at read time). Git read-only against `C:\dev\TMMT-LIVE` after `fetch origin` (remote-tracking refs only). `origin/master` = `4cca6835`.

---

## 1. Ledger count

| Measure | Value (2026-09-22) |
|---|---|
| `supabase_migrations.schema_migrations` rows | **281** (extraction package said 279; checkpoint said 281 — checkpoint is current) |
| Newest version | `20260922005007 partner_acquisition_least_privilege` |
| Rows dated ≥ 2026-09-17 | 17 (all with `array_length(statements,1) = 1`, i.e. one SQL string per row, the shape `apply_migration`/MCP-style applies leave) |
| `supabase/migrations/*.sql` top-level on `origin/master` | 92 entries in the tree listing (includes `LEDGER-SNAPSHOT.txt`, `_staged/`, `_parked/`); newest dated file `20260919221500_partner_tables_least_privilege_for_anon.sql` |
| `LEDGER-SNAPSHOT.txt` on master | 273 versions, last pinned `20260920014756` → the **8 rows from `20260921230719` onward are not in the pin** (281 − 273 = 8) |
| `KNOWN_UNAPPLIED` (`src/lib/db/migration-drift.test.ts:55`) | 53 (unchanged; see checkpoint §2 arithmetic note — not resolved here) |

## 2. `20260922004813 index_hot_foreign_keys_and_drop_duplicate` — what it did

Applied SQL (read from `statements[1]`, one statement string, 3 sections):

1. `drop index if exists public.parties_org_idx;` — comment states it was a byte-identical duplicate of `idx_parties_organization_id` and backed no constraint.
2. `create index if not exists …` on seven FK columns: `intake_events(program)`, `incoming_leads(org_id)`, `background_checks(reviewed_by)`, `operator_training_progress(module_id)`, `coo_briefings(submitted_by)`, `memory_facts(source_event)`, `client_journey(booking_id)`. Comment: "DELIBERATELY NOT doing all 63 the advisor lists" (i.e. it was driven by the Supabase performance advisor's unindexed-FK list).
3. `create index if not exists partner_acquisition_fleet_vehicle_id_idx on public.partner_acquisition (fleet_vehicle_id);`

### Catalog cross-check (pg_indexes / pg_constraint / pg_stat_user_indexes / pg_stat_user_tables)

| Object | Present now | Backs a constraint | `idx_scan` | Table live rows |
|---|---|---|---|---|
| `parties_org_idx` | **absent** (dropped) | — | — | `parties` 0 |
| `idx_parties_organization_id` | present, btree `(organization_id)` | no | 2 | `parties` 0 |
| `intake_events_program_idx` | present | no | 0 | 908 |
| `incoming_leads_org_id_idx` | present | no | **8** (7,136 tuples read) | 892 |
| `background_checks_reviewed_by_idx` | present | no | 0 | 299 |
| `operator_training_progress_module_id_idx` | present | no | 0 | 120 |
| `coo_briefings_submitted_by_idx` | present | no | 0 | 75 |
| `memory_facts_source_event_idx` | present | no | 0 | 57 |
| `client_journey_booking_id_idx` | present | no | 0 | 35 |
| `partner_acquisition_fleet_vehicle_id_idx` | present | no | 0 | 0 |

Constraints on the two tables named in the drop/partner sections: `parties` has only `parties_pkey` + FK `parties_organization_id_fkey`; `partner_acquisition` has only `partner_acquisition_pkey` + FK `partner_acquisition_fleet_vehicle_id_fkey`. **No UNIQUE index was dropped, no constraint was dropped or added, no FK was changed.**

### Behaviour verdict

**Performance-only DDL.** Plain (non-`CONCURRENTLY`) `CREATE INDEX` takes a SHARE lock for the build; on tables of ≤ 908 rows that is sub-second. Only `incoming_leads_org_id_idx` has been used since (8 scans). Nothing in this migration changes RLS, grants, triggers, functions, views or data. It does not touch `is_staff()`, `profiles`, `change_log`, `bookings` or any credit table.

### Intersections with active milestones

| Track | Touches | Finding |
|---|---|---|
| GHL M1/M2 (router intake) | `incoming_leads`, `intake_events` | Branch migrations `20260921120000_m2_router_intake_schema_baseline.sql` / `20260921130000_m1_intake_tenant_trust.sql` (all `wt-ghl-m*`) alter `incoming_leads` (add `email_normalized`, toggle `incoming_leads_set_updated_at`) and create only `ghl_*`/`routing_*`/`identity_*` indexes. **No index-name collision** (grep of every `wt-ghl-m*` and `wt-sec-partner-acq` migration for the eight new names: 0 hits). Whether M2's `check:m2-schema` (279 pinned objects) counts indexes and will now see +7/−1 drift: **UNKNOWN**, not tested here. |
| GHL M5/M6/M7 | none of `ghl_contact_links`, `ghl_webhook_inbox`, `routing_*` (0 of those tables exist on prod) | no intersection |
| Credit (C1–C3) | `background_checks(reviewed_by)` | index only; credit case tables do not exist on prod; no effect on CROA gate |
| Partner acquisition (P0) | `partner_acquisition(fleet_vehicle_id)` | index on the FK the P0 policy `WITH CHECK` requires to be `null` for intake rows; 0 rows; no policy effect. Applied 89 s before baton 9 was acquired for `005007` (see §3) |
| Journey / client portal | `client_journey(booking_id)` | index only |

### Provenance search

| Where | Method | Result |
|---|---|---|
| Every remote-tracking branch (115 refs) | `git grep -l "index_hot_foreign_keys" $(git branch -r …)` and `"idx_hot\|hot_foreign"` | **0 files** |
| Every worktree under `C:\dev\wt-*` (36) + `TMMT-LIVE` | file-name search `supabase/migrations/*index_hot*` and content grep for the eight index names | **0 files** |
| Commit messages, all refs | `git log --all --grep='hot_foreign\|index_hot\|hot foreign\|duplicate index'` | **0 commits** |
| `ops.prod_write_baton` | all rows read (metadata) | **no row names it.** Baton 8 (`profiles_protect_access_columns`) released 2026-09-21 23:42:30Z; baton 9 (`partner_acquisition_least_privilege`) acquired 2026-09-22 **00:49:41Z**. The index migration's version stamp is **00:48:13Z** — inside the gap, **88 s before baton 9**. It was therefore applied while the baton was FREE, not under any hold. |
| Package docs (`EXTRACTION_FINAL_REPORT.md`, checkpoint, Forge tasks, `_review/*`) | grep | absent (already recorded as PACKAGE GAP 2 in the checkpoint) |
| Advisor origin | comment text "the advisor lists 63" | consistent with the Supabase performance advisor (`get_advisors`) — a tool available to any MCP-connected session; not attributable to a person or session from this alone |

**Inference (flagged as inference, not evidence):** the wording and formatting of the `004813` comment block matches the authorial style of `005007` (same session-9 holder), and the two applies are 89 s apart. The holder prefix on baton 9, `claude:101528f1-…`, is the session id of the orchestration session that spawned this lane. That makes "same operator, applied just before taking the baton" the most likely story — but no artefact records it.

### VERDICT

**`20260922004813`: PROVENANCE UNKNOWN. Performance-only (7 FK indexes created + 1 duplicate index dropped, no constraint/FK/policy change). Applied outside any baton hold. No repository file exists anywhere. Needs: (a) owner acknowledgement that an un-batoned prod DDL write happened, (b) a repo file so the drift register can pin it, (c) baton-process note — read-only lane, no recommendation beyond recording.**

## 3. Ledger drift register — rows since 2026-09-17 vs repository

Legend: **file on master** = a top-level `supabase/migrations/*.sql` on `origin/master` whose name matches; "version differs" = the ledger version stamp is the apply time, not the file's stamp (MCP-style apply), which the drift pin already handles by name mapping.

| # | Ledger version | Name | File on `origin/master` | File anywhere else | Baton coverage (from `ops.prod_write_baton`) |
|---|---|---|---|---|---|
| 1 | `20260917195950` | `client_and_org_scoped_sensitive_access` | `20260916230000_…` (version differs) | wt-2a-profiles, wt-c3-auth | none — no baton row on 09-17 (snapshot line 276: "applied by this session", pre-hook era) |
| 2 | `20260917200051` | `bookings_no_double_booking` | `20260916235900_…` | same | none |
| 3 | `20260917200155` | `financing_applications_and_ownership_optin` | `20260917000000_…` | same | none |
| 4 | `20260917200241` | `education_ack_by_journey` | `20260917010000_…` | same | none |
| 5 | `20260917200339` | `partner_tenancy` | `20260917040500_…` | same | none |
| 6 | `20260917200633` | `fleet_to_vehicles_bridge_resume` | `20260917000100_…` | same | none |
| 7 | `20260917200710` | `partner_status_overview_security_invoker` | **no separate file**; the one statement (`alter view … security_invoker = true`) is line 339 of `20260917040500_partner_tenancy.sql`; snapshot records it as a "fix" | — | none |
| 8 | `20260919221554` | `partner_tables_least_privilege_for_anon` | `20260919221500_…` | wt-2a-profiles, wt-c3-auth | none (no baton row 09-19) |
| 9 | `20260920014756` | `close_orphaned_garage_public_read` | `20260919215500_…` | same | none (no baton row 09-20) |
| 10 | `20260921230719` | `change_log_from_airtable_retirement` | **MISSING** | **nowhere** (0 branches, 0 worktrees) | **none** — applied 23:07Z, baton 8 not taken until 23:41Z |
| 11 | `20260921233425` | `partner_acquisition_supply_side` | **MISSING** | **nowhere** | **none** (23:34Z) |
| 12 | `20260921233517` | `partner_acquisition_public_intake_policy` | **MISSING** | **nowhere** | **none** (23:35Z) |
| 13 | `20260921234148` | `profiles_protect_access_columns` | `20260917160000_…` (version differs; PR #256 draft records it) | wt-2a-profiles, wt-c3-auth | **baton 8** (23:41:30–23:42:30Z), approval "owner approved in chat 2026-09-21" |
| 14 | `20260922000537` | `fix_v_partner_pipeline_security_invoker` | **MISSING** | **nowhere** | **none** (00:05Z; baton free) |
| 15 | `20260922000642` | `revoke_anon_execute_on_internal_helpers` | **MISSING** | **nowhere** | **none** (00:06Z; baton free) |
| 16 | `20260922004813` | `index_hot_foreign_keys_and_drop_duplicate` | **MISSING** | **nowhere** | **none** (00:48Z; baton free) — §2 |
| 17 | `20260922005007` | `partner_acquisition_least_privilege` | **MISSING on origin** | only `sec/partner-acquisition-rls` @ `620e100e` (local branch in `C:\dev\wt-sec-partner-acq`, 1 ahead of master, **not pushed** — no `origin/sec/partner-acquisition-rls` ref exists) | **baton 9** (00:49:41–01:09:57Z), approval `PARTNER-ACQ-RLS-P0-2026-09-21`, result `applied+verified` |

### Register totals

- Ledger rows since 09-17: **17**.
- **Files missing on `origin/master`: 7** (rows 10, 11, 12, 14, 15, 16, 17). Of these, **6 have no file in any branch or worktree** (10, 11, 12, 14, 15, 16) and **1 exists only on an unpushed local branch** (17).
- Row 7 has no file of its own but its SQL is contained in a master file (covered, not missing).
- Rows 1–9 are covered by name (version stamps differ, which is the known MCP-apply pattern).
- **Baton coverage since the baton existed (2026-09-16):** of the 8 rows applied on 09-21/22, **2 were under a baton (13, 17) and 6 were not (10, 11, 12, 14, 15, 16)**. Rows 1–9 pre-date consistent baton use (the baton table has rows only on 09-16 and 09-21/22; ids 2 and 6 are absent from the id sequence — unexplained gaps, possibly failed or removed acquisitions; UNKNOWN).

### What the six file-less rows contain (heads only, from `statements[1]`)

- `change_log_from_airtable_retirement` — creates `public.change_log` as a real table (Airtable "Change & Update Log" port); this is the table whose `authenticated ALL USING(true)` policy is SEC-12 OPEN in the package.
- `partner_acquisition_supply_side` — `create table if not exists public.partner_acquisition …` (supply-side mirror of `incoming_leads`).
- `partner_acquisition_public_intake_policy` — anon INSERT-only policy `partner_acq_anon_insert` (the policy `005007` keeps).
- `fix_v_partner_pipeline_security_invoker` — sets `security_invoker` on `v_partner_pipeline`.
- `revoke_anon_execute_on_internal_helpers` — revokes anon EXECUTE on three SECURITY DEFINER helpers (cited in the package as E3).
- `index_hot_foreign_keys_and_drop_duplicate` — §2.

The three `partner_acquisition` creators (11, 12, 14) are the "creating migrations not in the repo" the checkpoint §1(b) already names. Rows 10 and 15 are additional file-less prod DDL not previously itemised in the package as file-less.

## 4. Baton table summary (`ops.prod_write_baton`, holders redacted to prefix)

| id | holder prefix | workstream | purpose (abridged) | acquired → released (UTC) | result |
|---|---|---|---|---|---|
| 1 | `ccd:desktop-1e…` | G-01 follow-up | exec_va_tasks revoke; quarantine 21 payment follow-ups; G-02 shadow | 09-16 19:36 → 19:48 | done: 4 migrations applied+verified, no sends |
| 3 | `ccd:desktop-1e…` | G-02 shadow internal notifications | `comms_g02_internal_destinations`; 1 internal destination; shadow run 2 | 09-16 20:05 → 20:11 | done (md5 match; 3,500 rows shadow) |
| 4 | `ccd:desktop-1e…` | Baton enforcement hook | `baton_reader` login + SCRAM verifier | 09-16 20:11 → 20:12 | done (`20260916201201`) |
| 5 | `claude:livetest` | hook live test | prove hook allows only holder; expiry/recovery | 09-16 20:12 → 20:13 | `stale_recovered` by `ccd:desktop-1e…` (test holder, by design) |
| 7 | `ccd:Fix webhook…` | C-20 webhook replay | merge PR #237 (deploys prod) | 09-16 20:22 → 20:26 | SUCCESS: merged `0859df87`, deployment READY, health ok |
| 8 | `claude:90ba4c55-…` | phase-2a-security | apply `profiles_protect_access_columns` | 09-21 23:41:30 → 23:42:30 | applied (ledger `20260921234148` = repo `20260917160000`), live attack test 42501 |
| 9 | `claude:101528f1-…` | security | apply `partner_acquisition_least_privilege` (commit `620e100e`) | 09-22 00:49:41 → 01:09:57 | applied+verified (ledger `20260922005007`) |

7 rows, max id 9, 0 unreleased, `recovered_by` populated only on id 5. Current status: **free**.

## 5. Status words

- `20260922004813`: **PROVENANCE UNKNOWN · performance-only · un-batoned · file-less**.
- Ledger vs master: **7 rows since 09-17 lack a master file; 6 lack any file**.
- Drift pin: `LEDGER-SNAPSHOT.txt` is 8 rows behind the ledger; `KNOWN_UNAPPLIED` unchanged.
- Baton discipline: 6 of the last 8 prod DDL applies were made with the baton free.

No recommendation is made here beyond recording; owner decisions and any repo landing belong to lane R1 / the owner.
