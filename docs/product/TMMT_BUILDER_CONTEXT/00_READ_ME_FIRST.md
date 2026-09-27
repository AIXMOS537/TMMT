# 00 — READ ME FIRST (TMMT Builder Context Pack)

Source: SPEC §0, §1, §4, §14, §18.2, §27, §33 · ROADMAP §0, §5 · Snapshot date 2026-09-21 (partner_acquisition fact updated 2026-09-22)

> **CURRENT vs TARGET (read this once, apply it to every file).** **CURRENT** = what is on `origin/master` `4cca6835` and, where stated, on the prod database today. **TARGET / IN-FLIGHT** = planned direction (PM-00…PM-19) or work on unmerged branches (GHL router M0–M13, Credit C1, Phase 2A, `sec/partner-acquisition-rls`). Nothing marked TARGET or IN-FLIGHT is shipped. Every pack file marks its sections; never build on a TARGET item as if it existed on master.

## What TMMT is (10 lines)

1. TMMT is one operating system for rental and rideshare fleet operators.
2. It is one Next.js app (`tmmt-ops`) on one Supabase database, with one tenant model.
3. It has three faces: **Customer Portal** (renter / credit client), **Operator Console** (staff desk), **Admin / Platform Console** (owner).
4. Today it is good at holding leads (892 `incoming_leads`) and has an owner-only, gated credit-repair engine.
5. It **cannot run a rental end to end**: 0 bookings, no e-sign, no processor-verified payment, no customer login, no customer messaging.
6. Supabase is the system of record. **GHL never sets business state.** GHL = conversations + attribution only.
7. No riba: no interest, late fees are charity-only (never revenue), deposits are ʿarbūn, LTO is two documents.
8. AIXMOS (the AI layer) acts only through authenticated, scoped TMMT services. It never uses the raw DB or a shell.
9. Money, send, sign and prod deploy are owner-gated. Every prod write needs the prod write baton.
10. The product plan is the `PM-00…PM-19` roadmap. PM-00 (security containment) comes first, then PM-01 (reproducible build).

## Canon

