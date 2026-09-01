# TMMT — Business Requirements & Workflow Specification

**Version:** 2
**Date:** 2026-09-01
**Status:** Rules locked by owner. Build order approved for review.

> **Change from v1:** v1 read the database as a live operation — "43 vehicles, 21 currently
> rented." That was wrong. The owner confirmed on 2026-09-01: **no partners and no cars
> currently. The business is at square one.** All fleet and active-customer rows are
> history, not today. The build order below has been re-ordered because of it.

---

## 0. How to read this

Three tags:

- `[CONFIRMED]` — verified live in the database or repo on 2026-09-01.
- `[LOCKED]` — decided by the owner on 2026-09-01. Treat as business policy.
- `[OPEN]` — still the owner's decision. Nothing may assume an answer.

The stack is settled: Next.js in this repo, Supabase `uapxakmlwnpfsftfeezx` as source of
truth, GHL as the front door. This is a reconciliation spec, not a greenfield one.

---

## 1. Where the business actually is

`[CONFIRMED]` The owner has **no vehicles and no partners right now.** The 43 rows in
`fleet` are sold or returned to their owners. The 16 "Active" rows in `active_customers`
are historical.

That inverts the priority. The live asset is not the fleet — it is **the pipeline**:

| Live asset | Count | Note |
|---|---|---|
| Leads | 875 | **759 have no status at all** |
| GHL contacts | 1,642 | Synced |
| Waitlist | 104 | People who wanted a car and never got one |
| Background checks | 299 | 69 sat in "Need Manager's Review" |
| Stuck in "Verification Form Sent" | 377 | The busiest stage in the old pipeline |
| Stuck in "Verification Form Received" | 286 | Terminal stage — where people disappeared |
| Approved, never placed | 81 | Already eligible, never saw a car |

**Eighty-one approved people and one hundred and four waitlisted people are sitting in the
database right now with nobody talking to them.** That is the asset. Everything vehicle-side
is a rebuild.

`[CONFIRMED]` Around 170 tables already exist, plus app portals for admin, investor,
operator, partner, program, vendor. The ecosystem is modelled, not wired.

---

## 2. Decisions locked 2026-09-01

Every rule here came from the owner directly. These are policy. They belong in a settings
table an admin can edit — never hardcoded in a branch.

### Renting

| Rule | Value |
|---|---|
| Credit check | **None.** Licence + deposit + first week's payment `[CONFIRMED docs/CLOSER_PLAYBOOK_V1.md]` |
| Minimum term | **1 week** |
| Maximum term | **None.** Rolls week to week indefinitely |
| Ongoing check | **Periodic vehicle-condition check-in** while the rental rolls |
| Payment schedule | **Weekly** |
| Grace period | **3 days** past due, then flagged |
| Late fee | **$25 per day late** |
| Deposit | **Refundable, minus damage, unpaid tickets and missed payments** |
| Lease-to-own | At **90 days of good payment history**, *offer* enrolment. Opt-in only — the rental otherwise keeps rolling |

`[CONFIRMED]` `client_journey` already carries `good_standing_days` and `lto_eligible`.
The 90-day rule wires straight into columns that already exist.

### Qualification — automatic disqualifiers

A person is **auto-declined**, no human needed, on any of:

1. Uber/Lyft rating **below 4.6**
2. Fewer than **100 completed trips**
3. A vehicle was **repossessed** from them before
4. They **left a past rental owing money**
5. **Failed** background check
6. **No valid driver licence**

`[CONFIRMED]` Qualifying platforms, from `programs.match_keywords`: Uber, Lyft, rideshare,
DoorDash, UberEats, gig driver.

`[OPEN]` Everything else is a human decision. Who may override an auto-decline is still open.

### Vehicle owners / partners

