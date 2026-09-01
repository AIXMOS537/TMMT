# 02 — Current State Audit

**Audited:** 2026-09-01, live systems, read-only.
**Purpose:** stop Claude Code from rebuilding what already runs, and surface what is
actually broken or missing.

---

## 0. Headline findings

1. **~70% of the vision is already built.** The rental side is in production with real
   customers. Treat this as brownfield.
2. **There are three systems of record and no declared winner.** Airtable, Supabase,
   and GoHighLevel all hold people and pipeline data. This is the #1 architectural risk.
3. **The investor/owner side is the real gap.** Owner payouts cannot be calculated today.
4. **The progression pipeline is fully scaffolded but dormant — and has no active
   partner.** The only credit partner record is deactivated. Pathway 2 is blocked on a
   business decision, not on code.
5. **Business rules the vision doc calls "undefined" are already seeded in production.**
   Pricing, deposits, insurance products, and credit paths all have live values that
   have never been confirmed as real.
6. **Two compliance issues need attention before anything else ships.** See §7.

---

## 1. Deployed inventory

### Supabase — primary application backend
`uapxakmlwnpfsftfeezx` · us-west-2 · Postgres 17 · **~170 tables in `public`** · RLS
enabled on all of them.

Live row counts worth knowing:

| Table | Rows | Note |
|-------|------|------|
| `incoming_leads` | 875 | The rental funnel |
| `ghl_contacts` | 1,642 | Mirrored from GoHighLevel |
| `people` | 1,209 | A *third* person store |
| `intake_events` | 875 | Mirrors leads |
| `exec_va_tasks` | **17,192** | Auto-generated VA task queue |
| `fleet` | 43 | Vehicles |
| `active_customers` | 35 | 16 Active / 19 Removed |
| `background_checks` | 299 | Contains consumer-report data |
| `tickets` | 308 | Citations/violations |
| `waitlist` | 104 | |
| `operator_profiles` | 19 | Against a 100 cap |
| `operator_training_progress` | 120 | |
| `coo_briefings` | 55 | |
| `contracts` | 2 | vs. 16 active renters — **contracts are not being recorded** |
| `customer_payments` | 31 | |
| `memory_facts` / `memory_events` | 57 / 11 | "Memory fabric" layer |

A second Supabase project exists — **`moe-legacy`** (`renmvevnrjptjeqwrdtr`, us-west-1).
Its read-only credentials currently fail authentication, so its contents could not be
audited. `[OPEN]` — is this project still in scope? The associated partner record in
the main database is deactivated.

### Airtable — staff operations surface
Base `appcenWUju039rD7b` · **30 tables**.

Operational core: `Incoming Leads`, `Background Checks`, `Waitlist`, `Appointments`,
`Fleet`, `Vehicle Handover`, `Active Customers`, `Customer Payments`, `Insurance`,
`Tickets`, `Expenses`, `Fleet Car Inspections`, `Customer Inspection Photos`,
`Shops/Mechanics/Cleaning`, `Employee Access Rights`, `Maintenance Appointments`,
`Do Not Rent List`, `Operation Costs`, `Contracts`, `Vehicle Onboarding Inspections`,
`Former Customers`, `🔄 Change & Update Log`, `Client Accounts`, `Content Pipeline`,
`Money Command — Bills & Subscriptions`, `TMMT Operator Signups`, plus four
`OO – *` tables for Operation Overdrive.

`Incoming Leads` already carries GHL↔TMMT sync fields: `GHL Contact ID`,
`GHL Opportunity ID`, `GHL Pipeline`, `GHL Stage`, `Canonical Stage`, `Sync Status`,
`Verified`, `Last Synced At`.

### GoHighLevel — CRM / marketing / phone
1,642 contacts mirrored into Supabase. Public phone layer. `[OPEN]` Agency plan tier
and SaaS-mode status still unconfirmed.

### Vercel — team `AIXMOS PROJECTS` (hobby plan)

