# TMMT OS — COMPETITIVE TEARDOWN & BUILD ROADMAP
**Date:** 2026-09-16 · **Scope:** car-rental apps + credit-repair apps → what to build next
**Method:** web scrape of live competitor feature pages, checked against actual TMMT OS code
AND against the live production database.

---

## ⚠️ CORRECTION TO THE FIRST VERSION OF THIS DOCUMENT

The first draft said **"no bookings table exists."** That was WRONG, and it was wrong because
the check was a `grep` over `supabase/migrations/*.sql`, which missed every table not created
by a `create table` statement in those files. The authoritative check — listing the live
production schema — says the opposite.

**What is actually true, verified against production 2026-09-16:**

| Table | Rows | Code that touches it |
|---|---|---|
| `bookings` | 0 | **none** — 4 grep hits are prose in comments/descriptions |
| `rental_pricing_rules` | **10 seeded, all active** | **none** |
| `rental_insurance_products` | **6 seeded, all active** | **none** |
| `vehicle_damage_reports` | 0 | **none** |
| `vehicle_media` | 0 | **none** |
| `vehicle_events` | 0 | **none** |
| `lto_agreements` (lease-to-own!) | 0 | read once, never written |
| `contract_instances` | 0 | **none** |
| `fleet` (the real inventory) | **43** | live |
| `background_checks` | **299** | live |

`bookings` is not a stub. It already carries `quoted_daily_cents`, `quoted_weekly_cents`,
`quoted_deposit_cents`, `pricing_rule_id`, `vehicle_tier`, `insurance_coverage_source`,
`insurance_verified`, `lot_release_approved`, and a two-stage
`manager_discount_approved_by` / `supervisor_discount_approved_by` approval chain. Somebody
designed a complete rental underwriting record, wired RLS for it, seeded the rate card — and
never connected a single line of application code.

**So the diagnosis is not "build a booking engine." It is "the booking engine was built and
abandoned at the schema layer."** That is a far cheaper problem: this is wiring, not building.
The original P0 list below has been re-scoped accordingly.

---

## 0. THE HEADLINE — THE FIELD IS CLEARING

Verified 2026:
- **HyreCar is DEAD.** Wound down after acquisition. No longer operates. Its entire niche —
  renting cars to Uber/Lyft drivers — is **unowned**.
- **Getaround ended US operations** (Feb 2025). **Kyte shut down.**
- **Turo actively prohibits** commercial/rideshare driving on most listings.
- What's left in the gig-rental lane: RideshareRenter, DriveWhip, Uber-via-Hertz. Thin. Regional.
- Credit side: **"the CFPB is retreating from 26 enforcement actions"** — the largest regulatory
  vacuum in a decade. Compliance-first operators are taking share while sloppy ones churn.

**Read:** TMMT's exact lane (gig-driver rentals) lost its category leader and nobody replaced it.
Asset-light TMMT OS sold to the fleet owners who are now stranded = the play.

---

## 1. THE REAL GAP — AND THE MONEY BUG I FOUND WIRING IT

The schema is there. What is missing is the code between it and the screen. I built the first
piece of that wiring today (`src/lib/rental-pricing/`, 47 tests) and hit a live money bug
partway through:

**`rental_pricing_rules` does not match the fleet it is supposed to price.**

- The seeded card says economy = **$280/wk**, mid = $470, luxury = $950.
- The actual fleet, read from `public.fleet` (43 rows): real posted weekly prices run
  **$300 → $550**, and `lowest_possible_price` runs **$300 → $450**.
- The cheapest real car on the lot is **$300/wk**. The card's economy floor is **below it.**

Wiring the rate card straight through — which is exactly what the first version of this
document told you to do — would have **undercut the real rate on every vehicle in the fleet,
by $20 to $270 a week**, silently, with a passing test suite over it.

The fix shipped with the code: the car's **own posted price wins**, the tier card is only a
fallback for an unpriced car, and `enforceFloor()` **refuses** any quote below that car's
recorded `lowest_possible_price` rather than quietly clamping it upward — so the attempt stays
visible instead of leaking.

