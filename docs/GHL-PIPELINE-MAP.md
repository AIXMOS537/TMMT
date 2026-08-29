# GHL pipeline map — Rentals sub-account

> Pulled live from GoHighLevel on 2026-08-27 via `listPipelines()`. Location
> `Xcd8DZt5T4GWnBtBEC5V` — the rentals sub-account, and the only one that has
> ever delivered a webhook into the database (all 1,637 `ghl_contacts` rows).
> `GHL_RESTORATION_LOCATION_ID` (`EaRP…`) is a second configured sub-account and
> is not mapped here yet.

Stage ids are stable and safe to reference in code. Re-pull rather than edit by
hand — `listPipelines(locationId)` is the source of truth.

---

## Which pipeline is actually used

Opportunity counts, pulled the same day. This settles what the names do not:

| Pipeline | Opportunities | What it really is |
|---|---:|---|
| **UBER/LYFT** | **676** | The renter pipeline. All the volume is here. |
| Joint Venture Leads | 74 | Owners putting a car into the fleet |
| 2013 And Newer | 17 | Owners wanting to partner — the vehicle-year intake filter |
| Testing Car Pro Pipeline | 1 | A test, despite modelling the whole lifecycle |
| Active Customers | 1 | Effectively unused |

Two consequences:

1. **"Testing Car Pro Pipeline" is not live** — one opportunity. So the only
   pipeline that models the rental lifecycle end to end is the one nobody uses,
   and the pipeline holding every real renter stops at "Closed" without ever
   representing the rental itself.
2. **`2013 And Newer` is partner-side, not sales.** It and Joint Venture Leads
   are two halves of one intake: owners with a qualifying vehicle who want to
   partner. It is not a renter pipeline and must not be treated as one.

### The stall

Where the 676 renters sit:

| Stage | Count |
|---|---:|
| New Lead | 7 |
| **Verification Form Sent** | **377** |
| **Verification Form Received** | **286** |
| Qualified | 5 |
| Proposal Sent | 1 |
| On the Road | 0 |
| Closed | 0 |

Status: 669 open, 2 won, 2 lost, 3 abandoned.

**98% of every renter lead is parked at verification.** 286 people returned the
form and were never advanced. Nobody has ever reached "On the Road".

Meanwhile `background_checks` holds the decisions the pipeline never received —
81 `Eligible`, 69 `Need Manager's Review`, 24 `Not Eligible`. The database says
81 people are approved; the pipeline shows 5 past verification. Those two facts
cannot both describe a working handoff (they have not been joined person by
person — that join is the next step, not a completed check). Closing this gap is
worth more than any new stage.

`background_checks.verification_form_submitted` is null on all but one row, so
the app's own flag was never used: the fact of a returned form lives only in the
GHL stage, and the outcome lives only in the database.

---

## The app and GHL are already parallel models of one process

This is the whole reason "a layer on top of GHL" is the right framing rather
than a sync: the pipelines below and the app's own tables describe the same
lifecycle, in the same order, from two sides.

| GHL stage | App equivalent |
|---|---|
| Pending Background Check | `background_checks.background_check_status = 'Pending'` |
| Waitlisted | `waitlist` (104 rows) |
| Approved / Disqualified | `background_checks.eligibility_status` — `Eligible` / `Not Eligible` |
| Rental Completed | the `rental-completed` gate that `ready-for-aixmos` depends on — see `GHL-PIPELINE-SETUP.md` |
| Verification Form Sent / Received | `background_checks.verification_form_submitted` |
| Current Customer | `active_customers` |
| Joint Venture Leads (whole pipeline) | `BLOCK_JV_NOT_OUR_CONSENT` in `v_outreach_book` — 13 leads whose consent belongs to the partner, not to us |
| UBER/LYFT (whole pipeline) | `programs.rentals_rideshare` — its `match_keywords` are uber, lyft, rideshare, doordash, gig driver |

---

## 1. Testing Car Pro Pipeline — `Bm4xMGglRbTNh5ZEEndX`

The full rental lifecycle, and the one the app's rental flow actually
corresponds to — but **one opportunity, so it is genuinely a test.** The design
is right and the volume is elsewhere. Treat these stages as the blueprint for
the merged renter pipeline below; do not reference these ids as live.

