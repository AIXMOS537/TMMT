# TMMT FLAGSHIP READINESS REPORT

- **Date:** 2026-09-21 (reconciled 2026-09-22 against the owner's final review delta) · **Canon:** `AIXMOS537/TMMT` `origin/master` @ `4cca6835` (live as Vercel `tmmt-ops`)
- **Companions:** `TMMT_MASTER_BUILD_SPEC.md` (detail, `§n` refs below) and `TMMT_ROADMAP.md` (PM- milestones); per-defect statuses in `_review/DEFECT_TRACEABILITY.md`
- **Evidence:** `docs/product/_evidence/E1…E6` (read-only extraction, 2026-09-21); prod facts verified 2026-09-22 for `partner_acquisition` and `profiles`
- **No single readiness score is given.** Readiness is answered question by question (§0) with evidence; a percentage would hide which door is open.

---

## Plain words first

**What TMMT is today:** a big, real app with 127 pages and 30 API routes. It builds cleanly and its tests mostly pass. It is good at **holding leads** (about 890 of them) and it has a strong, carefully locked **credit-repair engine** that only the owner can use.

**What it cannot do yet:** it cannot **run a rental from start to finish**.
- There are no bookings.
- There is no way to sign an agreement.
- There is no proof that anyone paid.
- There is no way for a customer to log in and see their own rental.
- It has **never delivered a message to a customer**. 35 emails sit in a queue; nothing drains it.

**What is dangerous right now:**
1. Anyone may be able to **sign themselves up** without an invite. The owner needs to flip one switch (AUTH-SIGNUP-001 — OPEN, owner action, unverified). The partner-contact table that was open to any signed-in user is **fixed in production** (2026-09-22); its branch still has to land in the repo.
2. Code **can** let GoHighLevel decide rental and payment status. A GHL tag could even create a "Paid" record with no real money behind it. This has not fired, only because GHL webhooks have never been connected.
3. Nothing on GitHub stops an unattended **merge to master, which means a live deploy**. This is a latent risk, not an incident: auto-merge is off and every recent merge was human. A daily team broadcast is also sleeping, and it wakes up if the wrong door is opened.
4. One tenant's staff can see **every tenant's data**.
5. A database trigger turns a typed word ("Contracting") into an "Active" rental with no car, contract or payment behind it.

**What to do first:** lock the doors (**PM-00**). Then make "green" mean something and make the database rebuildable from the repo (**PM-01**). Only after that, build the rental journey on the pieces that already exist: the booking table, the double-booking guard and the pricing rules. The customer portal and dealer desk the owner wants urgently already exist in the archive and can be carried over. That work comes after the customer login path is built.

---

## 0. The ten readiness questions (answered explicitly)

| # | Question | Answer (evidence in the sections below) |
|---|---|---|
| 1 | **What works today?** | Staff sign-in and the 29-screen desk; lead capture on 2 of 27 surfaces; the background-check queue and decision trail; quote/price-floor/hold logic with a live overlap guard (never exercised, 0 bookings); the owner-only credit desk with the CROA gate closed; webhook signature checks; the dispatch cockpit; internal Slack/Telegram notifications; 10 pg_cron jobs; RLS failing closed; the two prod security fixes (profiles 09-21, `partner_acquisition` 09-22) [§1, §2] |
| 2 | **What partially works?** | Lead CRM (store only, no status history); bookings (hold only); payments (manual kanban; Stripe receiver writes no money; GHL path is a capability that never fired); maintenance/fleet screens over legacy data; credit engine (owner-only, no customer face); AIXMOS SMS agent (correct code, never ran live); analytics on unverified money; GHL (one env token, one location, empty stage map) [§2, §3] |
| 3 | **What is broken?** | No customer path (R3); 8 machine APIs redirected so both Vercel crons' handlers never run; operator sign-in loop; 7 screens on 14 ghost tables; column drift; date-only Overdue (25/31); empty stage map; credit `[id]` ungated; voice agent 500; Twilio unconfigured on 9/9 orgs; nav leaks; mission-daily dead-green; 2 Windows-only test failures [§3] |
| 4 | **What is design-only?** | The rental state machine, transition function, event log and hold expiry; processor-verified payments and the money model; agreements/e-sign; customer tier, invite flow and portal; the comms gateway, drainer and consent-at-send; extensions, returns, tolls, damage, reconditioning; AIXMOS scoped tools; GHL M5–M13; Credit S1–S7 [§4, spec §0.4] |
| 5 | **What is actively being repaired elsewhere?** | GHL router M0–M13 (branches; M1 migration not applied); Credit C1 (`wt-credit-c1`, uncommitted); Phase 2A A3/A4a/A4b/A12; `sec/partner-acquisition-rls` landing (fix already on prod); PR #251 photos; PR #243 G-02 audience split. None of it is on master; PM- tasks integrate with it and never rebuild it [§7, spec §14, §18.2] |
| 6 | **What prevents a complete rental?** | No state machine or event log (only `hold` is ever written); no agreement generation or signature; no processor-verified deposit; handover is an anonymous public form with no preconditions; no return/inspection/deposit-settlement path; two vehicle tables and 0 active vehicles; an enabled trigger that fabricates "Active" rentals from lead text [§4, §10.2, spec §7.0] |
| 7 | **What prevents safe customer activation?** | Public signup unverified (AUTH-SIGNUP-001); no `customer` tier or home (tier `none` → `/no-access`); customer pages login-walled; per-person RLS keyed to email text only; cross-org signed URLs; no consent-at-send gate and no drainer, so no safe way to message a customer; GHL DND never read; open redirect on the auth callback [§5, §10.1] |
| 8 | **What prevents broader tenant rollout?** | `is_staff()` is global across 189 policies; ANON-TENANT-001 (six anon tables with caller-chosen org); PARTNER-TENANT-001; deployed edge functions with caller-chosen tenant; JWT/`profiles.role` split brain; `org_roles` recursion; no tenant-isolation tests in CI; GHL is one env token / one location (per-org connections only on GHL branches); no non-production database [§5 #9–#11, §10.1 #8–#9, §10.4] |
| 9 | **What prevents production-scale automation?** | Middleware blocks every machine API (and fixing it re-arms mission-daily and doubles the journey recompute until paired changes land); `/api/license/*` has no credential; the only live lead feed is an off-repo laptop job with a silent 5,000 cap; the outbox has no consumer; GHL events are consumed before processing; GHL can set business state by default; the repo cannot rebuild prod (279 vs 89 migrations; 6/7 edge functions unversioned); no health screen; PII in logs [§10.4, spec §17, §26] |
| 10 | **What to build next?** | **PM-00 Security containment** (owner toggles + five small guarded PRs + two baton items, see §11), then **PM-01 Reproducible build / CI truth**. Nothing rental-shaped before those two, because everything after them assumes GHL cannot set truth, a trigger cannot fabricate rentals, and the schema is reproducible [§11, roadmap §5] |

---

## 1. WHAT EXISTS

| Area | What exists | Evidence |
|---|---|---|
| App | 127 pages + 30 API routes (157 routes; 175 registry rows incl. `apps/engine` 13 and `aria` 5); 11 route groups + ungrouped; Next 16.3.5, React 19, Tailwind 4, Supabase | [E1 §1], [E2 §1.1], spec §6.1 |
| Build and tests | install, lint, typecheck and `next build` PASS in this worktree; vitest 2320 pass / 2 fail (Windows-only) / 14 skip = 2,336; CI runs vitest + lint + typecheck + build only; 10 E2E specs and 11 SQL rehearsals (8/11 runnable as-is) are **not** in CI | [E1 §3, §5], spec §4.4 |
| Data | 178 tables, all with RLS on; 892 leads, 1,656 GHL contacts, 299 background checks, 43 `fleet` + 27 `vehicles`, 31 payment rows, 19,097 VA tasks | [E3 §1], [E5 §C.3] |
| Rentals skeleton | typed `bookings` with a live double-booking guard; quote + hold code; pricing rules | [E3 §1.1] |
| Credit Center | owner desk, report importers, accuracy policy, gated letter path, CROA compliance gate (closed), drive-to-own readiness | [E5 §A.1] |
| AIXMOS | SMS agent (owner-hold, kill switch, spend cap, PII redaction), ops AI, agent spine, member app | [E5 §B] |
| Integrations | GHL webhooks (6), Stripe/Cal per-tenant receivers, Twilio inbound, ClickUp, Airtable (legacy) | [E4 §1] |
| Automations | ~25 active (10 pg_cron, 13 triggers, 1 off-repo GHL poller); 2 Vercel crons whose handlers never run | [E4 §5] |
| Security work done | profiles self-escalation **REMEDIATED on prod** (09-21); `partner_acquisition` least-privilege **REMEDIATED on prod** (09-22); TRUNCATE grants removed; replay guards; durable rate limiter live; prod write baton | [E5 §C.2, §C.3, §C.5], spec X2, X4 |
| Elsewhere (rescued) | customer portal (15 pages), dealer desk (10), Fast Track (3 pages), dealer-admin invite flow — PRESERVED-RESCUED, not canonical | [E6 §1.2] |

## 2. WHAT WORKS

"Works" means the code path is complete and the prod evidence is consistent. It is not a runtime health claim [spec §0.2].

- Staff sign-in and the 29-screen rentals desk (28 reachable by staff; reads through RLS, writes through an allow-listed `adminUpsert`) [E2 §1.3].
- Lead capture: `web-lead-intake` and the off-repo GHL poller → `promote_ghl_contact` (DNC-gated) are the **2 of 27** intake surfaces carrying traffic [E4 §3].
- Background-check queue and decision trail [E2 §1.3].
- Quote, price floor and hold with the overlap guard (logic tested; never exercised: 0 bookings) [E3 §5].
- Credit owner desk on the gated path, and the CROA gate refusing letter storage as designed [E5 §A.1].
- Webhook signature checks: GHL HMAC/secret + replay, Stripe per-tenant, Twilio HMAC, Cal HMAC [E4 §1.2, E5 §B.2].
- Rescue dispatch cockpit [E2 §1.3].
- Internal owner/staff notifications (Slack/Telegram), fire-and-forget — **internal only; no customer message has ever been delivered** [E4 §4].
- pg_cron jobs run on schedule (7-day history clean) [E4 §5].
- RLS fails closed everywhere; profiles columns protected; `partner_acquisition` least-privilege [E5 §C].

## 3. WHAT IS BROKEN

| # | Broken | Evidence |
|---|---|---|
| 1 | **No customer path.** `/status/[token]` and `/intake*` send signed-out visitors to `/login`; customer accounts are sent to `/no-access` | [E2 R3, §2.2] |
| 2 | **8 machine APIs redirected to login by middleware, so the Vercel crons' handlers do not run** (pinned by `middleware.test.ts:237`; KPI table last written 2026-05-20); licence, audit, mission, ops-command are unreachable. Not a one-line fix (mission-daily pairing, duplicate recompute, `/api/license/*` has no credential) | [E2 R1, E4 §5], spec §17 |
| 3 | **Operator sign-in loops** between `/desk` and itself | [E2 R2] |
| 4 | **7 screens read tables that do not exist in prod** (`/command/desk`, `/executive`, `/operator`, `/operator/leads`, `/investor`, `/pocket/earn`, `/pocket/build`); 14 ghost tables in total | [E3 §1.5], spec X3 |
| 5 | Silent data loss: intake audit rows (ghost `activity_logs`), un-awaited side effects, GHL events consumed before processing | [E4 §6] |
| 6 | Column drift: payment balance rows never written (`amount_past_due`), GHL notes lookup errors (`email`), `vin_number` form fields | [E3 §1.5] |
| 7 | 25 of 31 payments marked Overdue by a date sweep, whether or not money arrived | [E3 §2] |
| 8 | GHL stage map ships empty → every stage = `inquiry` | [E4 §0] |
| 9 | Credit `[id]` page uses the ungated letter generator | [E5 §A.1] |
| 10 | Voice agent returns 500 without an org slug (nil-UUID fallback) | [E5 §B.2] |
| 11 | Twilio inbound: 0 of 9 orgs have a number | [E4 §3] |
| 12 | "Dashboard" link goes to the marketing page; portal nav shows owner links and a literal `__MARKETING_SITE__` | [E2 R4, R5] |
| 13 | mission-daily GitHub job is green every day while doing nothing (307) | [E6] |
| 14 | 2 unit tests fail on Windows; one guard passes vacuously on Windows | [E1 §3.1] |
| 15 | `lead_to_active_customer_trg` is **enabled on prod** and fabricates "Active" rentals from a lead-status edit; it is not a rental lifecycle | [E3 §2], spec §10.4 |

## 4. WHAT IS MISSING (design-only)

- **Rental state machine**: no transition function, no event log. Only `hold` is ever written [E3 §2].
- **Agreements / e-sign**: no provider, no generation, no signed agreement in Supabase. Signatures exist only in Airtable [E3 §4].
- **Processor-verified payments**: nothing requires proof. Stripe receiver writes no money; deposits, refunds and failed payments are not handled [E3 §3].
- **Customer-facing messaging delivery**: all senders orphaned; outbox has no drainer; queued ≠ delivered [E4 §4].
- **Customer login and per-person access** (tier `none` locked out) [E2 §2.2].
- **Person spine, vehicle owner + owner agreements, extensions, returns, tolls/violations, reconditioning, utilization** [E3 §1.1, SoR §3].
- **Per-org GHL connections / N locations** (only on unmerged GHL branches) [E4 §0].
- **Credit: tracking, response, outcome, customer upload/review, lender matching** [E5 §A.2].
- **Tenant-isolation and privilege tests in CI; a non-production database** [E5 §C.4, GHL B-7].
- **Repo that can rebuild prod**: 279 prod migrations vs 89 in the repo; the rental core has no `CREATE TABLE`; 6 of 7 edge functions have no source [E3 §1.6].

## 5. WHAT IS DANGEROUS

Statuses use spec §0.5 (OPEN / REMEDIATED / MITIGATED / BLOCKED / OWNER ACTION / ACCEPTED LIMITATION / UNKNOWN).

| # | Danger | Severity | Status (2026-09-22) | Why it matters now | Evidence |
|---|---|---|---|---|---|
| 1 | `partner_acquisition` authenticated `ALL true` + anon insert (historical root cause); PR #255 open to feed it | P0 (historical) | **REMEDIATED in production + post-application verified** (00:50Z; ledger `20260922005007`; prepared commit `620e100e`, branch not merged). Exposure window ~51 min: no evidence found, not proven absent. Follow-ups: land the branch, `KNOWN_UNAPPLIED` 54→53, `internal_team` decision | the repo still does not carry the fix; PR #255 must stay on hold until it lands | [E5 §C.7], spec X4 |
| 2 | Public signup may bypass the invite (AUTH-SIGNUP-001) | HIGH | **OPEN / OWNER ACTION REQUIRED** (unverified) | combines with any remaining authenticated-`true` policy (`change_log`); containment ≠ tenant authorization | [E5 §C.1] |
| 3 | master unprotected + `session-autopilot` auto-merge/delete code | HIGH | **OPEN — LATENT RISK** (auto-merge off; recent merges human; not an incident; not resolved) | one settings change away from an unattended prod deploy | [E6] |
| 4 | mission-daily ungated team broadcast | MEDIUM | OPEN (latent) | re-arms as soon as middleware lets `/api/mission/*` through | [E6] |
| 5 | GHL tag/event → "Paid" payment + commission + tokens | HIGH | OPEN (latent; CODE CAPABILITY, 0 rows on prod) | fake money and payouts once GHL webhooks connect | [E4 §2(a)] |
| 6 | GHL stage auto-verifies rental/case state (default on); payload can override the form kill switch | HIGH | OPEN (latent) | breaks "GHL never sets business state" | [E3 §6], spec V1/V4 |
| 7 | `lead_to_active_customer` trigger fabricates Active rentals (enabled on prod) | HIGH | OPEN | a text edit creates a rental | [E3 §2] |
| 8 | DNC bypass on outbound GHL tag/field/stage writes | MEDIUM | OPEN | tags trigger GHL workflows that may text people who said STOP | [E4 §2(c)] |
| 9 | `is_staff()` is cross-org | HIGH | OPEN | not safe for more than one tenant | [E5 §C.4] |
| 10 | Deployed edge `intake` v7 and `capture-drive` (not in repo) | HIGH | OPEN / OWNER ACTION (via GHL B-4/B-5) | unauthenticated service-role writers | [E4 §3] |
| 11 | ANON-TENANT-001: 6 anon tables with caller-chosen org | HIGH | OPEN (GHL M1 branch; not applied) | tenant spoofing | [GHL-BLOCKERS B-6] |
| 12 | Open redirect in auth callback | MEDIUM | OPEN | phishing via a real TMMT link | [E5 §C.1] |
| 13 | Single live lead feed is a laptop job with a silent 5,000 cap | MEDIUM | OPEN | leads can stop without anyone knowing | [E4 F15] |
| 14 | Credit: CPN ban unenforced, arbitrary payload write, projections on the desk ⚖️ | MEDIUM | OPEN (credit track) | compliance exposure if anything leaks to customers | [E5 §A.5] |
| 15 | `change_log` authenticated ALL `true` | MEDIUM | OPEN | the other table outside the tenant model | [E5 §C.3] |

## 6. WHAT SHOULD BE PRESERVED

- The **security work already done**: profiles protected columns and `partner_acquisition` least-privilege (both on prod), replay guards, owner-hold on AI replies, opt-out-first SMS, quarantine of unverified payment follow-ups, prod write baton, durable rate limiter [E6 Task 2, spec §20.2]. Never re-apply or re-write them.
- **`bookings` + `bookings_no_overlap` + `rental_pricing_rules` + quote/hold code**. This is the rental foundation [E3 §1.1].
- **The typed but unused tables**: `contract_instances`, `documents`, `vehicle_events`, `vehicle_damage_reports`, `vehicle_media`, `payments`, `rental_ledger` entry types, `lto_agreements` (to be reshaped as two documents). They are the skeleton for PM-05…PM-13.
- **`payment_obligation_reconciliation`**, whose evidence-required pattern is the model for "paid" [E3 §3.3].
- **Credit engine policy + gated path + CROA gate**, left closed until counsel signs [E5 §A].
- **SMS agent design**: owner-hold, kill switch, spend cap, fixed action enum (no raw DB or shell) [E5 §B].
- **`outbound-gate.ts`** (fails closed) and `do_not_contact_numbers` [E4 §4].
- **Token UI kit** (`src/components/ui/*`) and `BrandProvider` [E2 §4].
- **Rescued work** (PRESERVED-RESCUED; classified in spec §33): customer portal, dealer desk, Fast Track core, dealer-admin invite flow, LOTOS docs [E6 §1.3].
- **SYSTEM_OF_RECORD rules** (one writer per field; GHL never sets business state; no riba as a schema constraint) [SoR §5].

## 7. WHAT SHOULD BE REPAIRED (and by whom)

| Repair | Milestone / owner |
|---|---|
| Middleware: machine APIs reach their secret checks (after mission-daily is made safe; `/api/license/*` split out) | PM-01 (TMMT-BUILD-001) |
| Customer pages public; customer tier home; operator home loop; Dashboard link; portal nav | PM-19 |
| Ghost tables and column drift: create or remove, per owner decision | PM-02 |
| GHL payment path (no Paid from GHL), GHL auto-ops off + V4 precedence, DNC on outbound GHL writes | PM-00 (GHL track reviews) |
| Silent-failure sites (FS-01…FS-23): check results, surface failures | each milestone's DoD |
| Overdue sweep → based on the ledger, not the date | PM-06 |
| Credit `[id]` ungated path, payload validation, CPN ban | **credit track (C1)** — not a PM- task |
| Voice agent org fallback + owner hold | PM-15 |
| SQL rehearsals and E2E into CI; Windows-safe guards | PM-01 / PM-17 (coordinate 2A-A3, GHL M9) |
| `org_roles` recursion | **Phase 2A A12** — PM-02 references it only |
| Per-org staff scope | PM-02 (pilot), GHL M9 (matrix) |
| Land `sec/partner-acquisition-rls`; reconcile `KNOWN_UNAPPLIED` | that workstream (TMMT-SEC-008 records it) |
| GHL registry, identity, webhook inbox, routing, intake contract, outbox design | **GHL track M3–M13** — never a PM- task |

## 8. WHAT SHOULD BE RETIRED

| Retire | Why | Evidence |
|---|---|---|
| `lead_to_active_customer` trigger (disable first, drop = later owner decision) | fabricates rentals | [E3 §2] |
| `session-autopilot.yml` auto-merge + branch-delete steps | latent unattended deploy | [E6] |
| mission-daily schedule as configured | latent broadcast, fake green | [E6] |
| `apps/engine` (13 pages) | duplicate of `(learn)`, not deployed | [E2 §1.1] |
| `aria/` | unauthenticated chat, local-only | [E5 §B.2] |
| `AIXMOS/` static site, `workstream-*` README folders | retired / planned-only | [E5 §B.2] |
| Airtable webhooks + `sync-airtable.mjs` | after SoR §6 step 3 is verified | [E4 §3], [SoR §6] |
| `active_customers` / `former_customers` as live tables → read-only history | superseded by `bookings` | [E3 §1.1] |
| Duplicate journey recompute (keep one) | runs twice once the Vercel cron is reachable | [E4 §5] |
| `insurance.login_*` columns | credential columns | [E3 §1.1] |
| Windows `TMMT-Watchdog` restarting the retired TMMT OS | 2A-A11 | [E4 §5] |
| One of the two UI kits; one of the two vendor tables; one of the two vehicle tables (owner decision) | duplication | [E2 §4.2], [E3 §1.5] |

## 9. UNIQUE WORK WORTH RECOVERING (classification per spec §33)

| Rank | Pocket | Classification | Why | Condition before landing |
|---|---|---|---|---|
| 1 | **Customer portal** `(client)/client/*` (15 pages, TMMT-OS-ARCHIVE) | UNIQUE AND RELEVANT | owner URGENT; nothing like it in canon | PM-19 customer auth; per-person RLS; Next 16 / React 19 / Tailwind 4 pass; URL-shape decision; read then re-written, never copied with its data layer |
| 2 | **Dealer desk** `(internal)/internal/dealer/*` (10 pages) | UNIQUE AND RELEVANT | owner URGENT | per-org staff scope (TMMT-DATA-003) first; collections follow mercy / no-riba rules; payments owner-gated |
| 3 | **Fast Track core** (T07 PC Kit overlay: `/apply`, `/apply/[slug]`, `/apply/packet` + components + lib) | UNIQUE AND RELEVANT | canon-adapted port, the better source | reconcile with GHL M8 intake contract; GHL owner decides vs `/forms/apply` |
| 4 | **Fast Track migration** `20260825000000_fast_track_applications.sql` | UNIQUE AND RELEVANT after rewrite | only copy | **rewrite first**: remove anon `WITH CHECK (true)` and any-authenticated read of applicant PII; add org_id, staff read, REVOKE, durable limiter; baton |
| 5 | **Dealer-admin invite flow** (T08) | UNIQUE AND RELEVANT | invite/resend/deactivate dealer admins | fold into `signup-invite.ts`; respect protected `profiles` columns; Phase 2A A4b coordination; find the never-captured `src/lib/invites/` on the M1 |
| – | LOTOS docs | UNIQUE AND RELEVANT (docs only) | product inputs for the dealer SaaS | lift docs only (bundle history has a credentials-named file) |
| – | T10 AIX-CREDIT-DISPUTE funding matcher | NEEDS MANUAL REVIEW | only lender-matching logic anywhere | credit track, human + ⚖️ review |

Nothing rescued is automatically canonical; no bundle is automatically merged. Never push the rescue bundles as they are: their history carries credentials-named files and CVILLE PDFs [E6 §1.1].

## 10. TOP BLOCKERS

### 10.1 Security (in priority order)

1. **AUTH-SIGNUP-001 — OPEN / OWNER ACTION REQUIRED.** GoTrue public signup bypasses the app's invite gate; the toggle state is unverified. Owner action: 2A-A4a toggle now, A4b server-side invite later. Regardless of the toggle, RLS must hold against an already-authenticated hostile account [E5 §C.1].
2. **Unprotected master + latent auto-merge — LATENT RISK.** Branch protection is impossible on the current plan, and `session-autopilot.yml` carries `gh pr merge --auto` plus branch-delete code. Auto-merge is off and recent merges were human, so this is not an incident; it is one owner click from becoming one. Any merge is a prod deploy with no server-side baton [E6].
3. **Middleware blocking crons and machine APIs, and the mission-daily broadcast.** The Vercel crons' handlers never run (`middleware.test.ts:237`). Fixing the 307s is required (PM-01), but loosening `/api/mission/*` without first changing mission-daily's `audience=team, notify=true` default re-arms an ungated daily broadcast, reviving the journey cron doubles the recompute, and `/api/license/*` has no credential [E2 R1, E6, spec §17].
4. **GHL-tag payment rows (capability, never fired).** A revenue tag or any `amount` becomes a "Paid" `customer_payments` row with no org and no processor check. It also triggers a commission and a token grant. Dedupe is a text `ILIKE` [E4 §2(a)(b)].
5. **GHL stage auto-verify and the V4 payload override.** `GHL_AUTO_OPS` defaults on; `GHL_FORM_AUTO_CASE=false` can be overridden by a payload `create_case: true` [E3 §6, spec §21.2].
6. **DNC bypass on outbound GHL writes.** Tag, field and stage writes that trigger GHL workflows skip `assertOutboundAllowed`, and the email branch skips DNC. GHL per-channel DND is never read [E4 §2(c)].
7. **Open redirect in the auth callback.** `?next=/%5Cevil.com` goes to `https://evil.com/` (`src/app/api/auth/callback/route.ts:18,32`) [E5 §C.1].
8. **`is_staff()` cross-org.** It is used by 189 policies, so any staff user of any org reads every org [E5 §C.4].
9. **No isolation or privilege tests in CI.** The rehearsals and E2E exist but are not wired; E2E would hit prod. This is 2A-A3 and GHL M9 [E5 §C.4, E1 §5].
10. Also open:
    - Deployed edge functions `intake` v7 and `capture-drive` (GHL B-4/B-5, owner decision).
    - ANON-TENANT-001 (B-6, GHL M1) and PARTNER-TENANT-001 (B-8).
    - `change_log` authenticated `true`.
    - `org_roles` recursion (Phase 2A A12).
    - Cross-org signed URLs.
    - Default-ACL TRUNCATE re-grant.
    - `partner_acquisition` follow-ups (REMEDIATED on prod): land the branch, `KNOWN_UNAPPLIED` 54→53, `internal_team` access decision.

### 10.2 Product

1. No rental state machine (and an enabled trigger that fabricates rentals).
2. No processor-verified payments.
3. No agreements or e-sign. Airtable is the only holder of signatures and documents.
4. No customer login path.
5. No safe way to message customers (queued ≠ delivered).
6. Two vehicle tables, 9+ person tables, 0 active vehicles. The fleet data contradicts SQUARE ONE.
7. The repo cannot rebuild prod.

### 10.3 UX

1. No customer face at all in canon.
2. Four shells, two UI kits with the same component names, three nav definitions.
3. Broken homes: the operator loop, and "Dashboard" pointing at marketing.
4. No toast or feedback component; `alert()` in 3 files. The credit face has no dark mode.
5. Missing loading/error states on auth, partner, forms and marketing. The dispatch cockpit is desktop-only.
6. Owner-only links leak into every portal's nav.

### 10.4 Integration

1. GHL is one env token and one location. N-org / N-location exists only on unmerged M3/M4 branches (M3 dev-only, not applied; M4 dev CLI).
2. The only live lead feed is an off-repo laptop poller.
3. Inbound GHL webhooks have never received a verified event. The event id is consumed before processing, so failures lose events.
4. The stage map is empty.
5. Stripe, Twilio and Cal are unset on all 9 orgs.
6. n8n is abandoned, so the outbox has no drainer.
7. Local AI endpoints (pocket brain, captain, iMessage, agent worker) are unreachable from Vercel.
8. 6 of 7 edge functions are not in the repo.

## 11. RECOMMENDED IMPLEMENTATION ORDER

Details, dependencies and exit criteria: `TMMT_ROADMAP.md`. The PM- roadmap references GHL M0–M13 and Credit S0–S7 / C1 by their own numbers and never renumbers or rebuilds them.

1. **PM-00 Security containment (FIRST).**
   - `partner_acquisition`: already REMEDIATED on prod; the other workstream lands the branch (no policy work here).
   - Signup toggle (owner).
   - Neuter session-autopilot and mission-daily.
   - GHL kill switches (`GHL_AUTO_OPS=false`, `GHL_FORM_AUTO_CASE=false`) plus the V4 payload-precedence fix.
   - No "Paid" from GHL.
   - DNC on outbound GHL writes.
   - Open-redirect fix.
   - Disable `lead_to_active_customer` (staged; baton).
   - `change_log` policy (staged; baton).
2. **PM-01 Reproducible build / CI truth.**
   - Machine-route middleware fix, only after mission-daily is safe; `/api/license/*` per owner decision.
   - SQL rehearsals in CI (2 rehearsals `pending` until their targets are found).
   - Ledger drift reconciled (repo can rebuild prod; outside GHL M2's tables).
   - `tsc` in the local gate, LF line endings.
3. **PM-02 Canonical data, tenancy, roles**, then **PM-19 Customer identity and access path.**
4. In parallel, owned elsewhere:
   - **PM-03/PM-04** = GHL router M0–M11 (reference only).
   - **PM-14** = credit C1 → S0–S7 (reference only).
5. **PM-05 Rental state machine** and **PM-18 Communications gateway** (consuming the GHL M8 outbox design).
6. **PM-06 Payments** (after the owner decides the processor in `TMMT_PAYMENT_ARCHITECTURE.md`) and **PM-07 Agreements / e-sign.**
7. **PM-08 Handoff** → **PM-09 Active rentals** → **PM-10…PM-13**: maintenance, extensions, incidents/tolls/damage, returns/inspection/reconditioning.
8. **PM-16 Flagship UX** in slices, as each prerequisite lands:
   - Portal shell after PM-19.
   - Dealer desk after PM-02 (per-org scope).
   - Rental and billing pages after PM-09.
   - Fast Track after GHL M8, with its migration rewritten.
9. **PM-15 AIXMOS** scoped tools (with GHL M13), and **PM-17 Production hardening** (continuous; final gate; PARTNER-TENANT-001 closed before the first external partner).

**Owner decisions needed soonest:**
- Signup toggle.
- session-autopilot and mission-daily.
- GHL kill-switch env values.
- Read-only catalog access; `/api/license/*` option.
- Canonical vehicle table and the fate of the 43 `fleet` rows.
- Role source of truth.
- Customer portal URL shape.
- Payment processor.
- Signing provider.
- D-22b perform-vs-refer (credit).
- A non-production Supabase for E2E.
- `internal_team` access to `partner_acquisition` (product decision).
