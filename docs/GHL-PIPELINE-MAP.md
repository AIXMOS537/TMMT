# GHL pipeline map — Rentals sub-account

> Pulled live from GoHighLevel on 2026-08-27 via `listPipelines()`. Location
> `Xcd8DZt5T4GWnBtBEC5V` — the rentals sub-account, and the only one that has
> ever delivered a webhook into the database (all 1,637 `ghl_contacts` rows).
> `GHL_RESTORATION_LOCATION_ID` (`EaRP…`) is a second configured sub-account and
> is not mapped here yet.

Stage ids are stable and safe to reference in code. Re-pull rather than edit by
hand — `listPipelines(locationId)` is the source of truth.

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
corresponds to. **Named "Testing" — confirm it is the live pipeline before
wiring anything to these ids.**

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

Generic four-stage sales pipeline, vehicle-year segmented.

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

## Open questions before wiring stage ids into code

1. **Is "Testing Car Pro Pipeline" the live one?** Everything in the app's
   rental flow maps to it, and nothing maps to the other four as cleanly. If it
   is live, it should be renamed; if it is not, the real one has not been found.
2. **Three pipelines start with "New Lead".** The routing engine decides which
   program a lead belongs to (`classify_program()`); that decision needs to pick
   the pipeline too, or leads land in whichever one a workflow happens to touch.
3. **"Disqualified - Do not Reapply" vs the prequal lane.** Resolve before
   Phase 0 goes live, or the same person gets both a permanent no and an
   invitation to fix their profile and come back.
