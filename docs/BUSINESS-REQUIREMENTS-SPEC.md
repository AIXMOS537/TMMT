# TMMT — Business Requirements & Workflow Specification

**Version:** 3 — merged canonical spec
**Date:** 2026-09-01
**Supersedes:** v1 and v2 of this file.
**Absorbs:** `BUSINESS-RULES-RECOVERED.md` (Drive evidence) and `platform-context/05-OPEN-DECISIONS.md`.
Those files remain as the evidence base and are cited throughout — this document is the one to build from.

---

## 0. Status and how to read it

Three independent sources were reconciled to produce this:

| Source | What it gives | Weight |
|---|---|---|
| **Live database + repo** | What the software actually does | Fact about the system |
| **Google Drive Data Room** | What the contracts and SOPs say | Fact about the paperwork |
| **Owner, 2026-09-01** | What the policy is | Authoritative — beats both |

Tags: `[OWNER]` stated by Taha 2026-09-01 · `[DOC]` evidenced in Drive · `[DB]` live in Supabase ·
`[CONFLICT]` the three sources disagree · `[OPEN]` nobody has answered.

> ### Corrections to v2 of this document
> v2 presented three things as settled that the Drive evidence contradicts. Corrected here:
> 1. **Insurance products are not evidenced.** v2 listed six products as "Confirmed — already live". They are seeded rows. **No TMMT insurance policy exists in Drive**, and the named carrier "National Fleet Underwriters" appears nowhere in it. See §3.1.
> 2. **Deposit amounts are not policy.** v2 published a per-tier deposit table as confirmed. Drive: *"BLANK in every template. There is no deposit policy anywhere."* Those numbers are seed data. See §3.2.
> 3. **Weekly pricing is seed data, not the rate card.** v2's `rental_pricing_rules` figures (economy $280/wk) do not match real practice — sedans from **$300**, SUVs from **$450**, real rates $300–$500. See §3.3.
>
> v2 also framed the fleet as live. It is not — see §1.

---

## 1. Where the business actually is

`[OWNER]` **No vehicles and no partners currently.** The 43 `fleet` rows are sold or returned;
the 16 "Active" `active_customers` rows are historical.

So the live asset is the pipeline, not the fleet:

| Live asset | Count | Note |
|---|---|---|
| Leads | 875 | **759 have no status at all** |
| GHL contacts | 1,642 | Synced |
| Waitlist | 104 | Wanted a car, never got one |
| Background checks | 299 | 69 sat in "Need Manager's Review" — and see §4 C1 |
| Stuck in "Verification Form Sent" | 377 | Busiest stage in the old pipeline |
| Stuck in "Verification Form Received" | 286 | Terminal stage — where people disappeared |
| **Approved, never placed** | **81** | Already eligible, never saw a car |

**Eighty-one approved people and a hundred and four on the waitlist are in the database with
nobody contacting them.** That is the restart asset.

### 1.1 When the business actually stopped `[DB — audited 2026-09-01]`

Real business dates, not row timestamps:

| Last… | Date |
|---|---|
| Rental started | **2026-02-06** |
| Payment recorded | **2026-03-23** |
| Ticket raised | **2026-03-27** |
| Inspection | 2026-02-23 |
| Expense logged | 2026-01-21 |

The data independently confirms the owner's statement. Operations wound down in Q1 2026.

### 1.2 The database froze at the migration

`active_customers`, `background_checks`, `customer_payments`, `expenses`, `fleet`,
`insurance`, `tickets`, `waitlist`, `operation_costs` and `appointments` **all carry
`created_at = 2026-04-22`** — the Airtable→Supabase migration date. **Nothing operational has
been written since.** Only `exec_va_tasks` (17,192), `coo_briefings`, `ghl_contacts` and
`incoming_leads` are still moving.

### 1.3 Lead flow collapsed before anything broke

| Month | New leads |
|---|---:|
| April | **662** |
| May | 111 |
| July | 91 |
| August | **11** |

`[DB]` GHL intake still works — 7 leads and 12 GHL contacts since 2026-08-19, newest one day
old. Only the direct landing-page webhook is dead (§1.5).

### 1.4 Collections were the failure, not pricing

