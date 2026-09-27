# E6 - Rescued work reconciliation, canon git history, active tracks map

Evidence worker E6, TMMT master product extraction, 2026-09-21.
Canon = `AIXMOS537/TMMT` `origin/master` @ `4cca6835` (2026-09-21 19:44 -0400, PR #254).
Sources: `OneDrive\Desktop\CONSOLIDATION-2026-09-21\UNIQUE_WORK_RESCUE_MANIFEST.md` + `ARCHIVE_MANIFEST.md`,
rescue copies under `C:\TechHaus-Archive\{TMMT,AIXMOS}\rescue-2026-09-21\`, `C:\dev\tmmt-os` refs
(`archive/{master,dev-copy-cdev,cyborg-kit,fork/pc-kit}` = TMMT-OS-ARCHIVE), `C:\dev\TMMT-LIVE` refs, `gh` (read-only).

Method: path- and blob-level comparison only. File blobs were hashed (`git hash-object`) and matched against
`git ls-tree -r` of canon and of the four TMMT-OS-ARCHIVE branches; commits compared with `git patch-id --stable`.
The T08 bundle was fetched into a throwaway bare repo in the scratchpad (deleted afterwards). No credential-,
secret-, token-, key-, `.env`- or CVILLE-named file was opened. Only source/migration/doc files were read.
Nothing was merged, restored, copied into this worktree, pushed or run.

Disclosure of incidental git writes (no content change): one `git fetch origin` in this worktree (updated
remote-tracking refs only) and one `git merge-tree --write-tree` probe in `C:\dev\TMMT-LIVE` (wrote unreferenced
tree objects; gc-able; no ref moved).

---

## TASK 1 - Rescue reconciliation

Dispositions: **CANON** = ALREADY IN CANON, **USEFUL** = USEFUL CANDIDATE, **SUPERSEDED**, **LEGACY**,
**FUTURE** = FUTURE MODULE, **HUMAN** = REQUIRES HUMAN REVIEW. Effort S/M/L is a port guess, not a commitment.

### 1.1 Key evidence per priority pocket

**T07 Fast Track overlay (PC Kit `_Archive\TMMT-LIVE`, 320 files, 2026-08-24).** Blob comparison vs canon:
123 identical, 167 same path but different content, 30 paths absent from canon.
- The 167 "different" files are older copies of canon files (GHL webhooks, crm-sync, credit-dispute, admin pages,
  layouts, `globals.css`, `Sidebar.tsx`, `command-hub-nav.ts`, `forms/actions.ts` ...). Canon moved on after 08-24
  (security PRs #190-#254), so these are **SUPERSEDED** - do not reapply the overlay as a whole.
- The 30 new paths are the real payload: `src/app/apply/{page,[slug]/page,packet/page}.tsx`,
  `src/components/fast-track/{apply-form,fast-track-bar,packet-form}.tsx`,
  `src/lib/fast-track/{field-map,fill-dom,openings,storage,types}.ts`,
  `supabase/migrations/20260825000000_fast_track_applications.sql`, plus `(admin)/{appointments,contracts,fleet,payments}/page.tsx`,
  `(admin)/page.tsx`, `(command)/dispatch/_components/UnitCard.tsx`, `src/lib/ghl/{notify,portal-notify,queries}.ts`,
  `src/lib/crm-sync/reject-sync.ts`, `src/lib/credit-dispute/{importers/smartcredit,journey-bridge}.ts`,
  `src/components/aixmos-ui/*` (4), `src/app/loading.tsx`, and a OneDrive conflict file `(admin)/page-BRAINIAC-7.tsx`.
- All 11 Fast Track files differ from `archive/dev-copy-cdev` (the TMMT OS original). Example: the overlay's
  `openings.ts` adds an `OPERATIONAL_FORMS` list pointing at canon's `/forms/*` slugs - i.e. this is a genuine
  **port adapted to tmmt-ops**, not a copy of TMMT OS. It is the better port source than `dev-copy-cdev`.
- Canon has **no** `/apply` route, no `fast-track` code and **no `public.applications` table** (grep of
  `supabase/migrations` and `src`). Canon intake today = `/forms/*` (17 slugs) + `/intake/[business]` (Phase 1).
- Migration risk: `20260825000000_fast_track_applications.sql` (29 lines) creates `public.applications`
  (name/email/phone/answers jsonb) with `for insert with check (true)` (anon public write) and
  `for select using (auth.role() = 'authenticated')` (any signed-in user reads all applicants' PII).
  Both violate standing rules (public write path needs durable rate limiting; authenticated != staff). Must be
  rewritten to org-scoped, staff/admin-read, REVOKE default grants, before any baton-gated apply.
- `src/components/aixmos-ui/*` was **deliberately removed** from canon by `9f6a0636` ("one component kit") -> SUPERSEDED.
- T15 (`_Archive\tmmt-os\...\apply-form.tsx`) differs from T07, `dev-copy-cdev`, `fork/pc-kit` and `master` -> fourth
  variant, compare-only.

**T08 4th TMMT OS history (`45484fc2`, Sync STALE snapshot).** Bundle = one root commit (2026-06-09, 524 files),
unrelated history to every TMMT-OS-ARCHIVE branch (no merge base). Of 524 blobs: 291 identical to some archive
branch blob, 225 same path/different content, 8 new paths (3 analysis docs `CONSOLIDATION_PLAN`,
`VALUATION_GROUNDED`, `VENTURES_INVENTORY`; 2 `.cursor/skills`; junk `_shell_test.txt`, `tsconfig.tsbuildinfo`; 1
sensitive-named path, not opened). **The invite flow, 0033 migration and LOTOS docs are NOT in the commit** - they
exist only in the uncommitted snapshot files:
- `src/lib/agency/invite-actions.ts` (265 lines; `inviteDealerAdmin`, `resendDealerInvite`, `deactivateDealerUser`;
  uses the service-role client to upsert `profiles` and write `activity_logs`), `src/components/agency/invite-dealer-admin-form.tsx`,
  `src/lib/app-url.ts`, modified `(internal)/internal/agency/page.tsx` - in no archive branch, not in canon.
  `src/lib/invites/` is referenced but was never captured (check the M1).
- `0033_dealer_instance_inventory.sql` (92 lines) creates `fleet`, `incoming_leads`, `maintenance_appointments` with
  `for all to authenticated` policies - designed for a **dedicated per-dealer Supabase project** (LOTOS P0 spec
  says explicitly: NOT TMMT prod). Would collide with existing canon/prod tables of the same names. Never apply to prod.
- `LOTOS_{GAP_AUDIT,GTM_PLAN,P0_BUILD_SPEC}.md`, `TEAM_ONBOARDING_SCRIPT.md`, `EXECUTION_REPORT.md` - not in canon.
  Canon already has a partial answer: `scripts/provision-dealer-instance.mjs` (dry-run dealer-instance factory) and
  `src/lib/signup-invite.ts` + `20260831000000_signup_invites.sql`.
- Bundle history carries a committed credentials-named file -> never push the bundle; lift source files only.

**T06 running tmmt-os `ollama.ts` patch.** +30/-1 on `src/lib/brain/ollama.ts`: prepends an owner-slang glossary
(`GLOSSARY_PATH` default `C:/AI-Brain/_ops/slang-glossary.json`) to the system prompt, no-op if missing. Canon has
no `src/lib/brain/ollama.ts` (only `src/lib/pocket-brain.ts`); the local-brain integration lives only on
`archive/master`. -> FUTURE (lands only with a brain port; replace the hard-coded Windows path with config).

**T05 tmmt-os `d22b50b` lint cleanup.** 17 files, +66/-43, on TMMT OS `main` (e.g. `src/lib/dealer/analytics.ts`,
`src/lib/ledger/queries.ts`, `src/lib/ops-command/parse-message.ts`). No canon relevance except as a cleaner port
source. -> LEGACY (keep in TMMT-OS-ARCHIVE).

**T01 `docs/system-of-record-2026-09-01` (2 commits on `f8120402`).**
- `deb881bb` "one component kit ... credit face dark mode": patch-id `fadbcedd...` **equals canon `9f6a0636`** -> ALREADY IN CANON.
- `be3299a0` "merge the two competing specs": no patch-id match, but canon has `074fc0cc` "the merged business
  requirements spec, audited against the live DB" (later, same doc) -> SUPERSEDED. Branch no longer merges cleanly
  (merge-tree conflict). Branch can be retired after owner OK.

**T09 FOR_OWNERS TMMT (May clone, stashes + branches).**
- Rescue-dispatch cockpit, `kit-checkout.ts`, `osm-cache.ts`, `osm-geocode.ts`, `kits/page.tsx`,
  `docs/CLAUDE-CODE-FASTTRACK.md` all exist in canon (`(command)/dispatch/**`, `src/lib/*`, `src/app/kits`) -> CANON.
- `origin/cursor/venture-command-center-routes` (`466e5ebd`, 89 files): only 10 paths exist in canon (2 identical);
  the rest are `/v/[venture]/*` rentals admin, office autopull/USB scripts, command-center architecture docs.
  `/v/[venture]/*` is also on TMMT-OS-ARCHIVE and is scheduled as ONE_PROJECT_PLAN Phase 4 -> SUPERSEDED (port from
  the archive/Phase 4, not this May branch). `23df162a`, `f7853f2f`, `e56d09c5` are build fixes/lockfile -> LEGACY.
- `portal-docs-clarify` `1bfc2f17` (partner plate/VIN): all 3 paths exist in canon with different content, incl. a
  canon `20260513120000_partner_fleet_plate_vin.sql` -> SUPERSEDED (variant migration; never apply).
- Bundle history holds the illegal CVILLE PDFs -> never push as-is.

**T10 AIX-CREDIT-DISPUTE (0 commits, 50 files).** REQUIRES HUMAN REVIEW regardless. Capability only: standalone
Next app for credit-report import (DisputeFox, MyFreeScoreNow, SmartCredit), deep audit, dispute protocol and letter
generation, plus a funding layer (application matcher, funding package, data-points catalog, applications store).
Canon already carries the engine core in `src/lib/credit-dispute/**` (deep-audit, protocol, gated-protocol,
importers disputefox/myfreescorenow, letters, CROA gate, policy) and `/command/credit-dispute/*`. Not in canon:
SmartCredit importer (also in T07), application matcher / funding package / data-points catalog, and migrations
`20260707120000_dispute_engine`, `..130000_primary_sources`, `..140000_applications_funding`. Canon's
`CREDIT_ENGINE_AUDIT.md` S1 says to "reconcile `20260707120000`" - so these are inputs to the credit track, owned
by that track, not by extraction.

**Missing TMMT OS internal pages** (union of the 4 archive branches = 99 page routes). Every page below exists
**only on `archive/master`** (not `dev-copy-cdev`, `cyborg-kit`, `fork/pc-kit`) and not in canon:
`internal/property`, `internal/property/setup`, `internal/briefing`, `internal/marketplace`,
`internal/partner-verticals`, `internal/dispatch/new`, `client/marketplace`, `team/performance`.
Canon already has its own dispatch (`(command)/dispatch/incident/new`), so `internal/dispatch/new` (GHL dispatch
flavour) overlaps.

**Customer portal + dealer desk (owner: URGENT 2026-09-09).** Canon `docs/ONE_PROJECT_PLAN.md`: Phase 1 front
door DONE (`a41e979b`, PR #226), Phase 2 intake, Phase 3 integration layer (41 diverged files; canon wins; delete
TMMT OS webhook routes), Phase 4 portals. Present in all 4 archive branches, absent in canon:
`(client)/client/*` (15 pages: dashboard, rental, vehicle, billing, credit, documents, maintenance, marketplace,
path, support, support/[id], training, updates, upgrade, [section]), `(internal)/internal/dealer/*` (10 pages:
dealer home, collections, deals, deals/[id], deals/new, inventory, leads, onboarding, payments, service),
`(team)/team/*`, `(vendor)/vendor/*` (canon has a single `(vendor)/vendor`), `(investor)/investor/*` (canon has a
single `/investor`), `(owner)/admin/*`, `/portals`, `/v/[venture]/*`. Blockers: Next 14->16 / React 18->19 /
Tailwind 3->4 pass, no shared `ui/` kit, URL-shape decision vs canon `(admin)` screens, and the open P0 profiles
self-escalation fix (PR #249 merged 09-21; `wt-2a-profiles` shows prod apply recorded) - the portal needs that closed.

### 1.2 Reconciliation table

| Pocket | Capability | Canon status (evidence) | Disposition | Where it would land | Effort | Risk notes |
|---|---|---|---|---|---|---|
| T00 TMMT-LIVE local-only branches (full bundle) | safety net for all local-only branches | refs still live in TMMT-LIVE | LEGACY (safety copy) | stays in archive | - | contains every in-flight branch; never push the bundle |
| T01a `deb881bb` one component kit | UI kit consolidation + credit dark mode | patch-id = canon `9f6a0636` | CANON | - | - | none |
| T01b `be3299a0` spec merge | merged BRS doc | canon `074fc0cc` is the later audited version | SUPERSEDED | - | - | branch conflicts with master; retire after owner OK |
| T02 `docs/tmmt-ghl-master-audit` | GHL master audit + router pack | not on master; carried forward in `feat/ghl-router-m*` branches | HUMAN (other session owns) | that session's PR | - | DO NOT DISTURB |
| T03 `feat/ghl-router-m0..m6`, `sec/2a-profiles-regression` | GHL router M0-M6, profiles fix | in flight (see Task 3) | HUMAN (other session owns) | owning session's PRs | - | migrations need prod baton; snapshot already stale |
| T04 `import/tmmt-os` | TMMT OS main history | on TMMT-OS-ARCHIVE | LEGACY (port source) | TMMT-OS-ARCHIVE | - | - |
| T05 tmmt-os `d22b50b` | ESLint cleanup, 17 files | retired app only | LEGACY | TMMT-OS-ARCHIVE `archive/lint-cleanup-d22b50b` | S | push before `C:\dev\tmmt-os` is archived |
| T06 running `ollama.ts` patch | owner-slang glossary injected into local-brain prompts | canon has no `src/lib/brain/ollama.ts` | FUTURE | `src/lib/brain/*` if local-brain port happens; else pocket-brain | S | hard-coded Windows path; process on :3000 still live |
| **T07 Fast Track core** (11 files: `/apply`, `/apply/[slug]`, `/apply/packet`, `components/fast-track/*`, `lib/fast-track/*`) | job + program application flow with prefilled packet, openings list tied to canon `/forms/*` | absent (no `/apply`, no fast-track code) | **USEFUL** | `src/app/apply/**`, `src/components/fast-track/**`, `src/lib/fast-track/**` on branch `port/fast-track-from-pc-kit-2026-08-24` | M | needs Next16/React19 check vs canon at 4cca6835; decide vs `/forms/apply` + `/forms/operator-apply` overlap |
| **T07 migration `20260825000000_fast_track_applications.sql`** | `public.applications` table | absent (no `applications` table in canon) | **USEFUL** (after rewrite) | `supabase/migrations/` new timestamp | S | as written: anon insert `with check (true)` + any-authenticated read of applicant PII; must add org_id, staff-only read, REVOKE grants, durable rate limit; prod baton |
| T07 new admin pages `(admin)/{appointments,contracts,fleet,payments}`, `(admin)/page.tsx` | admin screens | canon has `interfaces/{appointments,contracts,payments,vehicles}` | HUMAN (URL-shape decision) | Phase 4 | S | duplicates canon screens at other URLs |
| T07 `ghl/{notify,portal-notify,queries}.ts`, `crm-sync/reject-sync.ts` | GHL portal notifications | absent; touch integration layer | HUMAN | Phase 3 | M | integration layer; could send; review against canon webhook hardening |
| T07 `credit-dispute/{importers/smartcredit,journey-bridge}.ts` | SmartCredit importer, journey bridge | absent | HUMAN (credit) | credit track | S | credit/PII; D-22b/#224 HOLD |
| T07 `components/aixmos-ui/*` | old UI kit | deliberately removed by `9f6a0636` | SUPERSEDED | - | - | - |
| T07 167 older copies of canon files | pre-08-24 versions | canon newer | SUPERSEDED | - | - | reapplying would roll back security fixes |
| T07 `(admin)/page-BRAINIAC-7.tsx` | OneDrive conflict copy | - | LEGACY (discard) | - | - | - |
| T08 dealer-admin invite flow (`agency/invite-actions.ts`, `invite-dealer-admin-form.tsx`, `app-url.ts`, agency page edit) | invite/resend/deactivate dealer admins | absent; canon has `signup-invite.ts` + `signup_invites` table | **USEFUL** | `src/lib/agency/*` or merged into `signup-invite.ts`; dealer desk (Phase 4) | M | service-role writer to `profiles` - must respect PR #249 protected columns; `src/lib/invites/` missing (check M1) |
| T08 `0033_dealer_instance_inventory.sql` | fleet / incoming_leads / maintenance tables for a dedicated dealer DB | canon/prod already own those table names | FUTURE (LOTOS dedicated instance only) | dealer-instance template, never TMMT prod | S | `for all to authenticated`; would collide on prod |
| T08 LOTOS docs (`GAP_AUDIT`, `GTM_PLAN`, `P0_BUILD_SPEC`), `TEAM_ONBOARDING_SCRIPT`, `EXECUTION_REPORT` | dealer-SaaS (LotOS) plan | absent; canon has `scripts/provision-dealer-instance.mjs` + `docs/sales/DEALER-*` | **USEFUL** (docs input) | `docs/product/` extraction inputs / `docs/recovered/` | S | 3 months old; bundle history has credentials-named file - lift docs only |
| T08 committed tree `45484fc2` | consolidated TMMT OS baseline | 291/524 blobs in archive; unrelated history | LEGACY | TMMT-OS-ARCHIVE after scrub | - | never push unscrubbed |
| T09 rescue-dispatch stashes, kit-checkout, osm, kits page | dispatch cockpit, kit checkout, geocode | present in canon | CANON | - | - | CVILLE PDFs in bundle history |
| T09 `venture-command-center-routes` | `/v/[venture]/*` admin + office scripts | 10/89 paths in canon; routes also on archive | SUPERSEDED | Phase 4 from archive instead | - | - |
| T09 `portal-docs-clarify` plate/VIN | partner plate/VIN RPC + UI | canon has all 3 paths (different content) | SUPERSEDED | - | - | variant migration; never apply |
| T10 AIX-CREDIT-DISPUTE | credit import/audit/dispute letters + funding matcher | engine core in canon; funding matcher + 3 migrations absent | HUMAN | credit track (S1 reconcile `20260707120000`) | L | FCRA/CROA; #224 + D-22b HOLD; not extraction's call |
| T11 TMMT MANAGEMENT ops hub | operator runbooks, iMessage command watcher, `SUPABASE_OPERATOR_ROLES.sql` | absent | LEGACY (reference) | `docs/recovered/` if anything | S | watcher scripts can act; SQL reference only |
| T12 `C:\dev\TMMT` stale refs (Umar scrub, env notes) | CLAUDE.md scrub, env notes | unknown on GitHub now | HUMAN (policy) | archive branches | S | sovereignty scrub is a policy decision |
| T13 May backup business-ops + docs | operator-team (26), hiring-onboarding (36), mentorship docs, 6 migration variants | canon has 3 files in `docs/operator-team`, 0 hiring/mentorship; migrations differ from canon | LEGACY (docs) / SUPERSEDED (migrations) | `docs/recovered/may-backup/` | S | PII folders left at source; CVILLE in bundle |
| T14 CYBORG flash-kit edits | flash-drive product line docs | canon has same paths (older/newer edit) | SUPERSEDED (merge by hand if wanted) | `docs/flash-drive-kits/` | S | - |
| T15 PC Kit apply-form variant | 4th apply-form variant | differs from all | LEGACY (compare only) | - | - | - |
| T16 Codex pitch runtime | Docker kit, vehicle lifecycle API | `vehicle-lifecycle` absent | LEGACY | - | - | experiment; 7 env files at source |
| TMMT OS `internal/{property,property/setup,briefing,marketplace,partner-verticals}`, `client/marketplace`, `team/performance` | property mgmt, owner briefing, marketplace, partner verticals, team KPIs | absent; only on `archive/master` | FUTURE | Phase 4+ (after portal URL decision) | M-L | Next14->16 pass; marketplace/partner-verticals imply new commercial surfaces (commercial-authority gate) |
| TMMT OS `internal/dispatch/new` | GHL dispatch create | canon has `(command)/dispatch/incident/new` | SUPERSEDED (reconcile) | - | - | two dispatch models |
| **Customer portal** `(client)/client/*` (15) | customer self-service: rental, vehicle, billing, docs, support, updates | absent | **USEFUL** (owner URGENT) | Phase 4, one URL shape | L | needs P0 profiles fix in prod, RLS per customer, Next/Tailwind upgrade |
| **Dealer desk** `(internal)/internal/dealer/*` (10) | dealer inventory, leads, deals, payments, collections, service | absent (canon has `/dealers` marketing + provisioning script) | **USEFUL** (owner URGENT) | Phase 4 / LOTOS | L | collections = mercy/no-riba rules; payments owner-gated |
| A01 tmmt-control-plane | BRAINIAC/M1 ops runbooks, agent_jobs worker | separate repo | LEGACY (ops, not product) | `m1` bare repo | - | not TMMT app scope |
| A02 AIXMOS-AGENTS sender scripts | SMS/iMessage send, overdue reminders, reminder retry/backfill, GHL webhook debug | not in canon; canon routes sends through staged outbox (`/command/outbox`, PR #230) | HUMAN (never run) | none; outbox pattern replaces them | - | these SEND; bypass DNC/opt-out/owner-hold (C-21) |
| A03 TMMT-AI-RUNTIME | fleet launcher CLI for AIXMOS agents | separate repo | LEGACY | own private repo (owner gate) | - | - |
| A04 AI-OPS-STARTER | local-first AI ops kit (Ollama/Docker/NAS/flash) | separate | LEGACY / FUTURE (AIXMOS product kit) | own private repo | - | - |
| A05 TMMT-REPO Fleet Autopilot | rental autopilot (leads, drafts, collections, USB vault) | superseded by tmmt-ops + outbox | SUPERSEDED | - | - | vault script names; do not publish |
| A06 AIX_AI_COMMAND_SYSTEM | OperatorAPI :8008 | separate, live | LEGACY | AIX-Command-Center | - | live process |
| A07-A10 small AIXMOS items | llm.js host fix, presets, flash-drive plan | separate repos | LEGACY | matching repos | S | - |

### 1.3 Counts per disposition (table rows above, 41 rows; mixed rows counted by primary disposition)

| Disposition | Count |
|---|---|
| ALREADY IN CANON | 2 (T01a, T09 dispatch/kits) |
| USEFUL CANDIDATE | 6 (T07 Fast Track core, T07 migration (rewrite), T08 invite flow, T08 LOTOS docs, customer portal, dealer desk) |
| SUPERSEDED | 8 |
| LEGACY | 14 |
| FUTURE MODULE | 3 (T06, T08 0033, TMMT OS property/briefing/marketplace/partner/perf pages) |
| REQUIRES HUMAN REVIEW | 8 (T02, T03, T07 admin pages, T07 GHL notify, T07 credit files, T10, T12, A02) |

Top 5 USEFUL CANDIDATES (priority order):
1. Customer portal `(client)/client/*` from TMMT-OS-ARCHIVE (owner URGENT; Phase 4) - L.
2. Dealer desk `(internal)/internal/dealer/*` from TMMT-OS-ARCHIVE (owner URGENT; Phase 4/LOTOS) - L.
3. Fast Track port (T07 core 11 files - canon-adapted, better than `dev-copy-cdev`) - M.
4. Fast Track `applications` migration, rewritten secure (org-scoped, staff-only read) - S, baton-gated.
5. Dealer-admin invite flow (T08) folded into canon `signup-invite.ts`, plus LOTOS docs as product inputs - M.

---

## TASK 2 - Canon git history (`origin/master`)

**Velocity (all commits incl. merges, by month):** 2026-06: 353 · 07: 59 · 08: 99 · 09: 333 (to 09-21).
First-parent: 06: 210 · 07: 38 · 08: 49 · 09: 122. The last 200 non-merge commits all fall 2026-09-07 .. 09-21.

**Last 200 non-merge commits by touched area (commits touching):** docs 82 · supabase 45 · src/lib (root files) 36 ·
scripts 29 · src/app/api 25 · src/lib/agent 21 · src/components 11 · src/app/(command) 11 · src/app/(admin) 11 ·
e2e 8 · src/lib/drive-to-own 7 · src/lib/ghl 5 · src/app/(pocket) 5 · .env.example 5 · src/lib/db 4 ·
src/lib/credit-dispute 4 · src/app/status 4 · src/app/forms 4.
Conventional scopes seen most: drive-to-own, sms, e2e, webhooks, credit, migrations, agent, rental, watchtower,
routing, intake, deps, trust, pocket, lp, front-door, configurator, sec/profiles, security/croa.
Reading: September was a hardening + audit month (docs/migrations/security dominate), with product work in
drive-to-own, rental board, front door, command hub.

**Recently completed milestones (merged PRs):**
- 09-07/08 app recovery audit + remediation wave: #190-#218 (S3 migrations record, bg-check 7-arg, SMS compliance,
  rate limits, fetch timeouts, rollback runbook, webhook hardening, F-13..F-18 fixes, T-01/T-02/T-03 tests/authz).
- 09-09: #219/#220 replay guards + dispatch cross-check, #223 front door to sign-in, #226 front door (ONE_PROJECT Phase 1),
  #225/#227/#228 migration ledger/idempotency/staged triage, #229 SMS inbound, #230 VA task SMS outbox (stage-only).
- 09-15/16: #234 Next 16.3.3 critical RCE fix, #231 watchtower, #236 VA stager, #237 C-20 webhook replay.
- 09-17..21: #250 rental board + drive-to-own + lead form fix, #241 quarantine payment follow-ups, #242 G-02 shadow
  eligibility, #244/#245/#246 C-21 containment A/B/C (opt-out first, AI replies held, newest message redacted),
  #247 schema-drift register, #248 agent-queue migration backfill, #249 profiles protected columns, #252 deps
  (Next 16.3.5), #253 AIXMOS public front door `/lp/aixmos` (owner review copy+price), #254 tenant-resolved command hub.

**Notable reverts:** none. No `Revert "..."` commit since 2026-05. Closest are policy walk-backs:
`e631e68a` (C-20 kept minimal; fail-open left as open decision), `813e0e02` (staged migrations triaged, opt-out
applied at enqueue "reconciled not as written").

**Open PRs (4):**
- #255 (ready, 09-22) `feat/partner-acquisition` - partner acquisition pipeline to source cars (supply side).
- #251 (ready, 09-19) `feat/inspection-walkaround` - inspection walk-around photos for damage disputes.
- #243 (DRAFT, 09-16) `comms/g02-internal-destinations` - G-02 shadow: separate internal notifications from customer comms.
- #232 (ready, 09-17) `carry/tmmt-front-door-on-master` - tmmtrentals.com shows TMMT, not another company's site.

---

## TASK 3 - Active tracks map (`git -C C:\dev\TMMT-LIVE worktree list`)

Ahead/behind vs `origin/master` @ 4cca6835. Branches at +0 are merged (squash) or superseded - stale worktrees.

| Worktree | Branch | +ahead/-behind | Last commit | Track |
|---|---|---|---|---|
| `C:\dev\wt-ghl-m0` | feat/ghl-router-m0 | +7/-4 | 09-21 18:46 docs(m0) test/env safety report | GHL M0 |
| `C:\dev\wt-ghl-m1` | feat/ghl-router-m1-app | +14/-4 | 09-21 18:56 test(intake) anon vs service-role org contract | GHL M1 |
| `C:\dev\wt-ghl-m2` | feat/ghl-router-m2 | +4/-4 | 09-21 18:49 db(m2) codify lead-intake schema + local dev DB | GHL M2 |
| `C:\dev\wt-ghl-m0m2` | feat/ghl-router-m0-m2 | +30/-4 | 09-21 19:16 M0-M2 final integration report | GHL M0-M2 integration |
| `C:\dev\wt-ghl-m3db` | feat/ghl-router-m3-db | +32/-4 | 09-21 19:47 db(m3) connection registry (dev only) | GHL M3 |
| `C:\dev\wt-ghl-m4app` | feat/ghl-router-m4-app | +34/-4 | 09-21 19:56 feat(m4) ghl:discover:config dev CLI | GHL M4 |
| `C:\dev\wt-ghl-m3m4` | feat/ghl-router-m3-m4 | +42/-4 | 09-21 20:07 M3/M4 final integration report | GHL M3-M4 integration |
| `C:\dev\wt-ghl-m5` | feat/ghl-router-m5 | +43/-4 | 09-21 20:15 identity + webhook contracts | GHL M5 |
| `C:\dev\wt-ghl-m6` | feat/ghl-router-m6 | +43/-4 | 09-21 20:15 identity + webhook contracts | GHL M6 |
| `C:\dev\wt-ghl-m5m6` | feat/ghl-router-m5-m6 | +44/-4 | 09-21 20:16 docs(m6) outbox prep (design only) | GHL M5-M6 integration (tip) |
| `C:\dev\wt-ghl-audit` | docs/tmmt-ghl-master-audit | +2/-67 | 09-21 18:18 GHL router pack | GHL audit (base of M-series) |
| `C:\dev\wt-credit-c1` | feat/credit-c1-grounded-cases | +1/-4 (no upstream) | 09-21 20:13 C1 grounded case-based dispute engine (dev only) | Credit C1 |
| `C:\dev\wt-2a-profiles` | sec/2a-profiles-regression | +2/-4 | 09-21 19:43 record prod apply of profiles_protect_access_columns | Phase 2A security (P0 profiles; PR #249 merged) |
| `C:\dev\wt-master-extraction` | docs/tmmt-master-extraction-2026-09-21 | +0/-0 | = master | this extraction |
| `C:\dev\wt-profiles-lock` | sec/profiles-protected-columns | +0/-137 | 09-17 | security (merged #249) |
| `C:\dev\wt-g02-internal` | comms/g02-internal-destinations | +0/-141 | 09-16 | comms G-02 (open draft #243) |
| `C:\dev\wt-g02` | comms/g02-shadow-phase1 | +0/-142 | 09-16 | comms G-02 (merged #242) |
| `C:\dev\wt-c21a/b/c` | fix/c21a/b/c-* | +0/-140..142 | 09-16 | C-21 containment (merged #244-#246) |
| `C:\dev\wt-c21-llm-cap`, `wt-c20-webhook-replay`, `wt-drift-register`, `wt-queue-migrations`, `wt-quarantine`, `wt-grants`, `wt-g01-stager`, `wt-baton`, `wt-owner-decision` | various | +0/-138..145 | 09-16 | remediation wave (merged or superseded) |
| `C:\dev\TMMT-LIVE` | docs/owner-action-sheet | +0/-298 | 09-08 | stale docs |
| `C:\dev\TMMT-docs-wt` | docs/owner-model | +0/-307 | 09-01 | stale docs |

**GHL router milestone numbering** (`docs/audits/ghl-router/TMMT_GHL_ROUTER_IMPLEMENTATION_PLAN.md` on the M-branches):
M0 honest baseline · M1 close tenant holes · M2 codify what prod runs · M3 connection registry (read-only) ·
M4 discovery sync (read-only) · M5 identity links · M6 webhook inbox · M7 router core + simulator (dry-run) ·
M8 universal intake + outbox (not live) · M9 tenant isolation matrix in CI (release blocker) · M10 first live intake
(`web-lead-intake` -> Rentals) · M11 migrate the rest · M12 admin UI · M13 AIXMOS on top.
Current position: M0-M6 built on branches (none on master, none applied to prod); M3+ is "dev only / NOT applied";
M5/M6 are docs/design. M10 needs the owner go-live yes. The M-series is now **M0-M13**, not M0-M4.

**Credit track numbering:** canon `docs/credit/CREDIT_ENGINE_AUDIT.md` uses **S0-S7** (S0 owner inputs [HOLD],
S1 schema design not applied - reconcile `20260707120000`, S2 parser v2, S3 analysis v2, S4 customer upload,
S5 customer review, S6 case packet + booking, S7 e2e proof -> STOP for owner). The in-flight branch labels its work
**C1** ("grounded, case-based, reviewable dispute engine", 25 files, +3408/-476, staged NOT-applied migration
`20260922120000_credit_case_foundation_STAGED.sql`, CROA gate stays closed, nothing sent). "C1" also collides with
other IDs in canon (BRS compliance row C1 = Intelius is not a CRA; REMEDIATION_PLAN C-01..C-24). Extraction roadmap
should cite credit work as "Credit C1 (engine repair) under S0-S7" and use a distinct prefix for its own items.

**Implications for the extraction:** do not propose schema for intake/GHL routing, connection registry, identity
links or webhook inbox (GHL M0-M9 own it); do not propose credit schema (C1/S1 own it); Fast Track `applications`
must be reconciled with the M8 universal-intake design before it lands; customer portal / dealer desk remain
unowned by any active worktree - they are the open lane (ONE_PROJECT_PLAN Phase 4).

---

## REPO MERGE CONTROLS (added on coordinator request; GET-only evidence, 2026-09-21)

Calls used: `gh api repos/AIXMOS537/TMMT`, `.../branches/master/protection`, `.../rulesets`, `.../rules/branches/master`,
`.../branches/master`, `.../actions/permissions/workflow`, `gh workflow list`, `gh run list`/`gh run view --log`
(session-autopilot, mission-daily), `gh pr list --state merged|all`, one unauthenticated `curl` GET of the mission route. Nothing changed.

**Repo settings.** `allow_auto_merge=false`, `allow_merge_commit=true`, `allow_squash_merge=true`, `allow_rebase_merge=true`,
`delete_branch_on_merge=false`, `private=true`. Actions workflow permissions: `default_workflow_permissions=read`,
`can_approve_pull_request_reviews=false` (= "Allow GitHub Actions to create and approve pull requests" is OFF).

**master protection.** `branches/master` -> `"protected": false`. Protection, rulesets and branch rules all return
HTTP 403 "Upgrade to GitHub Pro or make this repository public" - private repo on the free plan, so **no required
reviews, no required status checks, no rulesets are possible or present**. Any identity with write access can push
or merge to master (= prod deploy) directly. The prod-write baton is enforced only client-side (local PreToolUse hook),
not by GitHub.

**session-autopilot.yml** (active; cron every 6 h; `permissions: contents: write, pull-requests: write`).
Intends to: open PRs for every `claude/*` branch ahead of master, run `gh pr merge <n> --auto --merge`, and
`git push origin --delete` any `claude/*` branch at master with no open PR.
- Last 20 runs (09-17 .. 09-21 21:34Z): all `schedule`, all `success`.
- Latest run log: 11 `claude/*` branches ahead of master; every one logged `Creating PR (n commit(s) ahead)` then
  `PR already open or conflict, skipping` (PR creation fails - Actions may not create PRs); summary
  `PRs created=0 auto-merge-enabled=0 branches-deleted=0`. No `Auto-merge ON` line.
- Last 50 merged PRs: all `mergedBy=AIXMOS537`, `autoMergeRequest=null` for all 50; none from a `claude/*` head.
  All-time `claude/*` PRs (#127-#155 range) were authored and merged by `AIXMOS537`, none by `github-actions[bot]`,
  none with auto-merge. 11 `claude/*` branches remain on the remote (several already squash-merged, e.g. #154, #145).
- So the workflow has **never** enabled auto-merge and no `claude/*` PR merged via it. Every merge was an explicit
  merge by the `AIXMOS537` identity (which agents also use - GitHub cannot tell owner from agent here).

**Verdict: LATENT RISK.** Not active today because two independent switches are off (repo `allow_auto_merge=false`;
Actions cannot create PRs). It becomes ACTIVE if someone follows the workflow's own "ONE-TIME OWNER SETUP" comment
(enable auto-merge + Actions PR permission): with master unprotectable on this plan there are no required checks, so
`gh pr merge --auto --merge` would likely merge immediately (gh merges directly when a PR is already mergeable -
behaviour not tested here), i.e. an unattended merge to master = prod deploy with no baton. Secondary latent effect:
the delete branch path is live code (`contents: write` is granted explicitly) and would delete `claude/*` branches at
master with no open PR; it deleted 0 in the latest run. Recommendation for the extraction roadmap (owner decision,
not done): disable or delete `session-autopilot.yml` (or strip the `--auto` merge and delete steps); keep
`allow_auto_merge=false`; treat "no server-side master protection" as a known platform gap (GitHub Pro or public
repo needed for required checks).

**mission-daily.yml** (active; cron `0 13 * * *`; scheduled default `audience=team`, `notify=true`) - intent: POST
`https://tmmt-ops.vercel.app/api/mission/generate` with `x-cron-secret` so the owner **and every profile with a
Telegram chat id** get a daily Mission Control message. No owner gate in the workflow; the route
(`src/app/api/mission/generate/route.ts`) sends when `notify=true` and `audience=team` (`sendMissionToTeam`).
- Runs: daily `schedule` success 09-09 .. 09-21 (13 runs), plus two manual runs 09-08 (1 failure, 1 success).
- Every run's response body is `Redirecting...`; an unauthenticated GET of the same URL returns `307 -> /login`.
  The app middleware redirects this API path to sign-in before the route runs, and `curl --fail-with-body` does not
  fail on 3xx, so the job shows green while **nothing is generated or sent**.
- **Verdict: LATENT RISK (send).** No sends are happening now, but a middleware change that lets `/api/mission/*`
  through (or a change of `MISSION_API_BASE`) would re-arm an ungated daily broadcast to the whole team - a
  "switching on live communication" action under the owner/baton rules. The green run history also hides that it
  is dead (same pattern as "Vercel SSO fakes green smoke tests"). Recommendation (owner decision): set the schedule
  default to `audience=owner, notify=false` or disable the schedule until the owner re-approves, and make the step
  fail on non-2xx/non-JSON responses.