| Project | Git link |
|---------|----------|
| `tmmt-ops` | GitHub `AIXMOS537/TMMT` |
| `tmmt-command-center` | — |
| `aixmos-landing` | — |
| `aixmos-offer` | — |
| `tmmt-training-site` | — |

Plus `tmmt-operators.pages.dev` (Cloudflare) feeding the Airtable
`TMMT Operator Signups` table.

> ⚠️ The whole production platform is on a **hobby-tier** Vercel account. That is a
> availability and support risk for a system holding live customer operations.

---

## 2. Blueprint → reality map

| Blueprint section | Status | Evidence |
|---|---|---|
| Rental funnel (§4.1) | ✅ Production | `incoming_leads` 875, `background_checks` 299, `active_customers` 35 |
| Vehicle records (§5.1) | ✅ Production | `fleet` 43, inspections, handover, maintenance, expenses all present |
| Qualification & verification | 🟡 Partial | Status fields exist per check; no unified decision record, no reason codes |
| Vehicle matching | 🟡 Partial | `waitlist` + availability exist; matching is manual |
| Contracts & signature | 🔴 Broken in practice | `contracts` = 2 rows vs 16 active renters |
| Payments | 🟡 Partial | `customer_payments` 31 rows; `payments`/`bookings` tables exist but empty |
| **Not-qualified pathway (§4.2)** | 🟡 Scaffolded, dormant | `programs` 7, `journey_checkpoints` 8, `client_journey` 2, `program_applications` 0, `partner_referrals` 0 |
| **Credit improvement (§4.3)** | 🔴 Blocked | `credit_product_catalog` 3 products; `credit_enrollments` 0; **only partner is deactivated** |
| Business formation / funding | 🔴 Not modeled | No LLC-formation or funding-application entity anywhere |
| **Investor / owner side (§4.4)** | 🔴 Largest gap | See §4 below |
| Operator network | 🟡 Partial | `operator_profiles` 19, rubric scores 1, training modules 15, pipeline tracker 4 |
| Partner management (§5.3) | 🔴 Thin | `partners` table = 1 row, deactivated |
| Documents (§11) | 🔴 Split & unsafe | `documents` table 0 rows; real documents live as Airtable attachments |
| Lead attribution (§13) | ✅ Built | `source`, `utm_*`, `referrer_url`, `affiliate_code` all on `incoming_leads` |
| Communication log (§9) | 🟡 Partial | `comm_channels` 4, `outreach_touches` 0, `do_not_contact_numbers` 10 |
| Dashboards (§7) | 🟡 Partial | Admin/ops surfaces exist; **no investor dashboard**; customer surface partial |
| Automation (§9) | 🟡 Overbuilt in one place | `exec_va_tasks` at 17,192 rows against 16 active customers |

---

## 3. Risk #1 — three systems of record

The same person can exist as: an Airtable `Incoming Leads` row, a Supabase
`incoming_leads` row, a Supabase `people` row, a Supabase `ghl_contacts` row, and a
GoHighLevel contact. Sync plumbing exists (`airtable_id`, `ghl_contact_id`,
`crm_sync_records`, `sync_events`, `Sync Status`, `Verified`), but **no document
declares which system wins on conflict.**

Symptoms already visible:

- `incoming_leads.status` is **null on 759 of 875 rows** (87%). The pipeline state for
  the overwhelming majority of leads is unknown to the database.
- Airtable statuses in use are only six values — `New Lead`, `Contracting`,
  `Active customer`, `vehicle returned`, `Closed`, `Junk` — against the 17-state model
  the vision describes.
- No `disqualification_reason` field exists anywhere. **Pathway 2 has no trigger.**
  This single missing field is why the progression pipeline has no clients in it.

**`[RECOMMENDED]` first architectural decision:** declare Supabase the system of
record for entities and state; Airtable the staff *interface* onto it; GoHighLevel the
*communication and marketing* layer only. Then make the sync one-directional per field
and write it down. This is a decision, not a refactor, and everything else depends on it.

