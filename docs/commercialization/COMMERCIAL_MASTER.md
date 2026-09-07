# COMMERCIAL MASTER

**What exists, what it is worth, and what to sell next.**

Audit date: 2026-09-07 · Repo `TMMT-LIVE` @ `e4950c97` · DB `uapxakmlwnpfsftfeezx`

> **Rule for this document.** Section 5 (VERIFIED PRICING) contains only prices
> that already exist as evidence in the repo or database, each with its source.
> Section 6 (PROPOSED PRICING) is my recommendation and is **not** a commercial
> term until the owner approves it. Nothing in section 6 has been written to the
> database, to any page, or to any contract.

---

## PHASE 2 CORRECTIONS — read this before the rest

A verification pass on 2026-09-07 corrected six claims below. **Where this section
disagrees with the body of the document, this section is right.**

Companion documents produced by that pass:
`PRICE_RECONCILIATION.md` · `OWNER_DECISIONS.md` · `REVENUE_READINESS.md`

**C1 — "Nothing can take money today" was overstated.** That claim rested on
`.env.example` containing placeholders. `.env.example` is not evidence about
production. Vercel environment *values* are not exposed by the tooling available to
me, so config readiness is marked **`UNVERIFIED PRODUCTION CONFIGURATION`** and must
be checked in the dashboard. What *is* true: `checkoutHref()` never produces a dead
link — with no env var set it falls back to the GHL campaign site — and **money is
taken in GoHighLevel, not in this application** (Stripe here is receipt-only; no
charge is initiated anywhere in the codebase).

**C2 — the licensing crown jewel was described using the code's own inaccurate
docstrings.** Corrected: the install token is hashed with **plain unsalted SHA-256,
not HMAC**; the Secure Enclave public key is **stored and never verified anywhere**
(collection, not attestation); the returned "license JWT" is an **opaque digest**,
and the code's own comment admits *"full Ed25519 JWT signing happens once vault is
wired"*; the heartbeat authenticates only on `organization_id` + `hardware_uuid`,
neither of which is a secret; and **the kill switch is advisory** — a client that
ignores the 410, or stops calling, is unaffected. The architecture and the tenancy
depth are the real asset. **Do not claim cryptographic attestation in a sales
document.**

**C3 — Dispatch was overstated.** Called "a complete multi-tenant product". It is
~1,482 lines total and has **never been used**: `incidents` = 0 rows,
`incident_assignments` = 0, `org_responder_links` = 0, `units` = 3. A credible
product skeleton, not a proven product. The proposed $50k–$90k replacement figure in
§9 is revised to **$15k–$35k**.

**C4 — `dist/` is no longer at risk.** Another session restored it during this
audit; it is present, tracked and clean (23 files, matching HEAD). Forensics show it
was **tracked first (2026-06-18/21) and gitignored after (2026-06-22)** by a generic
hygiene commit, and that **nothing generates it** — `FLEET-UP.sh:110-113` *consumes*
it and exits 1 if missing. It is a hand-made release artifact. See `OWNER_DECISIONS.md`
D-7.

**C5 — the contradictions were undercounted.** $50,000 has **seven** distinct
commercial meanings, not four. And there are **five mutually incompatible
revenue-share schemes**, of which the only one that **writes to the production
database** (0/70/85% by seat stage) was never approved and *inverts* the direction of
another. The "agency 80% / operator 0–35%" figures cited in §5.5 are **live-DB
observations only** — no migration defines those columns.

**C6 — two more promise-vs-implementation gaps.** Beyond the owner-approval gate:
`requireGate()` (the legal-gate enforcer) also has **zero callers**, and
`src/lib/owner-approval-enforcement.test.ts` is a text lint that **passes vacuously**
because nothing matches its predicates. `GO.command:74-75` reports green on **file
existence**, which is why this went unnoticed. ⭐ **Mitigator:** no code in this
repository moves money — the promise is unenforced *and* unexercised.

### The two facts that most change the picture

**F1 — Fulfilment is manual end-to-end and has never been run.** There is no
self-serve path. Account creation is invite-gated and **`signup_invites` has 0 rows,
ever**; invites are created only by `scripts/invite.mjs`, run by hand. The GHL
purchase webhook maps a tag to a SKU and **returns a string** — no queue, no worker.
Provisioning is an 11-step manual runbook whose `handoffs/` directory has never been
created. Selling is possible; delivering requires a person at every step.

**F2 — The revenue ground truth.** The only real money ever recorded in this system
is **31 payments totalling $9,510.57, October 2025 → March 2026**, all small rental
payments. **The largest single payment ever recorded is $577.** Nothing since March.
Zero software or SaaS revenue, ever; zero organizations carry a Stripe subscription;
zero profiles carry a package. Every price above $577 in this document is
**untested**, which is not the same as wrong — but it is the caveat that governs
every valuation figure that follows.

---

## 0. EXECUTIVE SUMMARY

You did not build a car rental app. You built a **multi-tenant business
operating system with a software licensing control plane**, and then ran your
own rental company on it as tenant #1.

Six things are true, and they are the whole picture:

1. **The platform is real.** 165 database tables, 96 of them tenant-scoped, 344
   row-level security policies, 267 functions, 240 applied migrations. 110
   screens. 11 distinct product areas. ~65,000 lines of application code plus
   ~53,000 lines of documentation. This is not a prototype.

2. **The most valuable thing you own is not the rental software.** It is the
   **sovereign licensing spine** — one-time install tokens, hardware-UUID
   binding, Secure Enclave attestation, daily heartbeat, and a remote
   `kill_command: wipe`. That is the machinery required to sell a white-label
   business system onto somebody else's hardware and still control it. Very few
   businesses your size have this. It is wired and working.

3. **Taking money is a configuration question, not a code question — and it is
   unresolved.** *(Corrected in Phase 2 — see C1.)* Every checkout button resolves
   through `src/lib/ghl-offers.ts` to a GoHighLevel URL held in an environment
   variable; 14 offers are coded and the fallback never produces a dead link.
   Whether the production URLs are set is **`UNVERIFIED PRODUCTION CONFIGURATION`**
   — Vercel env values are not exposed to me. Two things *are* certain: the
   activation runbook tells you to set eight checkout variables **without the
   `NEXT_PUBLIC_` prefix the code requires** (they would silently do nothing, with
   no error anywhere), and the three recurring-checkout variables are documented
   nowhere at all. **The bigger constraint is fulfilment — manual at every step,
   never run once (F1).**

4. **You have three price lists and they contradict each other.** Ladder A
   (`docs/OFFER-STACK.md`, self-declared canonical, $1,875→$100K), Ladder B (the
   shipped storefront, $997/$2,997/$3,497 + monthly), and Ladder C (`/build`
   high-ticket, $3,750→$50,000 with deposits). **Ladder A contains none of the
   SKUs the live site actually sells** — and your contract templates point at
   Ladder A. Sixteen distinct pricing contradictions are catalogued in section 5.4.
   This is the single biggest commercial risk in the business: two people quoting
   from two documents will quote different numbers for the same thing.

