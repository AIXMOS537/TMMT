# DRIVE-TO-OWN — THE PRODUCT THESIS

**Owner, 2026-09-16:**

> *"My app is meant for all dealers and/or independent fleet owners running a car rental
> business that need management — and for a way to make sure the customers and clients that
> come in requesting a car can eventually get approved to own one themselves, all while
> fixing up their credit and renting at the time."*

Two buyers, one engine:

| Buyer | What they get |
|---|---|
| Dealers & independent fleet owners | Fleet, booking, screening, payments, collections — the management system |
| Their renters | A path from renting to owning, with credit built along the way |

The second is what nothing else in the market does, and it is what makes the first sticky:
a renter mid-ladder does not churn, and an operator whose customers are becoming owners
does not switch systems.

---

## THE LADDER ALREADY EXISTS — AND IT WAS BUILT CORRECTLY

`journey_checkpoints` holds **8 active rows**, seeded and ordered. This is the owner's own
definition, not an invention of this document:

| # | Gate | Means |
|---|---|---|
| 10 | `credit_education_acknowledged` | All required why-credit sections acknowledged |
| 20 | `credit_enrollment_active` | Path A or B base plan active |
| 30 | `training_path_started` | At least one core module in progress |
| 40 | `training_core_complete` | All core rebuild modules at 100% |
| 50 | `mentorship_dfy_active` | Path C $1,000 paid — **optional, see below** |
| 60 | `day_90_good_standing` | 90 consecutive days in good standing |
| 70 | `lto_eligible` | Every step TMMT controls is cleared — **ready to APPLY** |
| — | *(external)* | **A lender decides. TMMT does not, and some renters will be declined.** |
| 80 | `vehicle_turnover_complete` | Financing approved, docs signed, vehicle handed over |

### ⛔ THE LADDER DOES NOT HAND OUT CARS

**Owner, 2026-09-16:**

> *"Not everyone will get to own the car. Ideally the renter only owns the car if and when
> their credit is fixed and they can get approved for financing."*

This is the most important constraint in the document, and it is a **legal** one as much as
a product one. TMMT does not finance the car and does not approve anyone. A renter can clear
every gate, do everything asked, and still be declined by a lender.

So the engine is built so that:
- Clearing all eight gates yields **`readyToSeekFinancing: true`** — ready to *apply*.
  There is deliberately no field on `LadderPosition` that means "will own a car."
- `financingDecision` defaults to **`pending`**. Silence is never read as approval.
- `vehicle_turnover_complete` **cannot open on internal progress alone.** Even a row
  hand-marked as turned over does not complete the ladder without an approval on file.
- A decline is recorded plainly and **does not erase the work** — good standing stays met,
  `readyToSeekFinancing` stays true. They can apply again.

Two tests enforce the language itself: every gate's wording is run through the repo's
existing `findBannedPhrases` gate (which already bans *guaranteed approval*, *100% approval*
and *fix your credit*), and no wording may contain "guarantee". **Promising an approval is
the exact thing that turns this into an actionable claim.**

### Why this design is the legal one — and must stay that way

Every credit stage above is **education, enrollment or training**. Not one of them disputes
a tradeline or acts as the consumer's agent toward a bureau.

`CLAIMS_AUDIT.md` records **all seven credit legal gates CLOSED** — no attorney-approved
CROA suite, no VDACS registration, no surety bond. A ladder built on dispute letters would
be unsellable until those open. **This ladder is not.** The customer's credit improves
because they enrol, learn, and pay on time for 90 days — and, once furnishing is live,
because their rental payments become a positive tradeline. Furnishing accurate positive
data is a **furnisher** activity under FCRA, outside CROA entirely.

> ⛔ **Never add a dispute-letter stage to this ladder.** It would convert a compliant
> product into a credit repair organisation overnight. See
> `docs/commercialization/PRICING_AND_CREDIT_GUARDRAILS_2026-09-16.md`.

---

## THE STATE OF IT, VERIFIED 2026-09-16

| Fact | Value |
|---|---|
| `journey_checkpoints` | **8** — the ladder is defined |
| `client_journey` | **35 real customers**, all with `program_track` set (34 `renter`, 1 `operator_candidate`) |
| `credit_education_sections` | 3 seeded |
| `training_modules` | 8 seeded |
| `journey_checkpoint_events` | **0** |
| `credit_education_acknowledgments` | **0** |
| `credit_enrollments` | **0** |
| `training_module_progress` | **0** |
| `lto_agreements` | **0** |
| `client_journey.lto_eligible = true` | **0** |
| Longest good-standing streak | **9 days** (of 90) |