---

## 4. Risk #2 — the investor side cannot pay anyone

The vision's entire section 3 (vehicle management for owner-investors) currently rests on:

- `fleet.partner_name` — **free text**, 21 distinct spellings across 43 vehicles, with
  7 vehicles having no owner recorded at all, and obvious duplicates among the rest:
  `Asad` / `Asad ` · `TMMT Rentals` / `TMMT` / `Tmmt ` · `Jimmy/ Duval` /
  `Duval / Jimmy` · `Robin` appearing twice at two different splits.
- `fleet.partner_percentage` — populated on **7 of 43 vehicles** (values seen: 0.60,
  0.65, 0.70).
- `revenue_splits` — table exists, **0 rows**.
- `partner_fleet_access` — table exists, **0 rows**. Investors cannot log in and see
  their vehicles.
- `partners` — **1 row, deactivated**.
- No owner statement, payout, or settlement entity exists at all.

**Consequence:** the system cannot today calculate what an owner is owed, cannot
produce a statement, and cannot show an owner their vehicle's performance. Given that
21 of 43 vehicles are currently rented, this is money moving without a ledger behind it.

`[RECOMMENDED]` Highest-value build in the entire roadmap. It needs: a real
`vehicle_owners` entity, a foreign key from `fleet`, a per-vehicle agreement carrying
the split terms, a revenue/expense attribution rule, a statement period, and a payout
record. **`[OPEN]` The split percentages and management fee structure are the owner's
to state** — the 0.60/0.65/0.70 values in the database are unconfirmed.

---

## 5. Risk #3 — business rules already seeded, never confirmed

The vision doc says "don't assume pricing is finalized." Correct — but production
already contains specific numbers that staff and code may be acting on:

**`rental_pricing_rules` (10 active rules, org `TMMT RENTALS`)**

| Tier / match | Daily | Weekly | Deposit |
|---|---|---|---|
| economy (default) | $45 | $280 | $400 |
| mid (default) | $75 | $470 | $500 |
| luxury (default) | $150 | $950 | $1,000 |
| Tesla Model 3 (2020+) | $89 | $550 | $500 |
| Tesla Model Y (2020+) | $95 | $590 | $500 |
| BMW 3 Series (2018+) | $120 | $750 | $750 |
| Mercedes C-Class (2018+) | $125 | $780 | $750 |
| Porsche (2018+) | $220 | $1,400 | $1,500 |
| Mercedes S-Class (2018+) | $250 | $1,600 | $2,000 |
| BMW 7 Series (2018+) | $240 | $1,550 | $2,000 |

**`rental_insurance_products` (6 active)** — two coverage sources:
`tmmt_internal` (Economy/Mid/Luxury Shield at $35/$55/$95 weekly) and
`corporate_non_owner` (carrier listed as "National Fleet Underwriters", $42/$62/$110
weekly). All require background-check approval. ⚠️ *TMMT offering internal coverage vs.
placing a carrier's policy are legally very different things — see §7.*

**`credit_product_catalog` (3 active)** — Path A $97/mo · Path B $250 down + $250
within 30–45 days · Path C $1,000 done-for-you mentorship. ⚠️ *CROA restricts
collecting fees before services are performed. Legal review required.*

**`journey_checkpoints` (8, org TMMT RENTALS)** — `credit_education_acknowledged` →
`credit_enrollment_active` → `training_path_started` → `training_core_complete` →
`mentorship_dfy_active` → `day_90_good_standing` → `lto_eligible` →
`vehicle_turnover_complete`. This is Pathway 3, already modeled, with zero clients in it.

**`programs` (7 routing rules)** — keyword-based intake routing to: rideshare rental,
credit building, lease-to-own, detailing, operator program, partner/JV fleet, general.

**`packages` (10)** — Starter/Growth/Elite/Custom plus a resale ladder from $1,875 to
$35–50k.