| # | Stage | Id |
|---:|---|---|
| 0 | 🆕 New Lead - Interest Submitted | `3fdd3cda-cfa1-4d33-abe7-df1973e12586` |
| 1 | 🕵 Pending Background Check | `2cf39dbe-3ec4-4d43-aa8b-c8a056320e6c` |
| 2 | ⏳ Waitlisted | `059665cc-2ae0-418d-9aed-77dc5c82a0c1` |
| 3 | ☑️ Approved | `9c942415-b3e2-4540-91e4-47296f3c2673` |
| 4 | ❌ Disqualified - Do not Reapply | `4f18b116-e860-4892-95e4-135bd21e2704` |
| 5 | ✅ Car Available | `e5df2486-f558-48b7-b18e-445f80620ca1` |
| 6 | 🚗💨 Rental in Progress | `58019153-55e4-4cdd-904e-9a3ada52bf77` |
| 7 | 🔄🚗 Pending Return | `781a4ca1-4193-43c1-8f8d-630300835007` |
| 8 | 🎉✔️ Rental Completed | `3abe6fa1-7d20-4a92-9f38-9735bfbd05fc` |
| 9 | 🎉✔️ Nurture | `330ece15-760c-4f39-87f5-36af28c5db4a` |

**Note on "Disqualified - Do not Reapply".** That stage and the AIXMOS prequal
lane disagree. `decidePrequalRoute()` routes a profile decline *to AIXMOS* to be
fixed and re-applied; this stage says never come back. Whichever is right, they
should not both be running — see `GHL-PIPELINE-SETUP.md` Phase 0.

## 2. UBER/LYFT — `6HjUYeJhUaAyoit7lCSt`

Rideshare drivers. Matches the `rentals_rideshare` program in the routing engine.

| # | Stage | Id |
|---:|---|---|
| 0 | New Lead | `4bf50ab1-8adc-4f3a-bc64-3b59e225b2f8` |
| 1 | Verification Form Sent | `5f0f3bf4-7720-437f-9f1c-68bb7d740be7` |
| 2 | Verification Form Received | `f446c3e4-1328-46ed-b340-97b28986c0a6` |
| 3 | Qualified | `9fc1a290-26d6-4821-ba29-ddf25bad5697` |
| 4 | Proposal Sent | `f445c66d-7aa9-46cf-91df-f87fee7e4361` |
| 5 | Negotiation | `cb8ad766-50cb-4d99-91d5-505f7f38435e` |
| 6 | On the Road | `c0a52269-54b2-4320-a4d2-a2211c6c8966` |
| 7 | Closed | `68ebfa44-a90e-47b5-af97-b8da4282b6b6` |

## 3. Joint Venture Leads — `jniZsSyAgAYo8g2Iaijf`

Vehicle owners putting a car into the fleet — not renters. This is the pipeline
behind the `BLOCK_JV_NOT_OUR_CONSENT` gate: their consent belongs to the JV
partner, so they must never enter operator rotation.

| # | Stage | Id |
|---:|---|---|
| 0 | New Lead | `de6bd941-3fc8-4997-ac62-72f0bf5a7b6a` |
| 1 | Lead Reply | `3072dc4a-03b6-4086-a8a3-7b50a3bc0833` |
| 2 | Book Appointment | `886553b4-53c1-486b-b087-3a8afd7f6d6c` |
| 3 | Vehicle Inspection | `693c3abd-9be5-47cc-a9ef-433995a72f94` |
| 4 | Pass Inspection | `a73d497d-d991-4f5e-8051-fd8396d13d3e` |
| 5 | Fail Inspection | `1939858d-d056-4699-9275-613f42527b43` |
| 6 | Install Tracker | `c5e57273-c3db-49d1-83f6-ee70dd9bf8ad` |
| 7 | Onboard to Fleet | `1d266d41-e20b-41c8-84a7-f032f1f77741` |

Stages 3–7 line up with `vehicle_onboarding_inspections`, `fleet_car_inspections`
and `unit_locations` (the tracker).

## 4. 2013 And Newer — `JK8AuiCz0Z9XDKYXH7vX`

**Partner intake, not sales.** Owners with a qualifying vehicle (2013+) who want
to partner. The front half of the same funnel Joint Venture Leads completes —
this qualifies the car, that onboards it. 17 opportunities.