| Rule | Value |
|---|---|
| Revenue split | **Owner 70% / TMMT 30%** is the default |
| Split direction | `partner_percentage` is **the owner's share**, not TMMT's |
| Existing splits | 70% on 4 cars, 65% on 2, 60% on 1 — honour the deal on the car |
| Repairs | **Owner pays**, deducted from their share |
| Payout schedule | **Monthly** |

### Approvals

| Rule | Value |
|---|---|
| Manager repair spend without the owner | **$250** |

`[OPEN]` Refund limits, discount limits, and who may approve a rental are still open.

### Pricing and deposits `[CONFIRMED — live in `rental_pricing_rules`]`

| Tier / vehicle | Daily | Weekly | Deposit |
|---|---:|---:|---:|
| Economy | $45 | $280 | $400 |
| Mid | $75 | $470 | $500 |
| Luxury | $150 | $950 | $1,000 |
| Tesla Model 3 (2020+) | $89 | $550 | $500 |
| Tesla Model Y (2020+) | $95 | $590 | $500 |
| BMW 3 Series (2018+) | $120 | $750 | $750 |
| Mercedes C-Class (2018+) | $125 | $780 | $750 |
| Porsche (2018+) | $220 | $1,400 | $1,500 |
| BMW 7 Series (2018+) | $240 | $1,550 | $2,000 |
| Mercedes S-Class (2018+) | $250 | $1,600 | $2,000 |

### Insurance `[CONFIRMED — live in `rental_insurance_products`]`

| Product | Source | Min liability | Weekly |
|---|---|---:|---:|
| TMMT Economy Shield | internal | $250,000 | $35 |
| TMMT Mid-Tier Protection | internal | $500,000 | $55 |
| TMMT Luxury Coverage | internal | $1,000,000 | $95 |
| Fleet Non-Owner (Economy) | National Fleet Underwriters | $300,000 | $42 |
| Fleet Non-Owner (Mid) | National Fleet Underwriters | $500,000 | $62 |
| Fleet Non-Owner (Luxury) | National Fleet Underwriters | $1,000,000 | $110 |

Every product carries `requires_background_approved = true`.

`[OPEN]` Whether a renter may bring their own policy instead, and what minimum it must meet.

### Compliance trip-wires `[CONFIRMED docs/CLOSER_PLAYBOOK_V1.md]`

Banned on any call: *guarantee · approve · fund · fix your credit · credit repair ·
remove items · 100% · no risk · I promise.* Three in 30 days = off the phones.

---

## 3. The four collisions

Still true, but re-read them knowing the fleet is historical.

### 3.1 The rental record does not exist

`bookings` — dates, pricing, deposit, insurance verification, lot release — has **0 rows**.
Rentals were kept inside `active_customers` (`vehicle_rented`, `rental_start_date`,
`payment_amount`) with `fleet.customer` as free text, and `status` flipping between
**Active (16)** and **Removed (19)**.

Because renters were overwritten, most of the rental history is already gone. What survives
should be archived, but the real point is forward-looking: **a rental record must exist
before the first new car goes out.** Do not restart the business on the old shape.

### 3.2 The person record is a mirror, not a spine

`people` has 1,209 rows: **1,205 GHL links, 2 lead links, 2 customer links.** It mirrors
marketing and touches operations nowhere. `parties` is a second abandoned spine at 0 rows.

### 3.3 Vehicle ownership is free text

`fleet.partner_name` holds names typed three different ways — `TMMT`, `Tmmt `,
`TMMT Rentals` are all the house; `Duval / Jimmy` and `Jimmy/ Duval` are the same two
people counted twice; `Asad` and `Asad ` differ by a trailing space. Only 7 of 43 carry a
percentage. Free text cannot support payouts or a partner portal.

### 3.4 The pipeline is mostly blank

875 leads, **759 with no status.** The 116 that have one use free text, including
`Active customer` and `vehicle returned` — rental states leaking into the lead table.