Of 31 payment records: **26 Overdue, 1 Paid.** Roughly **$6,869 past due** against **$9,510**
billed; worst single balance **$814**. This matches the Drive's independent "chronic arrears"
finding. **The business did not fail on demand or on price — it failed on collection.**

That is exactly what the owner's rules in §2.3 exist to fix: 3-day grace, $25/day, and a
`PAYMENT_ISSUE` state that fires on day 4 without anyone remembering to look.

### 1.5 🔴 Lead intake has been dead since 2026-08-19

`/api/leads/webhook` on `tmmt-ops` has returned **500 nine hundred and thirty-five times**
since 2026-08-19 22:27 UTC. Cause: Vercel **production** is missing
`NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY`.

All eight public landing pages return **200**, so the forms look alive, accept submissions,
and the webhook then drops them with an empty body. How many were real leads **cannot be
recovered** — the failures never wrote a row. Fix: set both vars in Production, redeploy,
then re-run `scripts/mesh/go-live-integration-test.sh` until it prints
`lead webhook 200 + ok:true`.

### 1.6 🔴 Money is not a queryable number

`active_customers.payment_amount` is **free text on 32 of 35 rows; zero are clean numbers**:

```
"$69.99/daily ($489.93/weekly)"
"$438/weekly ; $63/day"
"$165/3 days"
```

Nothing can total revenue, compute arrears, or bill automatically without a human reading
each row one at a time. Real rates land **$322–$489/week**, consistent with the Drive's
$300–$500 card.

Expenses barely exist: **33 rows, Nov 2025–Jan 2026, $2,216 total** for a 43-car fleet —
which is why §4 concludes there is no P&L.

**This is the strongest argument for §5 collision 1.** A rental record with typed
`weekly_rate_cents` and `deposit_cents` is not a nicety — without it the business cannot
measure itself, bill reliably, or prove anything to an investor.

---

## 2. Rules that are settled

### 2.1 Qualification — criminal and driving `[DOC]`

From `Background Check Qualifications` (2026-06-04), a real screening SOP already in use.

**Identity gate.** Legal name as on licence · DOB · current phone · current address · valid
licence uploaded. *"If identity cannot be confidently matched → DO NOT PREQUALIFY."*

**Automatic denial, no escalation:**

| Category | Disqualifiers |
|---|---|
| Violent | Murder / manslaughter · attempted murder · assault any degree · domestic violence · kidnapping · armed robbery · sexual offences. *"Zero tolerance. No exceptions."* |
| Financial | Theft, fraud or robbery **≥ $1,000** · auto theft · carjacking · organised retail theft · identity theft or credit fraud |
| Weapons / drugs | Illegal firearm possession · weapons trafficking · drug distribution or trafficking · felony drug manufacturing |
| Driving | DUI/DWI **within 7 years** · reckless driving · hit and run · driving on suspended/revoked licence · vehicular assault · racing · speeding **20+ over** |

**Escalate, do not auto-deny:** 3+ moving violations in 24 months · 2+ at-fault accidents in
36 months · non-violent misdemeanour older than 5 years · simple possession · single theft
under $1,000 · violations 5+ years old · any ambiguity.

**Denial script:** *"Based on internal risk guidelines, we're unable to move forward at this time."*

### 2.2 Qualification — driver record `[OWNER]`

Drive contains **no** rating or trip rule; the "4.8 Uber rating" in the old blueprint was an
AI's invention and must not be built. The owner set the real bar on 2026-09-01:

- Uber/Lyft rating **below 4.6** → decline
- Fewer than **100 completed trips** → decline
- Past repossession · left a past rental owing money · failed background · no valid licence → decline

`[DB]` Qualifying platforms, from `programs.match_keywords`: Uber, Lyft, rideshare, DoorDash,
UberEats, gig driver. This is keyword routing, not a written policy — treat as practice.

`[DOC]` Income is screened **by phone, not by rule**: *"our rentals typically start around $300
per week depending on the vehicle. Does that fit?"* Sales disqualifiers: can't afford base
pricing · needs daily only · no licence · wants "cheap" · won't commit to an appointment.

### 2.3 Rental terms