| # | Stage | Id |
|---:|---|---|
| 0 | New Lead | `b1b5ff55-be70-4e5b-adbc-dd9a671eccac` |
| 1 | Contacted | `7f051d12-4cea-42e6-856c-d29c99f7938f` |
| 2 | Proposal Sent | `0648ca97-d442-4ac1-8bb9-88acde17777f` |
| 3 | Closed | `4b98451b-4978-4f25-afad-767543e07205` |

## 5. Active Customers — `8f2ynTkseQiX3vbgwBAA`

Post-rental. Corresponds to `active_customers`.

| # | Stage | Id |
|---:|---|---|
| 0 | Current Customer | `529f3c25-865f-488f-8657-b5b2cdababa2` |
| 1 | Contacted | `65db37a8-b409-4de7-9d4f-8e8c3c1f54ed` |
| 2 | Proposal Sent | `4206f9f2-6f2d-4db8-8345-d7062a501ac0` |
| 3 | Closed | `b3b0e6c1-b59c-47c1-8c37-dd9bff842351` |

---

## Proposed: one renter pipeline

Today a renter's life is split across three pipelines and finishes in none of
them. UBER/LYFT holds the intake and stops at "Closed"; Testing Car Pro models
the rental but is unused; Active Customers holds the after. Below merges them,
keeping every stage that carries real volume and adding only what is missing.

Ordered by what actually happens to a person:

| # | Stage | Comes from | Why it earns a place |
|---:|---|---|---|
| 0 | New Lead | UBER/LYFT · Testing | Where all 7 current new leads sit |
| 1 | Verification Form Sent | UBER/LYFT (377) | The single busiest stage — keep the name people know |
| 2 | Verification Form Received | UBER/LYFT (286) | Keep, but it must stop being terminal |
| 3 | **Under Review** | *new* | **The missing stage.** `background_checks` has 69 in `Need Manager's Review` with nowhere to show it. Without this, "Received" absorbs both "waiting on us" and "we are working it" — which is how 286 people disappeared |
| 4 | Approved | Testing (`☑️ Approved`) | Mirrors `eligibility_status = 'Eligible'` — 81 people who are already approved and cannot be seen |
| 5 | Waitlisted — No Car | Testing (`⏳ Waitlisted`) | Approved but no vehicle. Distinct from waiting on paperwork; `waitlist` holds 104 |
| 6 | Car Available | Testing (`✅ Car Available`) | Supply met demand — the handoff to booking |
| 7 | Rental in Progress | Testing (`🚗💨`) | The revenue stage. Nothing in UBER/LYFT represents it |
| 8 | Pending Return | Testing (`🔄🚗`) | Where damage, late fees and recovery live |
| 9 | Rental Completed | Testing (`🎉✔️`) | **Gates `ready-for-aixmos`** — the AIXMOS upsell cannot fire without it |
| 10 | Nurture | Testing (`Nurture`) | Repeat business; feeds `LANE_REENGAGE` in the outreach book |

Branches off the main line, not stages in it:

| Branch | Replaces | Why |
|---|---|---|
| **Out of Area** | — | 49 people are `out of radius`. Not a decline and not a credit lead — they belong on the market-expansion hold, tagged `market-waitlist` |
| **Declined — Prequal** | `❌ Disqualified - Do not Reapply` | 24 are `Not Eligible` on their own profile. The prequal lane exists to fix exactly that and send them back; "do not reapply" contradicts a lane already shipped in #173 |

Dropped: **Proposal Sent**, **Negotiation** (1 opportunity between them — a
rental is not a negotiated sale) and **Qualified** (superseded by Approved).

Three stages carry every renter today — 0, 1, 2. Everything from 3 onward is
inventory the business already has and cannot currently see.

## Open questions before wiring stage ids into code

1. ~~Is "Testing Car Pro Pipeline" the live one?~~ **Answered by the counts: no.**
   One opportunity. Its stages are still the right design — they are the basis
   of the merged pipeline above — but nothing may reference its ids as live.
2. **Three pipelines start with "New Lead".** The routing engine decides which
   program a lead belongs to (`classify_program()`); that decision needs to pick
   the pipeline too, or leads land in whichever one a workflow happens to touch.
3. **"Disqualified - Do not Reapply" vs the prequal lane.** Resolve before
   Phase 0 goes live, or the same person gets both a permanent no and an
   invitation to fix their profile and come back.