**The ladder is defined, the content is seeded, 35 customers are standing on it, and not one
checkpoint has ever been recorded for anyone.** Like `bookings`, it was designed and
abandoned at the schema layer. That is a wiring problem, not a design problem.

---

## WHAT SHIPPED TODAY — `src/lib/drive-to-own/`

The engine that reads a renter's position and says what is actually blocking them. 26 tests.

### The rule it is built around: UNKNOWN IS NOT NO

Three evidence tables are empty **and nothing writes them**. A naive reader returns 0 for
every renter, and the ladder reports 35 real customers as having *failed* their credit
education. They have not failed it — nobody has ever recorded it.

So every gate resolves to **`met` / `not_met` / `unknown`**, and `unknown`:
- **blocks** advancement (it is not a free pass), and
- is **never** reported as the renter's fault.

`queries.ts` makes the distinction by probing each source twice — does the table hold any
row at all (is the feature wired?), and does it hold rows for *this* renter. An unwired
source yields `unknown`. A wired source with no rows for this renter yields `not_met`.
**A customer's ownership date hangs on that difference.**

### Other decisions worth knowing

- **`mentorship_dfy_active` is optional.** It is "Path C $1,000 paid" — a paid upgrade.
  Treating it as mandatory would park every Path A/B renter one gate short of a car
  forever. Which tracks require it is an owner decision the database does not record; until
  it does, the safe reading is the one that cannot trap a paying customer.
- **`lto_eligible` is computed, never read from the stored column.** `client_journey`
  carries an `lto_eligible` flag; trusting it would let a stale or hand-edited row hand
  someone a car. The gates decide.
- **A signed `lto_agreements` row does not grant eligibility.** It records eligibility
  being acted on. Tested.
- **A lapse restarts the 90 days.** The counter can read high while the renter is currently
  out of standing; the gate says *consecutive*. Tested with a 400-day counter and
  `good_standing = false` — correctly refused.
- **`clearedThrough` is contiguous, not highest-met.** A renter with 120 days of standing
  but no training has not cleared the 90-day gate — there is a hole behind it. Reporting
  the highest met gate would overstate how close they are to owning the car.

---

## WHAT IS STILL MISSING TO MAKE THE LADDER MOVE

Nothing here is new design. Each is a write path into a table that already exists.

| # | Wire | Table | Why it is blocked |
|---|---|---|---|
| 1 | Record education acknowledgements | `credit_education_acknowledgments` | Nothing writes it |
| 2 | Record credit enrollment | `credit_enrollments` | Nothing writes it |
| 3 | Record training progress | `training_module_progress` | Nothing writes it |
| 4 | Emit checkpoint events as gates clear | `journey_checkpoint_events` | Nothing writes it |
| 5 | Link journey → booking | `client_journey.booking_id` | **0 of 35 populated**; waits on the booking write path |
| 6 | Per-module completion read | — | `coreModulesComplete` is refused today rather than guessed |
| 7 | Record the lender's decision | *(no table exists)* | **Nothing records financing applications or outcomes.** `financingApproved` is hard-wired to null until a source exists — it must never be derived from internal progress |
| 8 | Buyout / sale terms | `lto_agreements.weekly_buyout_cents` | ⛔ **Owner decision** — and see the conflict note below |
| 9 | Rent-to-Credit furnishing | — | ⚖️ Counsel on furnisher agreements + e-OSCAR ($90) |

### ⚠️ A CONFLICT TO RESOLVE — lease-to-own vs third-party financing

Checkpoint 70 is named `lto_eligible` and `lto_agreements` carries `weekly_buyout_cents`
and `term_weeks` — that schema describes **TMMT financing the car itself** (lease-to-own).
The owner's 2026-09-16 statement describes the renter **getting approved for financing**,
which is a third-party lender.

These are different businesses. Financing it yourself makes TMMT a creditor — Reg Z / TILA
disclosure, state lender or rent-to-own licensing, repossession law. Sending the renter to a
lender avoids all of that and is what the owner described.

**The code follows the owner's statement**, and the schema naming is treated as legacy. If
lease-to-own is genuinely still on the table, that is a much larger legal conversation than
this ladder, and it needs counsel before any buyout figure is set.