| Rule | Value | Source |
|---|---|---|
| Credit check | **None** — licence + deposit + first week | `[DOC]` closer playbook |
| Minimum term | **1 week** | `[OWNER]` — Drive has no contractual minimum; sales target is *"ideal 30+ days"* |
| Maximum term | **None** — rolls weekly, with periodic vehicle-condition check-ins | `[OWNER]` |
| Payment schedule | **Weekly** | `[OWNER]` + `[DOC]` |
| Grace before flagged | **3 days** | `[OWNER]` |
| Late fee | **$25 per day** | `[OWNER]` — but see `[CONFLICT]` §3.4 |
| Lease-to-own | At **90 days** good payment, *offer* enrolment; opt-in only | `[OWNER]` |
| Late escalation ladder | Day 1 notice → *"we are allowing 48 hours"* → Fleet Department for repossession. Separate 24-hour ladder for 3-day rentals | `[DOC]` real, in use |
| Repossession | v3 draft: written notice + **48h cure**, *"without breaching the peace (UCC §9-609)"* | `[DOC]` |

`[DB]` `client_journey` already carries `good_standing_days` and `lto_eligible` — the 90-day
rule wires into columns that exist.

### 2.4 Partner economics

**The payout formula, reverse-engineered from two issued reports and verified:**

```
partner payout = (gross rental earnings × partner %) − insurance − expenses
```

| Partner | Period | Vehicle | Gross | Insurance | Split | Paid |
|---|---|---|---:|---:|---|---:|
| Marc | Feb 2026 | 2013 Corolla | $1,000 | $120 | 40/60 | $480 ✓ |
| Asad | Mar 2026 | 2009 Corolla | $1,280 | $120 | 30/70 | $776 ✓ |
| Asad | Mar 2026 | 2010 Camry | $1,440 | $120 | 30/70 | **$813** ⚠️ should be $888 |

**The written fee ladder** — JV Partner Agreement v3, current draft `[DOC]`:

| Tier | TMMT fee | Partner keeps | Scope |
|---|---:|---:|---|
| 1 | 10% | 90% | Basic management, up to 3 vehicles |
| 2 | 20% | 80% | Up to 5 |
| 3 | **30%** | **70%** | Up to 10 — *this is the owner's stated default* |
| 4 | 40% | 60% | Full service |
| 5 | 50% | 50% | Premium / done-for-you |

*"The higher fee must reflect MORE real services delivered — so it stays a fair service fee."*

`[OWNER]` Default for a car with no recorded number: **70% to the owner** — i.e. Tier 3.
`[OWNER]` `partner_percentage` in the database is **the owner's share**, not TMMT's.
`[OWNER]` Repairs: **owner pays**, deducted from their share — matches JV v3 §7 `[DOC]`.
`[OWNER]` Payout cadence: **monthly** — matches Drive `[DOC]`.

**Who pays what** `[DOC]`:

| Cost | Who |
|---|---|
| Insurance | Partner — deducted per car per month |
| Routine maintenance, towing, trackers, keys, upkeep | Partner (JV v3 §7), unless Tier 5 |
| Booking, renters, claims, maintenance coordination, tolls, tickets, cleaning, reporting | Company |
| Citations | Renter, under the lease |
| Roadside — **AAA Premier + Allstate**, mandatory on JV vehicles | Partner |

### 2.5 Approvals

`[OWNER]` A manager may approve a repair up to **$250** without the owner.

### 2.6 Compliance trip-wires on calls `[DOC]`

Banned: *guarantee · approve · fund · fix your credit · credit repair · remove items · 100% ·
no risk · I promise.* Three in 30 days = off the phones.

---

## 3. Conflicts — resolve these before building

### 3.1 🔴 There is no evidenced insurance policy

Every JV contract states *"Company maintains commercial insurance"* and partners are charged
**$120/month** for it. The Drive contains **no policy, no declarations page, no certificate,
no broker agreement** for TMMT Auto Services LLC.

The only insurance document is an **ID card belonging to a different entity** — Mobilitas via
Roamly, named insured *Urban Fleet Solutions LLC / Overland Indemnity / Sukul Barua*,
**Connecticut**, one 2020 Tesla Model Y.

`[DB]` `rental_insurance_products` names **"National Fleet Underwriters"** and three
`tmmt_internal` "Shield" products at $35/$55/$95 weekly. **The carrier appears nowhere in
Drive.** Treat every row in that table as a placeholder.