Every one of these is `[OPEN]` until the owner confirms it reflects real commercial
terms. Do not treat any of it as approved.

---

## 6. Data quality issues

| Issue | Where | Impact |
|---|---|---|
| 87% of leads have null status | `incoming_leads` | Pipeline reporting is not trustworthy |
| No disqualification reason field | everywhere | Pathway 2 cannot be triggered |
| Owner names as free text with duplicates | `fleet.partner_name` | Owner reporting impossible |
| Contracts recorded for 2 of 16 active renters | `contracts` | No contract of record for most rentals |
| Phone stored as a *number* type | Airtable `Incoming Leads.phone` | Leading zeros / formatting loss; already patched by a formula field |
| `Payment Amount` stored as text | Airtable `Active Customers` | Cannot sum or reconcile |
| Duplicate `🔄 Change & Update Log` field | Airtable `Fleet` | Ambiguous linkage |
| `Vehicle Maintenance Records` as single-line text | Airtable `Fleet` | Should be a linked record |
| Two org IDs for one tenant | `verticals` on `AIXMOS` vs pricing/journey on `TMMT RENTALS` | Tenant-scoped queries will silently miss data |
| Test tenant in production | `organizations` → "Pilot Motors (smoke)" | Pollutes any org-wide aggregate |
| 17,192 auto-generated VA tasks | `exec_va_tasks` | Signal-to-noise; needs review before any automation is trusted |

---

## 7. Compliance flags — address before shipping

**🔴 A. Credentials stored in plaintext.** The Airtable `Insurance` table has fields
`LOGIN EMAIL`, `LOGIN PASSWORD`, `LOGIN PHONE`. Carrier portal passwords are sitting in
a business database that multiple staff can read. This should move to a secrets manager
and be removed from Airtable. Treat as the highest-priority remediation.

**🔴 B. Consumer report data handled as attachments + AI.** `Background Checks` stores
driver's licenses, paystubs, and background-check screenshots as Airtable attachments,
with an AI field ("Key Details (Extracted from Screenshot)") reading them. Background
check results are FCRA-regulated consumer reports. Requirements that apply: permissible
purpose, secure storage, restricted access, a documented adverse-action process when a
report drives a denial, and care about running automated extraction over them. Legal
review required.

**🟡 C. Insurance product structure.** Selling "TMMT Economy Shield" as an internal
product is materially different, legally, from placing a carrier's non-owner policy as
an affiliate. State insurance regulation applies. Confirm which model is real.

**🟡 D. CROA / credit repair.** Fee collection before performance, disclosures, and the
right to cancel are statutory. The existing legal suite reportedly includes CROA
disclosures — verify they are actually wired to the enrollment flow, not just drafted.

**🟡 E. TCPA opt-out gate.** `do_not_contact_numbers` carries an in-database comment
recording that its RLS previously **failed open** (returned zero rows, meaning "nobody
opted out") until it was fixed on 2026-07-16. Add a regression test that asserts this
gate fails *closed*. Any outbound automation must be blocked until that test exists.

**🟡 F. Partner attribution.** The system must never present partner-performed credit,
formation, or funding work as TMMT's own. Verify the customer-facing copy in the
progression surfaces before they go live.

---

## 8. What NOT to rebuild

Claude Code should extend, not recreate: the rental funnel · fleet and vehicle records ·
inspections, handover, maintenance, expenses, tickets · lead attribution and UTM
capture · the GHL↔Airtable↔Supabase sync plumbing · the operator profile, rubric, and
training system · the programs/keyword routing engine · pricing and insurance rule
tables · the journey checkpoint model · the entitlements/packages system · the legal
contract suite.

Nine Virginia-governed contracts already exist (Vehicle Rental, Lease-to-Own, Credit &
Funding Consulting with CROA disclosures, Employment, Contractor, Fleet Capital /
Profit-Share, Membership Interest, Convertible Note, Profits Interest Grant). Wire to
them; do not draft new ones.