**Second trap, same area:** `fleet.vehicle_class` is unusable as a price tier. Only **3 of 43**
rows have one, and **all three are wrong in production right now** — a Tesla Model 3 filed as
`sport_bike`, a 2013 Corolla as `sport_car`, a Model Y as `sport_suv`. Any code that derives a
price from that column misprices the fleet in both directions. The engine refuses to read it.

### What now exists — `src/lib/rental-pricing/`, 77 tests, full suite 1785 passing
- **`quote.ts`** — most-specific-wins rule resolution, weekly-first billing (gig drivers rent by
  the week), partial-week capping, insurance gated on background approval, deposit kept out of
  the subtotal but inside due-now. Returns `null` rather than a price when nothing matches.
- **`fleet-rate.ts`** — reads the car's real posted price; `enforceFloor()` **refuses** (never
  silently clamps) any quote below that car's recorded `lowest_possible_price`.
- **`availability.ts`** — half-open interval overlap so same-day turnaround stays legal,
  blocking-status vocabulary (only `hold`/`confirmed`/`active` hold a car; cancelled and
  completed release it), fleet-status gating, and refusal on invalid intervals.
- **`create-booking.ts`** — the first code in the repo that writes `bookings`. Writes a **hold**,
  never a confirmation, because it does not take money. Catches SQLSTATE `23P01` and turns a
  lost race into a clean conflict instead of a 500.
- **`queries.ts`** — DB reader, fails closed three ways. A zero-row read is a refusal, never a
  free rental. RLS was verified permissive *first*, because a policy-less table returns zero
  rows instead of erroring.

### Wired to a real caller — `POST /api/rental/quote`
A library nothing calls is not shipped; that is the exact failure this document
diagnoses. The engine now has a staff-authed, **read-only** caller: 10 tests covering
401 for anonymous, 403 for non-staff (neither ever reaches the rate card), 400 on a bogus
tier, 422 on every refusal path, and the floor guard returning 422 rather than a cheap price.
No owner-approval gate needed — it sends nothing, charges nothing, writes nothing. The moment
a path wants to confirm or capture, that routes through `shared/owner-approval-gate/`.

### Two migrations written, NOT APPLIED
I attempted to apply the double-booking constraint to production and **the permission
classifier blocked it.** That block was correct: this repo's own `CLAUDE.md` says
*"Never migrate via the dashboard"* and *"`success: true` is NOT proof the state changed —
the postcondition query is,"* pointing at `docs/runbooks/PRODUCTION-MIGRATION-WORKFLOW.md`.
An ad-hoc MCP call is the same shortcut that caused the 214-applied-vs-41-in-repo drift.
Both files therefore sit in `supabase/migrations/` awaiting that runbook:

- **`20260916235900_bookings_no_double_booking.sql`** — a GiST `EXCLUDE` constraint so one
  car cannot be held by two renters, plus a `status` CHECK and a calendar index.
  **Proven, not assumed:** run against a probe table on the disposable `tmmt-e2e-throwaway`
  project with each gate *watched refusing* — overlap rejected with `23P01`, `status='banana'`
  rejected, backwards interval rejected, while same-day turnaround, a cancelled overlap and a
  different car on identical dates were all correctly allowed. Probe dropped after.
  Pre-flight re-verified on production: `bookings` = 0 rows, 0 bad intervals, 0 unknown
  statuses — it will apply cleanly.
- **`20260917000100_fleet_to_vehicles_bridge_resume.sql`** — ⛔ **needs your tier decision.**
  `bookings.vehicle_id` FKs to `vehicles` (**2 rows**) while `fleet` holds **43**, so booking
  can reach 2 of 43 cars. Dry-run done read-only: the SELECT half returns exactly 26 correct
  rows, every one at or above its own floor. Only the INSERT was withheld.