> **Selling the `tmmt_internal` products without underwriting paper is a state-insurance
> problem, not a data problem.** Nothing may use that table until a policy is produced.

`[OPEN]` Is the model broker-referral (Drive supports this) or own-paper (no evidence)?

### 3.2 🔴 Deposit — three answers

| Source | Says |
|---|---|
| `[DB]` `rental_pricing_rules` | $400 / $500 / $1,000 by tier, up to $2,000 |
| `[DOC]` every lease template | **Blank. No deposit policy exists anywhere in Drive** |
| `[DOC]` draft language | *Non-refundable earnest money* if the renter walks — explicitly **not** a damage deposit |
| `[OWNER]` 2026-09-01 | **Refundable**, minus damage, tickets and arrears |

The owner's answer is authoritative and is the biggest single change from the paperwork —
it converts the deposit from earnest money into a damage deposit. **The lease must be
redrafted to match, or the contract and the system will say different things.**

### 3.3 🟡 Pricing — seed data versus the real rate card

`[DB]` says economy $280/week. `[DOC]` says *"Sedans: starting as low as $300/week · SUVs:
starting at $450/week,"* with real per-car rates **$300–$500**. `[OPEN]` Which is the rate card?

### 3.4 🔴 The late fee collides with the halal lease

`[OWNER]` **$25 per day** late.
`[DOC]` The current `Vehicle Ijārah (Lease) Agreement v3 MULTI-STATE (halal)` states late
fees are ***"donated to CHARITY, never kept."*** The superseded Georgia template it replaced
applied payments to *"accrued interest"* — the riba problem already corrected once.

**These are compatible only if the $25/day is collected and donated, not retained as revenue.**
That is a decision for the owner, and it should be written into both the lease and the ledger
so the accounting can prove it. `[OPEN]`

### 3.5 🔴 The 60% mismatch, open since June

The v2 draft carries the owner's own note:

> *"Your internal P&L showed a 60% partner payout on some cars, but this contract says 70-90%.
> Reconcile which deal applies to which partner so records and contracts match."*

Worse: **Marc's real February report is 40/60 — Tier 4, which did not exist in any contract at
that time.** He was paid on a tier that was not yet written down.

### 3.6 🔴 Insurance deduction — three values

JV v2 §5 says **$70/month**. JV v3 §6 is **blank**. Both real payout reports charge **$120**.
Partners are being charged $120 against a contract that says $70 or says nothing. `[OPEN]`

### 3.7 ⚠️ A $75 gap in a real payout

`Asad Camry: (1440 × 70%) − 120 = $888`, but the report paid **$813**. No stated expense
accounts for it. Either a deduction went unrecorded or a partner was underpaid.
**Check whether it repeated** — this is exactly the failure the missing ledger produces.

### 3.8 🟡 Termination trigger

Old: *"late more then 2 times"* → terminate and repossess. v3: written notice + 48h cure.
`[OPEN]` Which governs?

### 3.9 🟡 Other unsettled terms

Mileage limit (15,000/term in the old template, blank in v3) · payment method (Zelle/bank per
contract, Cash App in the real ledger, Stripe in the lead checklist) · service radius (only the
wrong-state *"100-mile Greater Atlanta"* exists).

---

## 4. Compliance queue — professional review, not developer work

| # | Item | Why |
|---|---|---|
| C1 | **Intelius is not a CRA** but drives rental eligibility. Its own SOP says so | FCRA. Legal review before more screening runs. Note this makes the 299 `background_checks` rows a different thing than assumed |
| C2 | **No TMMT insurance policy evidenced**, partners charged $120/mo for it | Contractual, possibly regulatory |
| C3 | **`tmmt_internal` insurance products have no underwriting paper** | State insurance regulation |
| C4 | **Non-compliant marketing script still live** — *"$800 to $1,000+ a month on autopilot"*, *"Secure $50K+ in funding"*, *"without lifting a finger"*. It was edited **six days after** the compliant replacement was written | CROA / FTC. **Fixable today at zero cost** |
| C5 | **Georgia lease template still filed as canon** for a Virginia business, and it contains the interest clause | Wrong governing law + riba |
| C6 | **Superseded Deal Picker still present**, pointing at the wrong lease | Someone will sign the Georgia contract |
| C7 | **$75 unexplained payout gap** | Possible partner underpayment |
| C8 | **All In One Management provides credit repair and is owner-affiliated** | CROA + related-party disclosure |
| C9 | **Automatic declines** (§2.2) issue adverse decisions without a human | Needs a decline notice that satisfies the rules in each state |
| C10 | **Late fee at $25/day** | State caps and disclosure, plus the charity condition in §3.4 |