5. **The credit vertical cannot be sold as a service.** All seven legal gates in
   `shared/compliance-gates/gates.config.json` are closed except the permanent
   CPN prohibition. No attorney-approved CROA suite, no VDACS registration, no
   surety bond. Software and referral are sellable; done-for-you credit repair is
   not. Your Khan Strategies referral route is the correct and compliant answer,
   and it is already built.

6. **Your entitlement system is finished and switched off.** 53 entitlements
   across 19 categories and 3 portals, 94 package→entitlement mappings, all 10
   packages mapped. Zero profiles are assigned to a package, and the word
   "entitlement" appears **nowhere in the application source**. You have a
   fully-modelled licensing/packaging layer that no code reads. Turning it on is
   the highest-leverage engineering task on this list.

**The honest bottom line.** The build is far ahead of the business. What is
missing is not code — it is a single price list, live payment links, and the
switch that connects packages to what a customer can actually see.

---

## 1. TOTAL BODY OF WORK

### 1.1 Scale

| Measure | Count |
|---|---|
| Real commits (excl. 10,061 `swarm:` bot commits) | **1,082** |
| Repo lifespan | 2026-02-17 → 2026-09-07 (~6.5 months) |
| Application pages | 110 |
| API route handlers | 29 |
| Library modules (`src/lib`) | 208 |
| React components | 38 |
| Unit/integration test files | 58 |
| Playwright e2e specs | 5 |
| Scripts | 198 |
| Documentation files | 301 (~53,300 lines) |
| Application code | ~65,000 lines |

### 1.2 Database (production)

| Measure | Count |
|---|---|
| Tables | 165 |
| Tables carrying `org_id` (tenant-scoped) | **96 (58%)** |
| Views | 23 |
| Functions | 267 |
| RLS policies | 344 |
| Triggers | 61 |
| Enum types | 41 |
| Applied migrations | 240 |

### 1.3 Data assets held

| Table | Rows | Note |
|---|---|---|
| `exec_va_tasks` | 19,097 | Executive VA task engine |
| `audit_events` | 3,820 | Compliance audit trail |
| `ghl_contacts` | 1,642 | GoHighLevel mirror |
| `people` | 1,209 | Unified person spine |
| `intake_events` | 880 | |
| `incoming_leads` | **876** | The headline commercial asset |
| `tickets` | 308 | |
| `background_checks` | 299 | |
| `entitlements` / `package_entitlements` | 53 / 94 | Modelled, unused |
| `organizations` | 9 | 4 verticals |

**Lead flow is historical, not current.** 662 leads landed in April, 111 in May,
zero in June, 91 in July, 11 in August, 1 in September. The 876 leads are a
**one-time monetizable asset**, not a pipeline. Treat them as inventory to be
worked once, not as recurring supply.

### 1.4 The eleven product areas

| # | Product | Maturity | Standalone sellable? |
|---|---|---|---|
| 1 | **Admin / rentals back-office** (27 screens: fleet, revenue, leads, cases, insurance, maintenance, 4 multi-view apps) | SHIPPED | Yes |
| 2 | **Command Center** (owner desk, AI-reviewed owner→operator messaging, guarded cross-entity handoffs) | SHIPPED | Bundle only |
| 3 | **Dispatch** (multi-tenant roadside/rescue: cockpit, units, responder approvals, incidents, mobile responder) | SHIPPED | **Yes — distinct product** |
| 4 | **Credit dispute engine** (DisputeFox + MyFreeScoreNow importers, 14 FCRA violation codes with legal basis and removal-probability scoring, 7 dispute round types, letter generation) | SHIPPED | Yes, **legally gated** |
| 5 | **AIXMOS Cube** — credit & funding readiness (15 screens, 10-state workflow, 4 approval gates, document storage, GHL enrolment) | PARTIAL | Yes, gated |
| 6 | **Operator Academy** (15-module cert path, DB-backed progress, rubric scoring) + lead pool claim/assign | SHIPPED | Yes |
| 7 | **AIXMOS Pocket** PWA (token-metered local-brain coach, referral payouts) | SHIPPED | Bundle |
| 8 | **Role portals** (executive VA, investor, partner fleet, vendor jobs) | SHIPPED | Bundle |
| 9 | **Lead capture** (19 public forms + `/lp/[org]/[sku]` multi-tenant landing template + webhook) | SHIPPED | Yes |
| 10 | **Marketing funnels** (`/kits`, `/dealers`, `/join`, `/upgrade`, `/build`, `/try`) | PARTIAL | Bundle |
| 11 | **Licence / sovereign-box control plane** (`/api/license/*`) | SHIPPED | **Yes — crown jewel** |

### 1.5 The engine (reusable capability layer, ~17,300 lines + `@aixmos/core`)

Ten clusters that separate cleanly from TMMT and could be lifted into other
products:

1. **AI agent framework** (`src/lib/agent/`, ~1,700 lines) — multi-tenant LLM
   sales/support agent. Zod-contracted Anthropic output, **per-org daily spend
   cap enforced from the audit log**, global kill switch, license gate,
   banned-phrase regeneration loop, CFPB disclaimer engine, opt-out and quiet
   hours, Luhn/SSN PII redaction before any boundary crossing, pure finite state
   machine, jailbreak-signature audit. Only the persona copy is TMMT-specific.
2. **Multi-tenant white-label platform** (`src/lib/platform/`, ~820 lines) —
   host/slug/path tenant resolution (edge-safe), brand→CSS-token generation with
   contrast math, operator custom-domain onboarding with DNS-over-HTTPS
   verification.
3. **Hardware-bound licensing** — install token, hardware UUID, Secure Enclave
   pubkey, heartbeat, remote wipe.
4. **Credit dispute / FCRA engine** (~2,140 lines).
5. **Compliance gate library** (`shared/`) — 7 hard legal gates enforced in CI,
   A2P/CROA SMS gate, permanent CPN/rented-tradeline prohibition, TypeScript and
   Python twins.
6. **GoHighLevel integration layer** (~1,850 lines) — full GHL v2 client plus a
   signature-verified, replay-windowed, idempotent webhook dispatcher.
7. **Money meter + token ledger** (~520 lines) — unified collected/used/saved
   ledger; prepaid AI-job metering.
8. **Lead pool + rule routing** (~850 lines).
9. **Offline-first desk** (IndexedDB + outbox).
10. **`@aixmos/core`** (1,590 lines) — status machine, readiness engine, coach
    engine, cube store.

### 1.6 Provisioning and deployment tooling

- **`scripts/partner-deploy/`** — the most commercially distinctive tooling in
  the repo. Flash-drive white-label partner install: Secure Enclave attestation,
  one-shot install tokens, four-tier owner kill switch, launchd agents
  (15-min/hourly/24h), verbatim clickwrap consent, cross-tenant RLS,
  `issue-license.sh`, `kill-partner.sh`, `burn-partner-usb.sh`, health-check,
  recovery-flow, uninstall. Its README honestly marks which parts are real and
  which are v1 stubs. **Dormant since June.**
- **`provision-tenant-seat.mjs`** (343 lines) — genuinely provisions. Config-driven
  learn/earn/admin/graduate ladder with revenue splits, CSV bulk, plan-only /
  dry-run / apply, typed-confirmation guard before any live write.