### Security sweep (Supabase advisors)
Ran clean against expectations. The 16 `rls_enabled_no_policy` findings are the deliberate
service_role-only pattern this repo documents in its own migration comments. `eval_money_rails`
being anon-callable looks alarming but is **not** a hole — it is your evals harness, token-gated
by a SHA-256 comparison that raises on mismatch, read-only, and it carries a canary check
designed to FAIL. Two genuine low-severity items worth queuing: `pg_net` and `vector` are
installed in the `public` schema, and **leaked-password protection is disabled in Supabase Auth**
(one toggle, free, checks against HaveIBeenPwned).

### ⚠️ The inventory reality, which no amount of code fixes
Of all 43 cars, exactly **two** are `vehicle_status = 'Available'`, and only one of those has a
price (2017 Toyota Camry, $400/wk). Everything else is Rented, Under Maintenance, Coming Soon or
Retired. The booking engine being real does not by itself create sellable inventory.

## 2. CAR-RENTAL SIDE — GAPS THAT COST MONEY

Scraped from Coaxsoft, AiRentoSoft, Navotar, Rently, Coastr, Vulog, DAMAGE iD, Turo host tools.
The 2026 table stakes, ranked by what earns TMMT cash fastest:

### P0 — BUILD FIRST (these are revenue, not polish)

1. **Reservation + availability engine.** Real-time calendar, instant confirm, auto hold,
   hourly *and* weekly terms (gig drivers rent weekly, not daily). This is the single biggest
   hole — there is no `bookings` table. Everything else bolts onto it.
2. **Deposit authorization holds + auto-capture at return.** Competitors auth at pickup,
   capture at return, auto-generate the receipt. TMMT currently has no hold mechanism =
   every damage/overage dispute is eaten.
3. **Automated overage billing from odometer/fuel.** Mileage and fuel overages calculated
   from a reading and invoiced automatically. Gig drivers blow mileage caps constantly —
   this is pure recovered margin sitting on the floor.
4. **Digital rental agreement + e-signature + license verification at booking.** Validate the
   DL against a database, e-sign the agreement, log condition photos. Kills the counter.
   (Hertz UAE cut walk-in wait by 37 minutes doing exactly this.)

### P1 — THE DEFENSIBLE LAYER

5. **AI damage detection.** Computer vision comparing pickup vs. return photos, auto-flagging
   new damage with a timestamped report.
   🔴 **CORRECTION (2026-09-16):** the first draft called this "the cheapest high-value win —
   the data is already being captured." **It is not.** Production row counts:
   `vehicle_handover` = 1, `customer_inspection_photos` = 1, `vehicle_onboarding_inspections` = 0,
   `fleet_car_inspections` = 18. There are no pickup/return photo PAIRS to diff. The forms exist;
   the habit of using them does not. Building the diff now means building on sand — the same
   mistake this document already made once. **Fix the capture habit first, then diff.**
   The destination tables (`vehicle_damage_reports`, `vehicle_media`) are already built and empty.
6. **Telematics / OBD-II:** GPS, remote immobilize, fuel + mileage auto-read, geofence alerts,
   unauthorized-use detection. For gig rentals this is repossession insurance — and TMMT
   *just lived through a repo*. Never again without knowing where the car is.
7. **Keyless / digital key** (BLE + NFC, offline-capable). Contactless handover = no meet-up,
   which is the #1 operator time sink.
8. **Dynamic pricing.** Demand/time/location-responsive rates. Turo shipped this to hosts in
   2026 with a 90-day future-price chart. Weekly gig rates are currently flat everywhere —
   easy edge.

### P2 — SCALE

9. Predictive maintenance from telematics (TMMT has `admin/maintenance` — feed it live data).
10. Fleet utilization / revenue-per-vehicle dashboards (partially there in `scorecard`).
11. Channel sync + roadside-assist request in-app.
12. AI booking agent (WhatsApp/SMS) — Rently and AiRentoSoft both lead with this now.

---

## 3. CREDIT-REPAIR SIDE — WHAT DISPUTEFOX / CRC / SMARTCREDIT HAVE THAT WE DON'T