`[CONFIRMED]` `docs/GHL-PIPELINE-MAP.md` already contains a designed 11-stage replacement
pipeline with real volumes. It has not been applied.

---

## 4. Canonical model

**A person is one record. Everything else is a relationship or an event attached to it.**
A relationship has a start and an end; ending it never deletes it.

```
PERSON  (people)
  |
  +-- RELATIONSHIP (person_roles)   one row per role, with dates
  |     applicant | renter | former_renter | vehicle_owner
  |     investor | partner | vendor | staff | referral_source
  |
  +-- IDENTITY LINKS      ghl_contact, lead, auth user
  +-- DOCUMENTS           licence, insurance, agreements
  +-- COMMUNICATIONS      every touch, every channel
  +-- CONSENT             TCPA state, per channel
```

```
VEHICLE (fleet)
  +-- OWNERSHIP      person/org, % share (owner's share), start/end
  +-- RENTALS        many, over time
  +-- INSPECTIONS    onboarding, periodic condition, return
  +-- MAINTENANCE    scheduled + reactive, with who-pays
  +-- TICKETS        violations, tolls
  +-- INSURANCE      policy, dates
  +-- DOCUMENTS      title, registration, emissions
  +-- MONEY          revenue, expenses, owner payouts
  +-- EVENTS         append-only status history
```

```
RENTAL (bookings)          <-- build before the first new car goes out
  person_id, vehicle_id, org_id
  state, dates (start / actual_end)   -- no expected_end: it rolls
  pricing (weekly, deposit), payment schedule
  agreement, insurance source + verification
  delivery + periodic + return inspections
  ledger entries, late fees, incidents, tickets
  good_standing_days, lto_offered_at
  end reason
```

```
PATHWAY (program_applications + client_journey)
  person_id, program (one of the 7)
  entry reason   <-- "did not qualify, because X"
  milestones, tasks, partner referrals
  reassessment dates + outcomes
  exit: qualified | became owner | closed | declined
```

---

## 5. Who sees what

`[CONFIRMED]` `profiles.role` is authoritative, **not** the JWT role. Operators scope
through `org_roles`, partners through `partner_fleet_access`.

| Actor | Sees | Can do | Cannot do |
|---|---|---|---|
| Owner / admin | Everything | Everything | — |
| Ops manager | All operations | Approve repairs **to $250** `[LOCKED]` | Spend over $250, change roles |
| Rental staff | Assigned applications & rentals | Collect docs, run checks, prep agreements | Final approval, full background report |
| Customer service | Assigned people & rentals | Communicate, log, create tasks | Financial edits, qualification calls |
| Finance | Money across the business | Payments, payouts, refunds | Qualification calls |
| Maintenance | Vehicles & jobs | Inspections, repairs, status | Customer or financial records |
| Renter | Own record only | Upload docs, pay, view rental | Anything else |
| Vehicle owner | Own vehicles only | Performance, statements, documents | Renter PII beyond the agreement |
| Partner | Referred people, consented fields | Update referral status | Full customer record |

`[CONFIRMED]` Background checks, payments, documents and insurance are already locked to
platform admin, with staff reviewing through a masked queue. Keep that model.

---

## 6. Lifecycles

### 6.1 Lead → application → qualification

```
NEW -> CONTACTED -> APPLYING -> DOCS_PENDING -> IN_REVIEW
                                           |
                             +-------------+-------------+
                             v                           v
                        QUALIFIED                  NOT_QUALIFIED
                             |                           |
                             v                           v
                      VEHICLE_MATCH             PATHWAY_ASSESSMENT
                                                         |
                                             +-----------+-----------+
                                             v                       v
                                     PATHWAY_ENROLLED             CLOSED
```

Auto-decline fires before `IN_REVIEW` on any of the six disqualifiers in §2.
`NOT_QUALIFIED` must carry a reason code — that reason routes the pathway.
Terminal but reopenable: `CLOSED`, `JUNK`, `DO_NOT_RENT`.