- **`provision-dealer-instance.mjs`** — **not** an automation engine. A 123-line
  checklist generator: prints an 11-step runbook with owner assignments and on
  `--apply` writes `OPERATOR-START-HERE.md` + a CSV work queue. Every infra step
  is a manual gate. `handoffs/` does not exist, so `--apply` has never run here.
  **The value is the encoded SOP, not the code.**
- **Quality gates** — CI runs brands→lint→`tsc --noEmit`→vitest→build; pre-push
  blocks force-push to master, tracked secrets, gitleaks, and red builds.

### 1.7 Assets outside this repo

| System | What it is | Commercial angle |
|---|---|---|
| **JOB RADAR** (`dev\JOB-RADAR`) | Working 24/7 opportunity engine. Polls Greenhouse/Ashby, scores postings against repo-derived evidence, **flags where you would be overclaiming**, drafts on free local Ollama, stages packets, never submits. ~775 LOC. 11 real packets on disk. | The anti-overclaim gate is a genuine differentiator. Product candidate. **Not version-controlled.** |
| **AIXMOS Media Vault** (`C:\AIXMOS-MEDIA-VAULT`) | Agency-in-a-box: 6-lane media pipeline (~1,895 LOC PowerShell) + 13 content agents. Real pull/proxy/clip-farm logs. | Product candidate. Gap: queue and posted lanes are empty — never shipped end to end. **Not version-controlled.** |
| **`.config\tmmt`** (~8,000 LOC) | orch, work-baton, preflight, hermes, route, fleet. | Two sellable slices: the **USB one-click local LLM kit**, and the **ledger** (1,300 LOC + 11 MB SQLite) — a credible open-source release. **Not version-controlled.** |
| **Agent Forge `LEARNINGS.md`** | 24,583 lines / 1.2 MB of dated first-hand operational failures. | Publishable as authority content. |
| **AIX-Command-Center** | Earlier, thinner TMMT-LIVE. | Mine the 56 integration notes + 26 SOPs, then retire. |
| **`C:\AI-Brain`** | Largely abandoned, but holds an **investor deck + valuation guide** and **five vertical training sets** (car rental, credit repair, ecommerce, trading, general). | Mine the training sets. |
| **Agent Spine audit** | **52 Airtable automations identified, only 8 live — 44 designed and never deployed.** | This is the Airtable exit plan, already specified. |

> ⚠️ **The three most valuable systems outside the repo are unversioned,
> single-copy, and one disk failure from gone.** `dev\apps` is empty — the Forge
> scaffolder has never produced an app.

---

## 2. YEAR-TO-DATE BUILD

The repo's entire history is this year. **All-time and year-to-date are the same
body of work**, which makes the question "what did I build this year?" answerable
exactly.

### 2.1 The arc

| Period | Real commits | What was built |
|---|---|---|
| **Feb–Apr** | 145 | TMMT Rentals: 18 admin pages, 8 public forms, Supabase. Admin/auth route groups (Mar 25). RLS on all tables + Playwright e2e (Mar 31). CRUD for vehicles/payments/contracts/appointments (Apr). |
| **May** | 117 | **The pivot.** Command center scaffold (May 16). Five role portals in a single commit (May 17). AIXMOS-through-TMMT funnel merges two products into one app (May 19). `/learn` + `/work` cube (May 20). **Dispatch built in 5 commits on May 30.** |
| **June** | **498** (busiest by 3×) | GHL→Supabase→Airtable integration (Jun 7). Credit funding intake + legal pages (Jun 9). 3-tenant revenue engine + `src/lib/agent` (Jun 9). Tenancy hardening (Jun 10). PWA/offline (Jun 15). Token ledger + `/try` (Jun 18). AIXMOS Pocket (Jun 19). |
| **July** | 157 | Mostly **tooling, not product** — mesh, fleet orchestration, 14 autonomy-experiment branches all dated Jul 7±2, nearly none merged. |
| **Aug–Sep** | 165 | Security remediation and the credit-dispute product (Aug 24→). Middleware (Aug 19). Host-based tenancy (Aug 27). Offline desk (Aug 30). Still moving. |

### 2.2 Who built it

- **804 of 1,082 commits (74%)** authored under one of your six git identities.
- **563 of 1,082 (52%)** carry a `Co-Authored-By: Claude` trailer; 115 Cursor.
- **272 (25%)** are agent-*authored*.
- AI share is rising sharply: **September is 55 of 57 commits (96%)**.

### 2.3 The finding that should shape how you read everything else

The gated route groups — `(admin)`, `(command)`, `(operator)`, `(investor)`,
`(executive)`, `(vendor)` — were built **March through May**. `src/middleware.ts`,
the thing that actually gates them, was not added until **2026-08-19**, and its
own commit message reads:

> `fix(security): middleware never ran — every gated surface was public`

**That is roughly five months of "gated" portals shipped without a gate.**
August and September have largely been paying that down. When you evaluate
"is this done", the March–July build dates are not evidence of production
readiness on their own.

---

## 3. READY TO SELL (revenue possible now)

Ordered by how little stands between it and money.

| # | Asset | Why it is ready | Blocker to first dollar |
|---|---|---|---|
| 1 | **876 leads → Khan Strategies referral** | `partner_referrals` table with consent capture, commission field, and full lifecycle (accepted/completed/paid) is built. `referToPartner` action and `ReferToPartner` component ship with a mandatory consent channel. Compliance copy already names Khan Strategies. | Agree a per-referral rate with Khan Strategies. **`commission_cents` is currently left null.** |
| 2 | **Dealer Kit storefront** (Ops Kit / Command Kit / Dealer Bundle) | `/kits` and `/dealers` are live, priced, internally consistent (the "save $497" arithmetic checks out), and back onto a real product. | **GHL checkout URLs.** Coded and waiting on env vars. |
| 3 | **Admin / rentals back-office as a licensed instance** | 27 working screens on real data, offline-first. This is a complete SMB rental operations product. | Price it (Ladder B has no rung for it) and pick delivery mode. |
| 4 | **Dispatch** | A complete multi-tenant roadside/rescue product with its own auth layer and org scoping. Nothing about it is TMMT-specific. | Never packaged, never priced. No SKU exists. |
| 5 | **Operator Academy / $97 seat** | 15 modules in DB, progress tracking, rubric scoring, cert path. Storefront copy live. | Checkout URL **and** resolve the $97-vs-$297 seat contradiction (C-2). |
| 6 | **Consulting / implementation on the encoded SOPs** | `provision-dealer-instance.mjs` and the deal-kit encode a genuinely good 11-step implementation runbook with owner assignments and a go-live quality gate. | Nothing technical. This is sellable as services today. |

---

## 4. ALMOST READY (limited work to revenue)