| Item | Value |
|---|---|
| Repo | `AIXMOS537/TMMT` |
| Canonical commit | `origin/master` @ **`4cca6835`** (PR #254, 2026-09-21) |
| Deploy | Vercel project `tmmt-ops` (`https://tmmt-ops.vercel.app`). **Every push to master deploys.** |
| Prod DB | Supabase `uapxakmlwnpfsftfeezx` (preview deploys also hit it; there is no staging DB) |
| Full spec | `docs/product/TMMT_MASTER_BUILD_SPEC.md` ("SPEC") |
| Roadmap | `docs/product/TMMT_ROADMAP.md` |
| Readiness | `docs/product/TMMT_FLAGSHIP_READINESS_REPORT.md` |
| Route registry | `docs/product/_evidence/E2_route_registry.csv` (175 rows) |
| Evidence | `docs/product/_evidence/E1…E6` |
| Tasks | `docs/product/FORGE_TASKS/INDEX.md` |
| Builder prompt | `docs/product/TMMT_BUILDER_MASTER_PROMPT.md` |

## How to use this pack

- Each file in this folder stands alone and names its SPEC section. When a file and the SPEC disagree, **the SPEC wins**. Report the gap in `docs/product/S2_SPEC_ISSUES.md`. Do not silently diverge.
- The pack describes the system **as it is at `4cca6835`**. Code is evidence. Re-check any `file:line` before you edit, because lines drift.
- Row counts are from 2026-09-21 and will drift. Other sessions write to prod daily.
- Status words are used exactly as SPEC §0.2 defines them: EXISTING/WORKING · EXISTING/PARTIAL · EXISTING/BROKEN · PLACEHOLDER · ORPHANED · LEGACY · PLANNED ONLY · MISSING · UNKNOWN.
- **Reconciled state (2026-09-22; SPEC X4/§20.3 and `S2_SPEC_ISSUES.md` SI-01 now agree):** the `partner_acquisition` P0 (SEC-01 / KD-01) is **REMEDIATED IN PRODUCTION + POST-APPLICATION VERIFIED** at 2026-09-22 00:50Z (ledger `20260922005007 partner_acquisition_least_privilege`, prod baton 9, approval `PARTNER-ACQ-RLS-P0-2026-09-21`, prepared commit `620e100e` on `sec/partner-acquisition-rls`, **not merged**). The unrestricted `authenticated ALL USING(true)` policy is the **historical root cause**, not the current state. Current: ordinary authenticated cannot read/update/delete; anon cannot read; narrow intake INSERT allowed; platform admin manages; the view does not bypass; `internal_team` intentionally denied; 0 rows. Exposure window: no evidence found, not proven absent. Follow-ups (separate from the P0): land the branch (TMMT-SEC-008), `KNOWN_UNAPPLIED` 54→53, `internal_team` access = product decision. **AUTH-SIGNUP-001 (public signup) is OPEN / OWNER ACTION REQUIRED, unverified.** Public-signup containment ≠ tenant authorization: assume a hostile authenticated account exists.
- **Where repo and prod diverge**, the pack uses SPEC §0.4's labels: CODE ON MASTER · CODE ON ACTIVE DEV BRANCH · PRODUCTION DATABASE STATE · PRODUCTION DEPLOYMENT STATE · DESIGN ONLY · PRESERVED-RESCUED HISTORICAL WORK. Security defects use SPEC §0.5's statuses (OPEN / REMEDIATED / MITIGATED / BLOCKED / OWNER ACTION / ACCEPTED LIMITATION / UNKNOWN); the per-defect table is `docs/product/_review/DEFECT_TRACEABILITY.md`.

## Reading order

1. `00_READ_ME_FIRST.md` (this file)
2. `14_CURRENT_STATE.md`: what works, what is broken, what blocks
3. `12_SECURITY.md` and `13_TESTING.md`: the rules you will be held to
4. Then only the domain file(s) your task touches: `01`–`11`
5. Then your task file in `docs/product/FORGE_TASKS/`

## Hard rules (non-negotiable)

1. **Never merge to master and never touch prod.** A merge is a deploy. Prod migrations, prod SQL writes, prod config and env changes, and switching on automations or sends all need **owner approval + the prod write baton** (`ops.acquire_prod_baton`). Read-only work needs no baton.
2. **No customer-facing send** unless it goes through the gated outbox with DNC / opt-out checks. Switching any send on is an owner decision.
3. **GHL never sets business state** (rental status, payment status, cases). GHL may raise an event; TMMT decides.
4. **Prod is the schema truth.** The repo cannot rebuild prod (279 prod migrations vs 89 repo files). Never invent a table or column. New schema goes only through a reviewed, rehearsed migration that is staged and not applied.
5. **Authorization changes need tests**, including a hostile authenticated user and a second org.
6. **No secrets or PII** in code, logs, fixtures, docs or output. Secret searches print path + type only.
7. **No riba, no guaranteed credit-score or financing claims**, and collections follow the mercy rules.
8. Never apply `supabase/migrations/_staged/20260904010000_generate_va_tasks_idempotent_STAGED.sql`. It strips the DNC filters.
9. Work one bounded task at a time. On ambiguity, **STOP and ask**.

## Active tracks — DO NOT TOUCH (coordinate only)

| Track | Where | What it owns | Your rule |
|---|---|---|---|
| **GHL router M0–M13** | worktrees `C:\dev\wt-ghl-*` (`feat/ghl-router-m0…m6`, `m0-m2`, `m3-m4`, `m5-m6`), audit `wt-ghl-audit` | connection registry, discovery, identity links, webhook inbox, router, universal intake contract + outbox design (M8), tenant-isolation matrix (M9), admin UI (M12), AIXMOS lead tools (M13) | Propose no schema or code that competes with it. When a task touches GHL webhook files, the GHL track reviews it. |
| **Credit S0–S7 / Credit C1** | `C:\dev\wt-credit-c1` (`feat/credit-c1-grounded-cases`, uncommitted) | all credit engine, credit schema, credit desk files (`src/lib/credit-dispute/**`, `(command)/command/credit-dispute/**`) | Do not edit credit files. Do not propose credit schema. |
| **Phase 2A security** | `C:\dev\wt-2a-profiles` (`sec/2a-profiles-regression`) | A1 (done), A3 profiles CI regression, A4a/A4b signup, A9–A12 (incl. `org_roles` recursion) | Do not duplicate. Coordinate before touching `profiles`, signup or `org_roles`. |
| **`partner_acquisition` RLS (historical P0)** | `C:\dev\wt-sec-partner-acq` (`sec/partner-acquisition-rls` @ `620e100e`) | SEC-01 / KD-01. **REMEDIATED on prod 2026-09-22** (ledger `20260922005007`); `internal_team` denied by design. The branch has not landed on master yet (TMMT-SEC-008 records the ledger version and brings `KNOWN_UNAPPLIED` back to 53) | Do not touch `partner_acquisition` policies; do not re-apply or "fix up" the migration. PR #255 (feeds the table) stays on hold until the branch lands and the owner releases it. |
| **Device cleanup / consolidation** | Desktop `CONSOLIDATION-2026-09-21` (separate baton) | archive ACLs, rescue bundles, machine hygiene | Not this pack's work. Never push or "tidy" rescue bundles. |
| **Production operations** | owner (prod baton holder) | prod migrations, env, crons, sends, deploys, backups | You prepare; the owner applies. |
| **M1 sync / off-repo jobs** | owner's M1 Mac (`com.tmmt.ghl-supabase-sync`) | the only live lead feed; the agent-spine worker | Never modify, replace or "bring into the repo" on your own; GHL M5/M6 retire the poller. |

Never touch another session's worktree. One worktree per branch. Prefer **integrating with an existing milestone's output** over rebuilding a subsystem; if a task would need you to rebuild something in this table, STOP.