`[CONFIRMED]` Map onto the 11 stages already designed in `docs/GHL-PIPELINE-MAP.md`,
including the missing **Under Review** stage that let 286 people disappear.

### 6.2 Rental

```
MATCHED -> RESERVED -> AGREEMENT_SIGNED -> DEPOSIT_PAID -> DELIVERED
   -> ACTIVE  (rolls weekly, no end date)
        |-> day 4 unpaid -> PAYMENT_ISSUE  ($25/day accrues)
        |        cured -> ACTIVE   |   uncured -> RECOVERY
        |-> CONDITION_CHECK -> ACTIVE
        |-> day 90 good standing -> LTO_OFFERED (opt-in) -> ACTIVE or lease_to_own
   -> ENDING -> RETURNED -> INSPECTED -> RECONCILED -> CLOSED
```

Deposit is settled at `RECONCILED`: refunded minus damage, tickets and arrears.
Closing a rental never deletes it and never blanks the vehicle's history.

### 6.3 Vehicle

```
PROSPECT -> ONBOARDING -> DOCS -> INSPECTION -> APPROVED
   -> AVAILABLE -> RESERVED -> RENTED -> RETURNED
   -> INSPECTION -> AVAILABLE
   (any point)  -> MAINTENANCE -> AVAILABLE
                -> RETIRED | SOLD | RETURNED_TO_OWNER
```

`[CONFIRMED]` All 43 existing vehicles resolve to `SOLD` or `RETURNED_TO_OWNER`.

### 6.4 Vehicle owner / partner

```
LEAD -> APPLICATION -> VERIFICATION -> VEHICLE_REVIEW
     -> INSPECTION -> AGREEMENT -> ONBOARDED -> EARNING
          MONTHLY:  revenue
                  - expenses (repairs charged to owner)
                  = gross, split 70% owner / 30% TMMT
                  -> PAYOUT
     -> WINDING_DOWN -> EXITED
```

`[OPEN]` Minimum commitment and termination terms.

### 6.5 Pathway — the person who did not qualify

```
NOT_QUALIFIED (with reason)
  -> ASSESSED -> OFFERED -> ACCEPTED | DECLINED
  -> REFERRED (partner) -> IN_PROGRESS
        milestones, tasks, check-ins
  -> REASSESSED
        -> QUALIFIED_FOR_RENTAL   (back to 6.1)
        -> READY_TO_ACQUIRE       (becomes an owner)
        -> STALLED -> nurture
        -> CLOSED
```

Record the **target** milestone date and the **actual** outcome as separate fields.
A ninety-day target is a plan, never a promise.

### 6.6 Partner referral

```
CREATED -> CONSENT_CAPTURED -> SENT -> ACCEPTED | DECLINED
        -> IN_PROGRESS -> OUTCOME -> commission -> CLOSED
```

`[CONFIRMED]` `partner_referrals` already carries `consent_captured_at` and
`consent_channel`. No referral leaves the building without recorded consent.

---

## 7. Automation tiers

**Tier A — automate freely.** Application received. Missing-document reminders. Appointment
reminders. Insurance and registration expiry. Condition-check due. Late-payment reminder at
day 1–3. Maintenance due. Renewal notice. Staff task creation. Partner notification. Owner
monthly statement generation.

**Tier B — machine preps, human sends.** Draft the message. Stage the referral. Propose the
vehicle match. Compute the payout. Prepare the agreement. Present the 90-day LTO offer.
A person taps send. `[CONFIRMED]` `automation_outbox` already stages rather than dispatches.

**Tier C — never automatic.** Qualification overrides. Adverse action. Background-check
interpretation. Credit decisions. Insurance eligibility. Financing. Deposit forfeiture.
Repossession. Refunds. Anything that moves money out.

The six auto-disqualifiers in §2 are the single exception in Tier C's direction: they may
decline automatically, because the owner set them as bright lines. Every auto-decline must
still write a reason and be reversible by a human.