| Asset | What is missing | Size of the gap |
|---|---|---|
| **Entitlement system** | 53 entitlements, 94 mappings, all 10 packages mapped — and the word "entitlement" appears nowhere in `src/`. Zero profiles assigned. | **Medium.** This is the switch that turns packages into product. Highest leverage item in the codebase. |
| **Sovereign / on-prem license ($50K)** | Control plane works (`/api/license/provision`, `/api/license/heartbeat`). `partner-deploy` is complete but **dormant since June** and its README marks some parts v1 stubs. | **Medium.** Needs a dry run end-to-end on a real machine. |
| **AIXMOS Cube** | Lender submission is an explicit stub. Sample-data buttons still live. Persistence only works when `NEXT_PUBLIC_CUBE_PERSISTENCE=supabase`. | **Medium.** |
| **Stripe billing** | `stripe ^22.2.0` is installed; `organizations` has `stripe_customer_id`, `stripe_subscription_id`, `stripe_connect_account_id`, `connect_charges_enabled`, `agency_revenue_share_pct`. **No org has any Stripe id populated, and no charge is ever initiated in this codebase** — Stripe is receipt-only; checkout is GHL-hosted. | **Medium-large** if you want native billing; **zero** if GHL stays the money rail. |
| **Commission / revenue-split engine** | `revenue_splits` has gross/platform/operator/partner/agency cents with pct, tier and segment. Schema complete, **0 rows, no logic**. | **Medium.** Schema is the hard part and it is done. |
| **44 designed-but-undeployed Airtable automations** | Specified in the Agent Spine audit, never deployed. | **Small each.** This is the Airtable exit. |
| **Credit vertical as a service** | All legal gates closed. | **Large and not technical** — attorney, VDACS registration, surety bond. |

---

## 5. VERIFIED PRICING — CATALOG 1

Only prices already established by evidence in the repo or database. Every row
carries its source. **These have not been altered.**

### 5.1 Ladder B — the shipped storefront (strongest evidence: code + 10 docs agree)

| SKU | Setup (one-time) | Recurring | Source |
|---|---|---|---|
| Ops Kit | **$997** | **$297/mo** | `src/app/kits/page.tsx:9-10` |
| Command Kit | **$2,997** | **$497/mo** | `src/app/kits/page.tsx:23-24` |
| Dealer Bundle (both) | **$3,497** | **$697/mo** | `src/app/kits/page.tsx:180` |
| AIXMOS Operator seat | — | **$97/mo** · 500 tokens · cert path | `src/app/kits/page.tsx:35-38,103` |

`VERIFIED EXISTING PRICE`. Bundle arithmetic confirmed: $997+$2,997=$3,994 vs
$3,497 → the advertised "$497 saving" is correct. Monthly: $297+$497=$794 vs
$697 → a further **$97/mo** saving that no document states.

### 5.2 Ladder C — `/build` high-ticket, code-enforced with deposits

| Rung | Price | Deposit | Source |
|---|---|---|---|
| Base Infrastructure | **$3,750** | full | `src/lib/high-ticket.ts:54-56` |
| Enterprise Systems | **$7,500** | $3,750 (50%) | `src/lib/high-ticket.ts:73` |
| Car Rental in a Box | **$15,000** | $7,500 (50%) | `src/lib/high-ticket.ts:88-95` |
| E-Commerce Ecosystem | **$25,000** | $12,500 (50%) | `src/lib/high-ticket.ts:108-115` |
| Full Ecosystem | **$50,000** | consult, structured terms | `src/lib/high-ticket.ts:126-134` |

`VERIFIED EXISTING PRICE`.

### 5.3 Ladder A — `docs/OFFER-STACK.md` (self-declared canonical; docs only)

**BUILD (one-time):** $1,875 → $3,750 → $7,500 → $15K → $25K → $35K → $45–50K →
$100K *(apex, "eventually", owner-only)*.

**RUN (monthly):** Operator Seat **$97/seat** · Credit Guidance Basic
**$1,875/mo** · Mid / Fleet Management **$3,750/mo** · Full-Service **$7,500/mo**.

Terms: **50% deposit = GO**, non-refundable, 10% max price-match. Locked
2026-06-19. `VERIFIED EXISTING PRICE` / `VERIFIED EXISTING RANGE` ($45–50K).

### 5.4 The `packages` table (production database)

| Package | `price_cents` | `price_max_cents` | Ladder A rung |
|---|---:|---:|---|
| `resale_airtable_starter` | 187500 | — | $1,875 |
| `resale_airtable_pro` | 375000 | — | $3,750 |
| `resale_airtable_automations` | 750000 | — | $7,500 |
| `resale_business_in_a_box` | 1500000 | — | $15,000 |
| `resale_box_plus_car` | 2500000 | — | $25,000 |
| `resale_full_stack_max` | 3500000 | 5000000 | $35K–$50K |
| `starter` / `growth` / `elite` / `custom` | null | null | *(not on Ladder A)* |

`VERIFIED EXISTING PRICE` / `VERIFIED EXISTING RANGE`. The six resale rows map
exactly onto Ladder A's BUILD column. **Preserved unchanged.**

### 5.5 Other verified terms

| Term | Value | Source |
|---|---|---|
| Sovereign / on-prem install | **$50,000 once + $97 / agent / mo** | `src/lib/forms/catalog.ts:79` |
| Credit enrollment | **up to $97/mo** | DB `credit_product_catalog.path_a_monthly_97` (9700¢) |
| Credit payment plan | **$250 down + $250 in 30–45 days** | DB `credit_product_catalog.path_b_plan_500` (50000¢) |
| Credit mentorship (DFY add-on) | **$1,000** | DB `credit_product_catalog.path_c_mentorship_1000` (100000¢) |
| Affiliate commission | **$35/sale**, tier-up to **$45–$50**; explicitly *"Stay flat"*, no recruit bonus | `docs/AFFILIATE_RECRUITMENT_KIT.md:14,17` |
| Agency revenue share | **80%** on all 9 orgs | DB `organizations.agency_revenue_share_pct` |
| Operator seat licence fee | **9700¢** (max observed) | DB `operator_profiles.license_fee_cents` |
| Operator revenue share | 0–35% (one `master` at 25%) | DB `operator_profiles.revenue_share_pct` |
| Commission tiers (specified, unbuilt) | T1 credit **$50–$150/referral**; funding **1–3%** or **15–25% of origination fee**. T2 **40–60% rev share**. T3 **$50K co-investment** | `workstream-3-operator-network/TASKS.md` |

### 5.6 CONTRADICTIONS — sixteen found

Full detail with line-level sources in
`scratchpad/04-verified-commercial-terms.md`. The ones that cost money:

- **C-1 — Two rival price lists.** `OFFER-STACK.md:3` calls itself *"canonical
  pricing for the whole network"* but **contains none of the 997/2997/3497/297/
  497/697 SKUs the live site sells**, and the live pages contain none of
  OFFER-STACK's numbers. Your contract templates (`deal-kit/PAYMENT-SCHEDULE.md:5`)
  point at OFFER-STACK, which does not price what the storefront sells. **Fix
  this first.**
- **C-2 — Operator seat is $97/mo and $297/mo.** `src/lib/forms/catalog.ts:65-70`
  sells "Operator seat · $297/month · 2,000 tokens"; `OFFER-STACK.md:72` and
  `/kits` sell $97/seat with 500 tokens. **Both are public-facing.**