`[DOC]` **There is no P&L.** The `$21,884 / $13,130 / $5,400` figures come from one undated
worksheet with a flat 60% assumption and no insurance, maintenance or repair lines.
**Do not put $21,884 in an investor document.**

---

## 5. What the software gets wrong today

| # | Collision | Detail |
|---|---|---|
| 1 | **No rental record** | `bookings` = 0 rows. Rentals lived inside `active_customers` with the renter's name as free text on the car; status flipped Active (16) / Removed (19). Renters were overwritten, so most history is gone. **Build this before the next car goes out.** |
| 2 | **Person record is a mirror** | `people` = 1,209 rows: 1,205 GHL links, **2** lead links, **2** customer links. `parties` is a second, empty spine. |
| 3 | **Ownership is free text** | `TMMT` / `Tmmt ` / `TMMT Rentals` are all the house. `Duval / Jimmy` and `Jimmy/ Duval` are the same pair twice. `Asad` and `Asad ` differ by a trailing space. Only 7 of 43 carry a percentage. |
| 4 | **Pipeline is blank** | 759 of 875 leads have no status. Two live statuses (`Active customer`, `vehicle returned`) are rental states leaking into the lead table. A replacement 11-stage pipeline is already designed in `GHL-PIPELINE-MAP.md` and has never been applied. |

---

## 6. Canonical model

**A person is one record. Everything else is a relationship or an event attached to it.**
A relationship has a start and an end; ending it never deletes it.

```
PERSON  (people)
  +-- RELATIONSHIP (person_roles)   role + dates, never deleted
  |     applicant | renter | former_renter | vehicle_owner
  |     investor | partner | vendor | staff | referral_source
  +-- IDENTITY LINKS      ghl_contact, lead, auth user
  +-- DOCUMENTS           licence, insurance, agreements
  +-- COMMUNICATIONS      every touch, every channel
  +-- CONSENT             TCPA state, per channel

VEHICLE (fleet)
  +-- OWNERSHIP      person/org, owner's % share, tier, start/end
  +-- RENTALS        many, over time
  +-- INSPECTIONS    onboarding, periodic condition, return
  +-- MAINTENANCE    who-pays flag per JV tier
  +-- TICKETS · INSURANCE · DOCUMENTS
  +-- MONEY          revenue, expenses, owner payouts
  +-- EVENTS         append-only status history

RENTAL (bookings)          <-- the missing centre
  person_id, vehicle_id, org_id
  state, dates (start / actual_end)     -- no expected_end: it rolls
  weekly rate, deposit, payment schedule
  agreement, insurance source + verification
  delivery + periodic + return inspections
  ledger entries, late fees (and their charity disposition), tickets
  good_standing_days, lto_offered_at
  end reason

PAYOUT (revenue_splits)
  vehicle, partner, period
  gross · partner% (tier) · insurance · itemised expenses · net
  -- must reproduce: (gross x partner%) - insurance - expenses
```

---

## 7. Lifecycles

**Lead → qualification**
```
NEW -> CONTACTED -> APPLYING -> DOCS_PENDING -> IN_REVIEW
                                     |
                     +---------------+---------------+
                     v                               v
                 QUALIFIED                     NOT_QUALIFIED
                     |                               |
                     v                               v
              VEHICLE_MATCH                 PATHWAY_ASSESSMENT
                                                     |
                                        +------------+------------+
                                        v                         v
                                PATHWAY_ENROLLED               CLOSED
```
Auto-decline fires before `IN_REVIEW` on §2.1 and §2.2. Escalation cases go to a human, never
to auto-decline. Every decline writes a reason code and stays reversible.