`[CONFIRMED]` TCPA and do-not-contact gating already exists, including a personal line
marked `do_not_contact`. Every outbound path passes through it.

---

## 8. Needs a professional, not a developer

- Background checks and adverse action, including automatic declines
- Anything credit-repair-shaped — what TMMT does versus a partner, and what marketing may claim
- Automatic decline notices and what they must say
- Insurance placement and referral compensation
- Lease-to-own structure and disclosure at the 90-day offer
- Late fees at $25/day — check the cap and disclosure rules in each state you operate in
- Electronic signature and record retention
- Retention and deletion for licence, background and payment data

`[CONFIRMED]` `COMPLIANCE_DISCLAIMERS.md` and `CREDIT-FUNDING-COMPLIANCE.md` already exist
in this repo. Reconcile before building the pathway.

---

## 9. Build order — revised for square one

v1 put the rental backfill first because it looked like a live rescue. It is not. With no
cars and no partners, the order changes: **wake the pipeline first, then build the rails
before the first new car goes out.**

**Step 1 — Settings table.** Encode every `[LOCKED]` rule in §2 as editable settings:
grace 3 days, $25/day, 1-week minimum, deposit refundable-minus, 70/30 default, monthly
payout, $250 manager limit, the six auto-disqualifiers, 4.6 rating, 100 trips. Nothing
downstream hardcodes them.

**Step 2 — Lead pipeline.** The only live asset. Apply the 11 stages already designed in
`GHL-PIPELINE-MAP.md`. Resolve the 759 blanks. Surface the **81 approved and 104 waitlisted
people** as a call list. This is the step that can make money this month.

**Step 3 — Rental record.** Build `bookings` properly against §6.2 before the first new car
goes out. Archive what survives of the old rentals from `active_customers` into it, marked
historical. Stop anything writing `fleet.customer`.

**Step 4 — Person spine.** Backfill `people.incoming_lead_id` and `active_customer_id` by
phone and email. Add `person_roles`. Retire `parties`. Everything joins through `people`.

**Step 5 — Vehicle and ownership.** Mark all 43 vehicles `SOLD` or `RETURNED_TO_OWNER`.
Deduplicate the owner names. Build `vehicle_ownership` with the owner's share as an explicit
percentage, so the next car onboards clean.

**Step 6 — Documents and tasks.** Both built and empty. Wire once the spine exists.

**Step 7 — Pathway wiring.** Connect `NOT_QUALIFIED` plus its reason code to
`program_applications`, `partner_referrals` and `client_journey`. The seven programs already
carry `owner_role`, `destination` and `next_action` — the routing table exists.

**Step 8 — Owner payouts.** `revenue_splits`, monthly, 70/30, repairs deducted.

**Step 9 — Dashboards.** Only after the data underneath is real.

**Rule for every step:** no cutover without a backfill and a reconciliation count.

---

## 10. Still open

Down from seventeen to six.

1. **Insurance** — may a renter bring their own policy instead of one of the six products, and what minimum must it meet?
2. **Overrides** — who may reverse an automatic decline, and is it logged as an exception?
3. **Refunds and discounts** — the manager's limit on each. Only the $250 repair limit is set.
4. **Owner terms** — minimum commitment and termination notice.
5. **Division of labour** — precisely what TMMT does versus All In One Management versus the credit partner versus the funder. This blocks the pathway and every marketing claim attached to it.
6. **Reassessment** — how often someone on a pathway is re-checked, and how many attempts before they move to nurture.

---

## Appendix — provenance

`[CONFIRMED]` facts were read from Supabase `uapxakmlwnpfsftfeezx` and this repository on
2026-09-01. `[LOCKED]` rules were stated by the owner on 2026-09-01. Row counts are
point-in-time — re-verify before acting, since other sessions may have patched the same
database.