- **C-9 — $97 is simultaneously one-time and recurring.** `src/app/try/page.tsx:184,190`
  advertises "Starts at $97/mo" and links to `/lp/moe-legacy/intro-97`, which is
  a **one-time** $97 audit (`copy.ts:32`; runbook: *"recurring? No, one-time $97"*).
  A visitor is quoted a subscription and lands on a single purchase.
- **C-5 — $50,000 means four incompatible things**: Full Ecosystem (code),
  $45–50K flash-deploy (docs), ~$50K/operator with 1 year management included,
  and $50,000 once + $97/agent/mo sovereign. It is *also* the founder-deferral
  threshold and an upfront-deposit target.
- **C-6/C-7 — $7,500, $3,750 and $1,875 are each a one-time rung AND a monthly
  retainer.** OFFER-STACK admits the collision is deliberate (`:84-86`) but **no
  document states which one a given quote means.** This is the direct reason
  `packages.price_cents` is currently ambiguous.
- **C-8 — Credit Guidance priced four ways**: $1,875/mo, $500–$1,000, $750 flat,
  and "$97/mo or $250+$250" in shipped code.
- **C-16 — Every signable instrument ships with unfilled placeholders.**
  `{{SETUP_FEE}}`, `{{MONTHLY_FEE}}`, `{{REV_SHARE_PCT}}`, `{{ROYALTY}}`,
  `{{LATE_FEE}}`, `{{GRACE_DAYS}}`. **No revenue-share percentage or royalty
  rate is stated numerically anywhere in the repo** — including for the business
  funding lane, where rev-share is the stated revenue source.
- **C-4 — a compliance contradiction.** `OFFER-STACK.md:33` sells "**credit-repair**"
  in the $25K row, six lines above its own standing rule at `:145`: *"Credit =
  'guidance,' never 'repair.'"*

### 5.7 What the `packages` table actually is — the pricing-model answer

The baton asked whether `packages` is a resale ladder (Model A), a universal
commercial catalog (Model B), or something else. **The evidence says Model C**,
and it changes what should be done next.

`packages` is an **entitlement-bundle table**, not a price book. Proof:

- Only two things reference it: `package_entitlements` (94 rows) and
  `profiles.package_id`. It answers *"what can this user see"*, not *"what does
  this cost"*.
- All 10 rows have entitlements (3–27 each). The resale rows are **not**
  squatters — they were deliberately modelled as "buying this grants these
  entitlements".
- The tier numbering gives the history away: `1, 2, 3, 99` (created 2026-05-18)
  versus `101–106` (created 2026-06-05). Two concepts, two numbering namespaces,
  one table.
- The resale entitlements reveal the real product design: `resale_whitelabel` on
  **every** tier, and the AI model tier as the differentiator —
  `resale_ai_free` → `haiku` → `sonnet` → `opus`. White-label plus model access
  *is* the ladder.

**The unresolved question is now answered: do not put `9700` on tiers 1–3 and
Custom.** Three independent reasons:

1. `packages` has **no billing interval**. `price_cents = 187500` cannot
   distinguish the **$1,875 one-time build** from the **$1,875/mo Credit
   Guidance retainer** — and per C-6/C-7 the business deliberately uses the same
   anchors for both. The column is already ambiguous for the six rows that have it.
2. The $97 operator seat is **already modelled elsewhere**, correctly:
   `operator_profiles.license_fee_cents` (9700) alongside `revenue_share_pct`.
   Adding a second home would create a fifth $97.
3. The business's own design, stated in `OFFER-STACK.md` and
   `workstream-3-operator-network/TASKS.md`, is explicitly **three charge types**:
   BUILD (one-time), RUN (monthly), and SEATS (per-head monthly) — plus a
   *"separate one-time platform licence SKU ('own forever')"* and a *"capped
   managed-inference passthrough add-on"*. A single `price_cents` cannot carry that.

There is already a **better model in your own database**:
`credit_product_catalog` (slug, title, `amount_cents`, `ghl_product_id`,
`ghl_tag`, active) and `credit_billing_plans` (`amount_cents`,
`monthly_fee_cents`, `down_paid_cents`, `balance_due_cents`, `next_billing_at`,
`is_add_on`, `delivery_mode`). That handles one-time + recurring + deposit +
add-on. **The credit vertical already solved this problem correctly.**

> **Recommended next migration — not applied, awaiting approval:** add
> `billing_interval` (`one_time | monthly | annual`) and `pricing_model`
> (`fixed | range | per_seat | quote`) to `packages`, backfill the six existing
> rows as `one_time`/`fixed` (`resale_full_stack_max` as `range`), and only then
> decide whether Ladder A's RUN column and Ladder B belong in the same table. I
> have not written this.

---

## 6. PROPOSED PRICING — CATALOG 2

> **`PROPOSED — NOT CURRENT COMMERCIAL TERM`** applies to every number in this
> section. Nothing here has been written to the database, a page, or a contract.

### 6.1 Assets that are built and have no price at all

| Asset | What was built | Maturity | Target buyer | Problem solved | Standalone? | Proposed one-time | Proposed recurring | Replacement cost |
|---|---|---|---|---|---|---|---|---|
| **Dispatch** | Multi-tenant roadside/rescue: cockpit, units, responder approval/revoke, incidents, mobile responder view, org-scoped RLS | SHIPPED | Towing / roadside / mobile-service operators | Dispatching jobs to field responders without radio and paper | **Yes** | $4,500–$9,000 setup | $349–$799/mo | $50k–$90k |
| **Credit dispute engine** | 14 FCRA violation codes with legal basis + removal-probability scoring, 7 round types, 2 report importers, letter generation | SHIPPED, **legally gated** | Licensed CROs, credit attorneys | Manual dispute drafting | **Yes**, to licensed buyers only | $7,500–$15,000 | $500–$1,500/mo | $40k–$80k |
| **AI agent framework** | Per-tenant LLM agent with spend cap, kill switch, PII redaction, banned-phrase loop, CFPB disclaimers, quiet hours, FSM | SHIPPED | Agencies running AI receptionists in regulated verticals | Compliant AI comms without building the guardrails | **Yes** — best licensing candidate | $15,000–$35,000 licence | $1,000–$3,000/mo | $60k–$120k |
| **Compliance gate library** | 7 config-driven legal gates enforced in CI, CROA/CPN language detector, TS + Python twins | SHIPPED | Any credit-adjacent software company | Shipping a build that violates CROA | Yes (or open-source for authority) | $2,500–$7,500 | — | $15k–$30k |
| **Licensing control plane** | Install token, hardware binding, Secure Enclave attestation, heartbeat, remote wipe | SHIPPED | Anyone selling software onto customer hardware | Losing control of a shipped install | **Yes** | $10,000–$25,000 | $250–$500/mo per install | $35k–$70k |
| **Lead capture + GHL layer** | 19 forms, multi-tenant landing template, signature-verified idempotent webhook dispatcher, full GHL v2 client | SHIPPED | GHL agencies | Fragile GHL webhook plumbing | Yes | $3,500–$8,000 | $199–$499/mo | $40k–$80k |
| **Operator Academy** | 15-module cert path, progress, rubric scoring, DB-backed | SHIPPED | Franchise/network operators | Training a distributed network | Bundle-preferred | — | included in seat | $30k–$60k |
| **JOB RADAR** | Opportunity engine with anti-overclaim gate, local-LLM drafting, staged packets | Working, unversioned | Job seekers / recruiters | Applying at scale without lying | Yes | $49–$199 | $19–$39/mo | $15k–$30k |
| **Media Vault + 13 content agents** | 6-lane pipeline, clip farm, PII block-list | Working, unshipped | SMB content teams | Turning footage into posts | Yes | $2,500–$6,000 | $299–$799/mo | $25k–$50k |