**Rental**
```
MATCHED -> RESERVED -> AGREEMENT_SIGNED -> DEPOSIT_PAID -> DELIVERED
   -> ACTIVE  (rolls weekly, no end date)
        |-> day 4 unpaid -> PAYMENT_ISSUE  ($25/day accrues, see 3.4)
        |     day 1 notice -> 48h allowed -> Fleet Dept
        |     cured -> ACTIVE   |   uncured -> notice + 48h cure -> RECOVERY
        |-> CONDITION_CHECK -> ACTIVE
        |-> day 90 good standing -> LTO_OFFERED (opt-in)
   -> ENDING -> RETURNED -> INSPECTED -> RECONCILED -> CLOSED
```
Deposit settles at `RECONCILED`: refunded minus damage, tickets, arrears.

**Partner / vehicle owner**
```
LEAD -> APPLICATION -> VERIFICATION -> VEHICLE_REVIEW -> INSPECTION
     -> AGREEMENT (tier 1-5 recorded) -> ONBOARDED -> EARNING
        MONTHLY: (gross x partner%) - insurance - itemised expenses -> PAYOUT
     -> WINDING_DOWN -> EXITED
```

**Pathway — did not qualify**
```
NOT_QUALIFIED (reason) -> ASSESSED -> OFFERED -> ACCEPTED | DECLINED
  -> REFERRED (partner) -> IN_PROGRESS -> REASSESSED
       -> QUALIFIED_FOR_RENTAL | READY_TO_ACQUIRE | STALLED | CLOSED
```
Record **target** milestone dates and **actual** outcomes separately. A 90-day target is a
plan, never a promise.

---

## 8. Build order

**Step 0 — Free compliance wins, today.** Archive the non-compliant sales script (C4). Remove
the superseded Deal Picker and the Georgia lease from canon (C5, C6). These cost nothing and
are live exposure.

**Step 1 — Settings table.** Every `[OWNER]` rule in §2 as editable settings, plus the JV tier
ladder. Nothing hardcodes them.

**Step 2 — Lead pipeline.** The only live asset. Apply the 11 stages from `GHL-PIPELINE-MAP.md`.
Resolve the 759 blanks. Surface the **81 approved + 104 waitlisted** as a call list.

**Step 3 — Rental record.** Build `bookings` per §7 before the next car goes out. Archive what
survives of old rentals, marked historical. Stop writing `fleet.customer`.

**Step 4 — Person spine.** Backfill lead and customer links by phone/email. Add `person_roles`.
Retire `parties`.

**Step 5 — Vehicle and ownership.** Mark all 43 sold or returned. Deduplicate owner names.
Real ownership rows carrying the tier and the owner's share.

**Step 6 — Payout ledger.** Must reproduce the §2.4 formula exactly and itemise every
deduction — that is both the contract's promise and the fix for §3.7.

**Step 7 — Documents and tasks.** Built and empty; wire once the spine exists.

**Step 8 — Pathway wiring.** Decline reason → `program_applications`, `partner_referrals`,
`client_journey`. The seven programs already carry `owner_role`, `destination`, `next_action`.

**Step 9 — Dashboards.** Only after the data underneath is real.

**Rule for every step:** no cutover without a backfill and a reconciliation count.

---

## 9. Still open

**Blocking money:** insurance model (§3.1) · deposit versus lease language (§3.2) · rate card
(§3.3) · late fee and the charity condition (§3.4) · the 60% reconciliation (§3.5) · insurance
deduction $70/$120 (§3.6) · termination trigger (§3.8) · mileage, payment method, service
radius (§3.9).

**Blocking the pathway:** exactly what TMMT does versus All In One Management versus the credit
partner versus the funder — and what marketing may claim. The funding partner is **still
unnamed** in Drive, and the strategy memo instructs *"get the partner agreements in writing."*

**Blocking permissions:** refund and discount limits; who may reverse an automatic decline.

**Blocking reassessment:** how often a pathway person is re-checked, and how many attempts
before nurture.

---

## Appendix — provenance

`[DB]` read from Supabase `uapxakmlwnpfsftfeezx` and this repo on 2026-09-01.
`[DOC]` from the Google Drive `TMMT DATA ROOM` read-only sweep, per `BUSINESS-RULES-RECOVERED.md`.
`[OWNER]` stated by Taha on 2026-09-01. Row counts are point-in-time — re-verify before acting.