> 🔴 **READ THE FENCE BEFORE READING THE LIST.**
> This section is an accurate feature **scrape**. It is **NOT a build list.**
> `CLAIMS_AUDIT.md` records all seven legal gates **CLOSED** — no attorney-approved CROA
> suite, no VDACS registration, no surety bond. Building the letter engine, the mail rail,
> the tone-tiered AI letters, the furnisher libraries or PoA notarization **makes TMMT a
> credit repair organization under CROA (15 U.S.C. §1679a) with none of the required
> apparatus** — and collapses the Khan Strategies referral structure the disclaimer rests on.
> Roughly ⅓ of the items below are buildable today; ⅔ are gated.
> **Full gated-vs-safe split: `docs/commercialization/PRICING_AND_CREDIT_GUARDRAILS_2026-09-16.md`.**
> The buildable third contains the only genuinely differentiated item here (Rent-to-Credit).
> Build the moat, skip the commodity.

TMMT has `credit-dispute` + `import`. That's a stub next to the market. Full DisputeFox
feature scrape is the benchmark. The gaps that matter:

### The dispute engine itself
- **Bulk letter generation** — "hundreds of letters in one shot," per-agency (bureau vs.
  creditor vs. furnisher), auto-inserted creditor addresses, saved digital signature,
  batch print with auto envelopes and page counts.
- **AI letter writing with escalation tiers** — DisputeFox rewrites factual letters at
  escalating tones (concerned → annoyed → disappointed). Metro 2 letters generated with
  unique content each time (avoids bureau pattern-matching / "frivolous" dismissal).
- **Side-by-side old vs. new report comparison** — they call it first-of-its-kind. It's a diff.
  We build diffs. Trivial for us, high perceived value.
- **Auto-analysis on import** — negative items auto-labeled, initial analysis report
  auto-generated. Pre-loaded creditor/furnisher/dispute-reason libraries.
- **Print + mail + certified-mail tracking built in.** This is the operational moat for
  credit repair — the paper trail *is* the product. We have no mail rail.

### Client-facing
- **Branded client portal + branded mobile app** (custom domain, logo, colors), push
  notifications, two-way messaging, in-app payment + card update, document upload,
  e-sign agreements, required-docs checklist, auto score-change alerts.
- **Auto monthly progress reports** — graphical, score deltas + deletions, one-click email/SMS,
  **plus auto-generated social-media result graphics.** That last one is a growth loop, not a
  feature: every client win becomes marketing collateral automatically.

### Business rails
- Affiliate portal with **automated commission calc + payout** (PayPal/Stripe).
- Recurring billing, multiple cards on file, auto-retry on decline, card-failure alerts.
- Multi-carrier SMS redundancy (Twilio + ClickSend + Routee) — per-agent numbers.
- **2FA end-to-end** (DisputeFox markets being the only one with it), PCI DSS L1, AES-256,
  daily backups + point-in-time recovery.
- **Live video notarization for Power of Attorney** — their answer to bureau stall letters.

### What SmartCredit does that nobody copies
- **ScoreMaster:** tells the consumer *exactly how much to pay down on which card to gain N
  points*. Predictive, not diagnostic. This is the most valuable idea in the whole credit scrape.
- **ScoreBuilder:** a 120-day plan off the negative items, not just a list of them.
- **Action buttons:** consumer messages creditors directly from the app.
- Money Manager (spending/net worth) bundled with monitoring + $1M fraud insurance.
- Specialty scores surfaced: **Auto Lending**, Insurance, Hiring Risk.

**The Auto Lending score is the hinge.** SmartCredit already surfaces it. TMMT rents cars.
Nobody has connected those two facts.

---

## 4. THE MOAT — WHAT ONLY TMMT CAN BUILD

Every competitor is on one side of the line. TMMT OS is the only codebase in this teardown
that has a **rental operation and a credit engine in the same app.** Three products fall
out of that, and none of them exist in the market:

### (a) Rent-to-Credit — furnish the rental payments as a tradeline ⚖️ NEEDS LICENSED REVIEW
Rent-to-own and rental businesses are legitimate Metro 2 data furnishers. If TMMT reports
on-time weekly rental payments to the bureaus, every gig driver renting from TMMT **builds
credit by driving.** Nobody else in gig rental offers that.
- Requirements confirmed: data furnisher agreement with each bureau, ~100+ active accounts
  minimum, monthly reporting minimum, correct status/condition codes, **e-OSCAR enrollment
  ($90)** for dispute handling, documented accuracy procedures.
- **Compliance advantage:** furnishing *positive* data is not credit repair — it sits outside
  CROA entirely. It's the one credit product TMMT can ship without the legal gate that's
  currently blocking L1–L10.
- Retention effect: a driver who is mid-tradeline does not churn to a competitor.

### (b) Credit-gated rental underwriting
The credit engine already pulls reports. Use the **Auto Lending score** (SmartCredit surfaces
it) to set the deposit, the weekly rate, and the mileage cap automatically. Ties directly into
`admin/do-not-rent` and `admin/background-checks`, both already built. Turns credit data from a
side business into the rental risk model — lower defaults, lower repo risk.

### (c) Drive-to-Own ladder
Rent → build tradeline → qualify → own. That's the funnel (a) and (b) create together, and it
is the entire `credit-funding` lane pointed at a car instead of a generic loan. It also makes
the asset-light pivot honest: TMMT sells the *system that gets a driver to ownership*, not trucks.

---

## 5. BUILD ORDER (current)

| # | Ship | State |
|---|---|---|
| 1 | Quote engine on the real rate card | ✅ **DONE** — caught the money bug |
| 2 | Availability + double-booking guard (code) | ✅ **DONE** — 18 tests |
| 3 | Booking write path → `bookings` | ✅ **DONE** — writes holds only |
| 4 | Staff quote API, read-only | ✅ **DONE** — `POST /api/rental/quote`, 10 tests |
| 5 | DB `EXCLUDE` constraint | 📄 written + proven; apply via the migration runbook |
| 6 | **Rate card: retire 5 fiction rules, re-seed 3 tiers** | ⛔ **YOUR NUMBERS** — SQL ready in the guardrails annex |
| 7 | **Resume fleet → vehicles bridge** | ⛔ **YOUR TIER CALL** — unblocks 26 cars |
| 8 | Seed each new tenant's card from THEIR fleet | missing provisioning step — the defect a buyer sees first |
| 9 | Deposit auth-hold + capture | ⚠️ financial → must route through `shared/owner-approval-gate/` |
| 10 | Fix the inspection-photo capture habit | prerequisite — no photo pairs exist to diff |
| 11 | AI damage diff → `vehicle_damage_reports` | after #10, not before |
| 12 | **Rent-to-Credit furnishing** ⚖️ | ✅ outside CROA (FCRA furnisher activity) — **the moat** |
| 13 | Credit-gated rental underwriting | ✅ safe — underwriting its own product |
| 14 | Side-by-side report diff · ScoreMaster simulator | ✅ safe **only** if it drafts no letter and promises no score outcome |
| ⛔ | Bulk letters · AI dispute letters · mail rails · PoA notary | **GATED — do not build.** CROA regulated act; seven gates CLOSED |

## 6. SOURCES
Car rental: coaxsoft.com/blog/best-car-rental-and-sharing-software · airentosoft.com ·
vulog.com/digital-rental · tomorrowsjourney.co.uk (rental car software systems) ·
oyelabs.com (AI automation use cases) · turo.com/blog (dynamic pricing 2026) ·
help.turo.com (host mode) · mobokey.com (Turo alternatives 2026) ·
ridesharerenter.com (HyreCar shutdown) · ride-share.com (Getaround alternatives)

Credit: disputefox.com/features · clientdisputemanagersoftware.com (AI credit repair 2026) ·
scorepivot.com/blog/disputefox-vs-crc-2026 · scorepivot.com/blog/ai-credit-repair-software ·
bestcompany.com (SmartCredit) · metro2.switchlabs.dev · experian.com/rental-property-solutions ·
hutchinssystems.net (becoming a data furnisher) · bridgeforcedatasolutions.com (Metro 2 compliance)