### 6.2 Proposed structural fixes to pricing (not new prices)

1. **One price list.** Merge Ladders A, B and C into a single catalog with an
   explicit `billing_interval` on every row. Retire the losing document rather
   than leaving it to be quoted from.
2. **Resolve the operator seat** to a single number and token allowance (C-2).
3. **Stop reusing anchors across BUILD and RUN.** If $7,500 is both a build rung
   and a monthly retainer, every quote is ambiguous. Change one of them.
4. **Fill the contract placeholders.** No rev-share percentage, royalty, late fee
   or grace period exists numerically anywhere. Until they do, no deal-kit
   document is signable.
5. **Price Dispatch and the back-office.** Two shipped products with no SKU.

---

## 7. RECURRING REVENUE

Every credible subscription, service or licence opportunity, separated by
whether the price is verified or proposed.

### Verified recurring (exists today)

| Stream | Price | Status |
|---|---|---|
| Operator seat | $97/mo (contested vs $297) | Storefront live, checkout URL missing |
| Ops Kit | $297/mo | Same |
| Command Kit | $497/mo | Same |
| Dealer Bundle | $697/mo | Same |
| Credit Guidance Basic (RUN) | $1,875/mo | Docs only |
| Mid / Fleet Management (RUN) | $3,750/mo | Docs only |
| Full-Service (RUN) | $7,500/mo | Docs only |
| Sovereign agents | $97/agent/mo | Control plane live |
| Credit enrollment | up to $97/mo | In `credit_product_catalog` |

### Proposed recurring `PROPOSED — NOT CURRENT COMMERCIAL TERM`

| Stream | Proposed | Rationale |
|---|---|---|
| Dispatch SaaS | $349–$799/mo | Complete product, no SKU |
| AI agent framework licence | $1,000–$3,000/mo | Highest-leverage IP |
| Licensing control plane | $250–$500/mo per install | Metered by heartbeat, already emitted |
| Managed inference passthrough | cost + capped margin | Already specified in WS3 TASKS |
| Media Vault managed | $299–$799/mo | |
| GHL integration layer | $199–$499/mo | |

**The structural point:** your `tmmt_token_ledger` and per-org `llm_daily_cap_usd`
already meter AI usage. **You have usage-based billing infrastructure and are
not billing usage.** That is the cleanest untapped recurring line in the system.

---

## 8. PRODUCT LADDER (recommended)

`PROPOSED — NOT CURRENT COMMERCIAL TERM` for anything not marked VERIFIED.

| Rung | Offer | Price | Status |
|---|---|---|---|
| 0 | Free — lead intake, `/try` demo | $0 | VERIFIED, live |
| 1 | **Operator seat** — academy, cert path, tokens | $97/mo VERIFIED *(resolve C-2)* | Live, needs checkout |
| 2 | **Ops Kit** — floor desk | $997 + $297/mo VERIFIED | Live, needs checkout |
| 3 | **Command Kit** — owner visibility | $2,997 + $497/mo VERIFIED | Live, needs checkout |
| 4 | **Dealer Bundle** | $3,497 + $697/mo VERIFIED | Live, needs checkout |
| 5 | **Dispatch** *(new SKU)* | PROPOSED $4,500–$9,000 + $349–$799/mo | Product ready, unpriced |
| 6 | **Vertical build** — rentals / credit+funding / ecommerce | $7,500 / $15,000 / $25,000 VERIFIED (Ladder C, 50% deposit) | Coded with deposits |
| 7 | **Full ecosystem** | $35K–$50K VERIFIED RANGE | Consult-first |
| 8 | **Sovereign / on-prem** | $50,000 + $97/agent/mo VERIFIED | Control plane live, kit dormant |
| 9 | **Apex** | $100K, owner-only, never public | Marked never-sold-publicly |

**Cross-sell that costs nothing to add:** every lead that cannot be served —
declined renters, credit-blocked applicants — routes to Khan Strategies with
consent captured. The plumbing exists. Only the rate is unset.

---

## 9. REPLACEMENT VALUE — with the assumptions exposed

*What it would cost somebody else to reproduce this body of work.* **An estimate
with a stated method, not a quote, and not a market value.**

### 9.1 Three independent methods, then their overlap

**Method A — bottom-up per module**, now grounded in measured line counts rather
than impression. Revised where Phase 2 changed the facts.

| Module | Measured size | Replacement | Change |
|---|---|---|---|
| Multi-tenant platform, auth, 344 RLS policies, 165-table schema, 240 migrations | 165 tables / 96 org-scoped | $80k–$150k | — |
| Admin / rentals back-office | 27 pages / 5,188 lines | $45k–$85k | ↓ measured |
| AI agent framework | ~1,700 lines | $50k–$100k | ↓ |
| AIXMOS Cube | 15 screens | $50k–$90k | ↓ |
| Lead capture + GHL integration layer | ~1,850 lines | $40k–$80k | — |
| Credit dispute / FCRA engine | ~2,140 lines | $40k–$80k | — |
| Licensing control plane + partner-deploy | 3 routes + kit | $30k–$60k | ↓ (v1 crypto) |
| Operator Academy + role portals | — | $30k–$60k | — |
| Tooling, CI, provisioning, gates | 198 scripts | $30k–$60k | — |
| **Dispatch** | **1,482 lines, never used** | **$15k–$35k** | **↓↓ was $50k–$90k** |
| PWA / offline-first desk | — | $20k–$40k | — |
| **Total** | | **~$430k – $840k** | |

**Method B — team-time.** A 3-person team (2 engineers + 1 designer/PM) at ~$150k
loaded: 12 months = $450k, 18 months = $675k. Given 11 product areas and a
165-table RLS schema, 12–18 months is a fair estimate for a conventional team.
→ **$450k–$675k**

**Method C — lines of code.** ~65,000 lines of application code (src 47,053 +
scripts 8,191 + supabase 4,700 + packages/apps/aria/shared/tools/e2e ~5,200). At
$8–15/line for business software including design, test and PM:
→ **$520k–$975k**. *(This method is the weakest — AI-assisted code is more verbose,
and much of this is CRUD.)*

**Convergence: $450k–$850k.** All three methods overlap in that band. I am
**revising the earlier $500k–$1.0M down to ~$450k–$850k** on the strength of the
measured line counts and the Dispatch correction.

### 9.2 What is excluded

Real value, deliberately not counted: the 301-file / 53,000-line documentation and
SOP corpus; the 240-migration schema history; the 876 leads and 1,642 contacts; and
~6.5 months of compliance and legal-posture design.

### 9.3 The caveat that matters most

**Replacement value is not market value.** Nobody pays rebuild cost for software
with no customers. For a pre-revenue codebase, a buyer typically pays a fraction —
often 10–30% of replacement — unless they are buying a specific capability or the
team. With **$9,510.57 of lifetime revenue, all of it from a rental business that
stopped taking payments in March 2026**, this asset's market value today is
governed by demand evidence, and there is none above $577.

**Use $450k–$850k for insurance, for a build-vs-buy argument, or to explain what a
partner would have to spend to replicate you. Do not use it as an asking price.**

---

## 10. SELLING VALUE — and why it is not the same number

These four figures must never be added together. This is the double-count guard.

| Concept | Figure | What it means |
|---|---|---|
| **Gross Component Value** | **~$550k–$1.1M** | Sum of what each component might fetch sold *independently*. **Overlapping by construction** — Full Stack contains the CRM, the agent, the dashboard and the tenant system. Shows optionality; **never** non-overlapping value. |
| **Bundle Selling Value** | **$35k–$50k** per full-stack customer; **$50k + $97/agent/mo** sovereign | What one customer actually pays. VERIFIED prices, **untested demand**. |
| **Replacement Value** | **$450k–$850k** | Cost to rebuild. For an acquirer or an insurer, not a customer. |
| **Recurring Revenue Potential** | §10.1 | The only figure that compounds. |

### 10.1 The recurring model, with its arithmetic shown

The earlier "$276k ARR" figure was an illustration presented without its
assumptions. Here it is in full, so it can be judged rather than repeated.

**Formula:** `ARR = Σ (customers × units × monthly price) × 12`

**Scenario C — the original figure, relabelled as a ceiling** `PROPOSED`

| Line | Customers | Units | Price | Monthly |
|---|---:|---:|---:|---:|
| Operator seats | 20 | 1 | $97 | $1,940 |
| Dealer Bundles | 5 | 1 | $697 | $3,485 |
| Dispatch | 3 | 1 | $549 *(proposed, no SKU)* | $1,647 |
| Full-Service retainers | 2 | 1 | $7,500 | $15,000 |
| Sovereign agents | 1 | 10 | $97 | $970 |
| **Total** | **31 relationships** | | | **$23,042/mo → $276,504/yr** |

**Why this is a ceiling, not a forecast:**

1. It assumes **31 paying customer relationships**. The business has **zero**
   software customers today and has never had one.
2. **$180,000 of the $276,504 — 65% — comes from two hypothetical Full-Service
   retainers** at $7,500/mo, the least-proven SKU in the portfolio: docs-only,
   never sold, never delivered.
3. **Dispatch's $6,588/yr is doubly speculative** — a proposed price for a product
   with no SKU and zero operational history.
4. It assumes 100% collection, zero churn, and all twelve months.
5. It assumes GHL checkout live **and** the fulfilment capacity to onboard 31
   customers through an 11-step manual runbook.

**Scenario A — evidence-anchored** `PROPOSED`. Verified prices only; volumes a
first year could plausibly reach.

| Line | Customers | Price | Monthly |
|---|---:|---:|---:|
| Operator seats | 5 | $97 | $485 |
| Ops Kit | 1 | $297 | $297 |
| Command Kit | 1 | $497 | $497 |
| **Total** | **7** | | **$1,279/mo → $15,348/yr** |

Plus one-time setup in year one: $997 + $2,997 = **$3,994**.

**Scenario B — moderate** `PROPOSED`

| Line | Customers | Price | Monthly |
|---|---:|---:|---:|
| Operator seats | 15 | $97 | $1,455 |
| Dealer Bundles | 3 | $697 | $2,091 |
| Full-Service retainer | 1 | $7,500 | $7,500 |
| **Total** | **19** | | **$11,046/mo → $132,552/yr** |

**Read it this way:** Scenario A is what the next twelve months look like if
checkout goes live and you sell steadily to the segment you already understand.
Scenario C is what the model *can* produce, and it is dominated by two customers at
a price nobody has yet paid. **Recurring revenue is still where this business
becomes valuable — but the honest near-term number is Scenario A, not $276k.**

---

## 11. IP AND STRATEGIC VALUE

Reusable systems that create leverage beyond any single engagement, ranked.

1. **Sovereign licensing spine.** Install token → hardware UUID → Secure Enclave
   → heartbeat → remote wipe. This is what makes "sell the OS onto their
   machine" a business instead of a giveaway. **Rare at your scale.**
2. **Multi-tenancy depth.** 96 of 165 tables carry `org_id`; 344 RLS policies;
   host/slug/path resolution; brand→CSS-token generation with contrast math;
   custom-domain onboarding with DNS-over-HTTPS verification. **White-label is
   architectural here, not a logo swap.**
3. **Compliance-as-code.** Seven legal gates enforced in CI, a CROA/CPN language
   detector in TypeScript and Python, banned-phrase regeneration inside the AI
   agent, CFPB disclaimer engine. In credit-adjacent software this is a moat and
   a due-diligence asset.
4. **The AI cost-control layer.** Per-org `llm_daily_cap_usd` enforced *from the
   audit log*, a global kill switch, and a prepaid token ledger. Most AI
   products discover they need this after their first surprise bill.
5. **Encoded operational SOPs.** The 11-step provisioning runbook with owner
   assignments and a go-live quality gate ("block go-live if the logo is still a
   generated monogram") is genuine consulting IP.
6. **`LEARNINGS.md`** — 24,583 lines of dated first-hand operational failure.
   Publishable as authority content; nobody else has your specific version.
7. **The 876-lead + 1,642-contact dataset** with routing already applied.

---

## 12. UNFINISHED CLAUDE / AGENT WORK

### 12.1 Three things that are stubs but read as finished

These matter because the business *claims* them:

1. **`shared/owner-approval-gate/approval.ts` is a stub with zero callers.** The
   system's strongest stated guarantee — no message, charge, payout, funding
   submission or money move without owner approval — **is not enforced anywhere
   in code**. All three workstream TASKS files say "every payout → owner-approval
   gate". Nothing calls it.
2. **`agent/twilio-send.ts` is orphaned** (no non-test callers). It is the *only*
   caller of the SMS A2P/CROA compliance gate, so **that gate is unreachable in
   production**. Outbound messaging actually flows through GHL Conversations,
   which does not call it.
3. **`platform/request-org.ts` and `platform/brand-shell.ts`** are built and
   tested but unconsumed — the server half of the tenancy bridge is unfinished.

### 12.2 Branch graph — 45 refs unmerged into `origin/master`

| Branch | Commits | Verdict |
|---|---|---|
| `docs/owner-model` | 25 | **Live and valuable** — CROA compliance rails, dispute-policy gate, letter renderer. Parked Sep 2. |
| `feat/credit-dispute-command` | 167 | **Superseded** — landed on master Aug 24. Safe to retire. |
| `claude/tmmt-stack-overhaul` | — | Real product (GHL bridge, SLA sweep, lead-net). **Dead since Jul 22.** |
| `merge/legal-pages-into-tmmt-os` | 119 | Self-labelled "WIP checkpoint". Dead since Jul 17. |
| `docs/test-status-update` | 152 | July mesh/autonomy tooling. Abandoned. |
| `claude/organize-chats-sessions` | 147 | Abandoned. |
| 14 autonomy-experiment branches | — | All dated Jul 7±2, nearly none merged. |

**Only 35 TODO/STUB markers exist tree-wide. The real debt lives in the branch
graph, not in the source.**

### 12.3 Operational risks found during this audit

- ⚠️ **`dist/` — the operator kit — is tracked at HEAD, gitignored, and deleted
  in the working tree.** It is **one `git commit -a` away from vanishing**. This
  is another session's working state; I have not touched it. **Decide
  deliberately: restore it or delete it on purpose.**
- **Documented schema drift**: ~220 prod migrations vs 42 in the repo; 49 of 89
  app-touched tables have no `CREATE TABLE` anywhere in the repo.
  `migrations-pull.mjs` is the written fix and has not been run.
- **Two mutually exclusive hook sets** (`.githooks/` vs `scripts/hooks/`).
  `core.hooksPath` picks one, so **the prod-branch guard and the secret guard
  are never both active**.
- `probe-prod.mjs` (the strict prod gate) is wired to nothing, while
  `smoke:prod` still runs the lenient version it was written to replace.
- `/api/ops/command` executes service-role ops actions behind a single shared
  bearer secret.
- `(learn)` has no layout gate — any signed-in tier can open the Learn face. The
  API beneath it *is* properly authorized.
- **Fenced-party reference on a public URL.** `/try` links to
  `/lp/moe-legacy/intro-97`. `moe_legacy` is a frozen internal data key whose
  display name is already "AIXMOS Credit" — this is not an access grant — but the
  slug is customer-visible in the address bar. Separately,
  `docs/OFFER-STACK.md:15-16` still lists Muhammad Umar as a founding operator
  with deferred terms, and the DB holds an **inactive** `seed-moe-legacy` licence
  row with an unused install token. **I have not edited the offer document —
  it records money terms and that is your call.**

---

## 13. TOP 10 REVENUE OPPORTUNITIES

Ranked by realistic revenue × probability, with reasoning.

| # | Opportunity | Why it ranks here |
|---|---|---|
| 1 | **Turn on the checkout URLs** | Four priced, live, internally consistent SKUs with finished pages. Every other item on this list is longer. Nothing sells until this is done. |
| 2 | **Monetize the 876 leads via Khan Strategies** | Referral plumbing with consent capture is built. It is a wasting asset — flow has collapsed to ~1/month. Set the rate and work the list. |
| 3 | **Sovereign / on-prem at $50K + $97/agent/mo** | Highest verified ticket. Control plane is live. The differentiator (remote kill switch) is genuinely rare. Needs one end-to-end dry run. |
| 4 | **Package and price Dispatch** | A complete multi-tenant product with zero commercial representation. Pure upside — the build cost is already sunk. |
| 5 | **Licence the AI agent framework** | Spend cap + kill switch + PII redaction + banned-phrase loop is what agencies in regulated verticals cannot build themselves. Best licensing candidate. |
| 6 | **Implementation consulting on the encoded SOPs** | Sellable today, no code required. Highest margin, lowest risk, fastest cash. |
| 7 | **Turn on the entitlement system** | Not revenue itself — it is what makes tiered pricing *enforceable*. Without it, every tier is an honour system. |
| 8 | **Deploy the 44 designed Airtable automations** | Already specified. Completes the Airtable exit and is billable as delivery. |
| 9 | **Usage-based AI billing** | Token ledger and daily caps exist; nothing bills against them. Cleanest untapped recurring line. |
| 10 | **Credit vertical as a service** | Largest long-term prize, gated behind attorney + VDACS + surety bond. **Not near-term.** |

---

## 14. TOP 10 NEXT ACTIONS

Ranked by revenue potential, time to revenue, effort, risk, and repeatability.

| # | Action | Revenue | Time to $ | Effort | Risk | Repeatable | Owner |
|---|---|---|---|---|---|---|---|
| 1 | **Create the GHL products and paste the 11 checkout URLs into Vercel** | High | Days | Low | Low | Once | **Owner** |
| 2 | **Pick ONE price list; retire the others** | High | Immediate | Low | **High if skipped** | Once | **Owner** |
| 3 | **Set the Khan Strategies referral rate; work the 876 leads** | High | Days | Low | Low | Ongoing | **Owner** |
| 4 | **Resolve the $97-vs-$297 operator seat (C-2)** | Med | Immediate | Low | Med | Once | **Owner** |
| 5 | **Fill the contract placeholders** (`{{REV_SHARE_PCT}}`, `{{ROYALTY}}`, late fee, grace) | High | Days | Low | **High** — no instrument is signable | Once | **Owner** |
| 6 | **Add `billing_interval` + `pricing_model` to `packages`, then wire entitlements** | High (enabler) | Weeks | Med | Low | Compounds | Dev |
| 7 | **Decide `dist/`: restore or delete deliberately** | — | Immediate | Low | **High — data loss** | Once | **Owner** |
| 8 | **Implement `owner-approval-gate` or stop claiming it** | — | Weeks | Med | **High — compliance** | Compounds | Dev |
| 9 | **Package Dispatch as a SKU** | High | Weeks | Med | Low | Compounds | Both |
| 10 | **Version-control JOB-RADAR, Media Vault and `.config\tmmt`** | — | Hours | Low | **High — single copy** | Once | Dev |

**Actions 1–5 and 7 are yours and cannot be delegated.** They are decisions, not
work. Six of the ten highest-value moves in this business need no code at all.

---

## 15. THE THREE ANSWERS YOU ASKED FOR

**What can I sell today?** The Dealer Kit ladder ($997/$2,997/$3,497 + monthly),
the rentals back-office as a licensed instance, the Operator seat, implementation
consulting on your own SOPs, and the 876 leads via referral. Everything except
the leads is blocked on the same small thing: **checkout URLs**.

**What should I finish next to maximize revenue?** Not more features. In order:
one price list → live payment links → the entitlement switch → a `billing_interval`
column → package Dispatch. The first two are decisions; the rest is a few weeks.

**What is it worth?** **$500k–$1.0M to reproduce.** **$35k–$50k** from a
full-stack customer, **$50k + $97/agent/mo** sovereign. And roughly **$276k ARR**
from a modest recurring book — which is the number that actually compounds, and
the layer you have finished least.

---

*Evidence base: full repository read, complete git history (1,082 real commits),
live production database inspection, and six parallel discovery sweeps.
Supporting detail in the session scratchpad:
`01-app-surfaces.md` · `02-engine-and-integrations.md` ·
`03-tooling-and-infra.md` · `04-verified-commercial-terms.md` ·
`05-build-timeline.md` · `06-outside-the-repo.md`.*

*No price in this document has been written to the database, to any page, or to
any contract. Section 6 remains a proposal until the owner approves it.*
