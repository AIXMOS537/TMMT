# TMMT OS — OPERATING SOP

**Who this is for:** anyone who touches the app. Owner, desk staff, operator, vendor.
**Written 2026-09-16.** Every screen path, row count and rule below was read from the live app
and the production database, not from a plan.

> **Why this document exists.** Before it, `docs/sops/` held three SOPs — credit guidance, funding
> handoff, operator network — and **not one of them referenced a single screen in the app.** They
> are policy documents. There was no procedure telling a human how to actually operate TMMT OS.
> This is that procedure.

---

## 0. THE ONE THING THAT TIES IT ALL TOGETHER

TMMT OS looks like four separate products. It is one machine with one output: **a client who
arrives renting and leaves owning.**

`journey_checkpoints` holds the owner's own definition of that path — 8 ordered gates, seeded,
with 35 real clients standing on them:

| # | Checkpoint | Which part of the app drives it |
|---|---|---|
| 1 | Credit education complete | Cube · **Learn** face → `/learn/consent`, `/learn/onboarding` |
| 2 | Credit enrollment active | Cube · Learn → `/credit-funding` *(legally gated)* |
| 3 | Training started | Cube · Learn → `/learn/dashboard`, `/pocket/academy` |
| 4 | Core training complete | Cube · Learn → `/learn/products`, `/operator/training` |
| 5 | Mentorship DFY active | Cube · **Work** face → `/work/program`, `/work/review` |
| 6 | **90-day good standing** | **Rentals** → payments, tickets, `/do-not-rent` |
| 7 | LTO eligible | Client Desk → readiness, `lto_agreements` |
| 8 | Vehicle turnover complete | **Rentals** → `/bookings`, handover, title |

**Read the table again.** Checkpoint 6 — the one that decides everything — is earned in the
**rental** business, not the credit business. A client earns ownership by renting well: paying on
time, no unpaid tolls, no do-not-rent events. That is why rentals and the desk are not two
products. Rentals is where the client *proves* it; the desk is where it is *recorded*; the Cube is
where they *learn* it.

> ⚠️ **The hard rule, already enforced in code:** clearing checkpoints 1–7 does **not** produce a
> car. A lender decides financing, not this app. Checkpoint 8 never opens on internal progress
> alone. Never tell a client the app will get them approved.

---

## 1. WHERE TO WORK — THE FOUR FACES

One deployment, four faces (`CUBE.md`). Which face you use is decided by who you are, not by what
you feel like.

| Face | Path | Who | What it is for |
|---|---|---|---|
| **Learn** | `/learn/*`, `/pocket/*` | Client, operator | Education, training, consent, documents |
| **Work** | `/work/*` | Staff, supervisor | Programme review, approvals, admin |
| **Fleet** | `/bookings`, `/interfaces/vehicles`, `/inspections`, `/maintenance`, `/insurance` | Desk, dealer | The cars and the rentals |
| **Command** | `/command/*`, `/desk`, `/dispatch` | Owner, desk | Running the day |

---

## 2. DAILY SOP — DESK STAFF

Do these in order. It takes about fifteen minutes.

1. **`/command`** — read the hub. Anything red gets handled before anything new.
2. **`/leads`** — every new lead gets a first touch the same day.
   ⚠️ Check `/do-not-rent` **before** any outreach. 12 people are barred.
3. **`/background-checks`** — work the queue. 299 records.
   A renter cannot be sold coverage until their check is approved — the app enforces this, but
   know it, because "no coverage offered" is not a bug.
4. **`/bookings`** — the Rental Board. See §3.
5. **`/tickets`** — 308 open records.
   ⚠️ **`requested_by_customer` holds STAFF names, not renters.** It records who raised the
   ticket. Do not tell a renter they owe a toll based on that column.
6. **`/va-queue`** — the AI task queue. Escalations only; do not bulk-action it.
7. **`/money`** — close the day against the ledger.

---

## 3. SOP — RENTING A CAR (`/bookings`)

**The Rental Board is the only place a rental starts.**

1. Set **Pick up** and **Return**, press **Check the lot**.
2. Read all three sections. They mean different things:
   - **Available** — free and priced. Bookable now.
   - **Free, but cannot be priced** — the car is available and you must **not** rent it until it
     has a price. Fix the fleet record first.
   - **Not available** — with the reason: already booked, Under Maintenance, Coming Soon, Retired.
3. On each card, check **which rate won**:
   - *"Car's own posted rate"* — correct, this is the real price.
   - *"Tier rate card"* — the car has no posted price of its own. **Verify before quoting.** The
     tier card is known to be wrong for this fleet (see §7).
4. **Place hold** → renter name, email, phone.

### What a hold is, and is not
A hold **reserves the car and records the price**. It does **not**:
- charge a card · take a deposit · send the renter anything · produce a signed agreement ·
  release the car from the lot

Those are separate, deliberate, human steps. `insurance_verified` and `lot_release_approved`
stay **false** until a person sets them.

> ⚠️ **Two people can currently hold the same car at the same instant.** The database constraint
> that makes that impossible is written and proven but **not yet applied** (§8). Until it is,
> **reload the board before placing a hold**, and if you see *"someone booked that car a moment
> before you"*, believe it.

### Putting a car on the board
`/bookings` → **Put a car on the board**. Only cars already there can be rented — the fleet list
and the bookable list are different things.

Pick the **tier** (economy / mid / luxury). **This is a pricing decision, not data entry:** tier
decides which rate-card row the car can match and which coverage it is sold.

- ❌ Do not take the tier from `vehicle_class` on the fleet record. 3 of 43 cars have one and
  **all three are wrong** (a Tesla Model 3 is filed as `sport_bike`).
- ❌ A car with no posted weekly price will be **refused**. Price it on the fleet record first.
  That is correct behaviour, not an error.

---

## 4. SOP — THE CLIENT DESK

The desk is where the *relationship* lives, while `/bookings` holds the *car*.

1. **`/customers`** — 35 active clients.
2. **`/cases`** — one case per issue. Status history is kept; use it instead of memory.
3. **`/command/desk`** and **`/desk`** — the working queue.
4. **`/command/handoffs`** — moving a client between lanes or operators.
5. **`/command/outbox`** — drafted client messages.

> ⚠️ **Nothing sends itself.** Every customer-facing message is held for approval by design. An
> AI-drafted SMS reply is stored as a draft, not delivered, unless the org is explicitly
> allow-listed. If a client says they never heard back, check the outbox before blaming a rail.

### Recording a checkpoint
When a client clears one of the 8 gates, record it. An unrecorded checkpoint reads as **unknown**,
and the engine treats unknown as blocking — correctly. It will **not** guess in the client's
favour, and it will **not** report them as having failed something nobody ever recorded.

---

## 5. SOP — CREDIT (read before touching anything credit-shaped)

**Seven legal gates are CLOSED** (`CLAIMS_AUDIT.md`): no attorney-approved CROA suite, no VDACS
registration, no surety bond.

### ⛔ Never do these — they are the regulated act itself under CROA §1679a
- Write, generate or send a dispute letter for a client
- Act as a client's agent toward a bureau, creditor or furnisher
- Bulk letters, mail or certified-mail rails, Power-of-Attorney notarisation
- Promise a score outcome, a deletion, or a timeline

### ✅ Allowed today
- **Education** — explain how credit works, from `/learn/*`
- **Referral** — hands-on credit work goes to **Khan Strategies LLC**. That referral structure is
  the entire basis on which the disclaimer holds.
- Showing a client **their own** report, with no dispute recommended and no letter drafted
- **Underwriting our own product** — using a score to set our deposit, rate or mileage cap

If a client asks you to fix their credit: *"We don't do credit repair here. We teach it, and we
refer the hands-on work to a licensed partner."* Then log it and move on.

---

## 6. SOP — WHAT NEEDS THE OWNER

Never do these without Taha's explicit yes. They are gated in code and must stay gated.

| Action | Why |
|---|---|
| Charging a card, taking a deposit, paying a commission | Money out |
| Sending any customer message that isn't already approved | Speaks in his name |
| Signing or committing to a third party | Binds him |
| Applying a database migration | Production change — use `docs/runbooks/PRODUCTION-MIGRATION-WORKFLOW.md` and the write baton (`docs/ops/PROD-WRITE-BATON.md`) |
| Unlocking any credit/funding gate | Legal exposure |
| Deleting real data | Irreversible |

Collecting money **owed to** TMMT is encouraged and needs no approval.

---

## 7. KNOWN TRAPS — the things that will bite you

Each of these is verified, current, and has cost time already.

1. **The tier rate card is wrong for this fleet.** It prices a luxury business — 5 of its 7
   make/model rules match **zero** cars, and it quotes a 7 Series at $1,550/wk against a
   $300–550/wk fleet. The car's own posted price always wins; the board tells you which was used.
2. **`fleet.vehicle_class` is not a tier.** 3 of 43 populated, all 3 wrong.
3. **`tickets.requested_by_customer` is a STAFF name.** Not the renter.
4. **Only cars on the board can be rented.** `fleet` has 43; the board had 2 until you add them.
5. **A zero-row read is never "free".** If the rate card reads back empty, the app refuses to
   quote rather than quoting $0. If you see a refusal, something is wrong upstream — do not
   work around it.
6. **An unrecorded step is unknown, not "no".** Applies to checkpoints, inspections, consent.
7. **Inspection photos are barely being taken.** 18 fleet inspections, **1** handover, **1**
   customer photo, **0** onboarding inspections. Every damage argument you lose traces back here.
   **Take the photos.**

---

## 8. STATE OF PLAY — what is not finished

Be honest with clients about these.

| Gap | Effect today |
|---|---|
| Double-booking constraint not applied | Two simultaneous holds on one car are possible. Reload before holding. |
| No deposit hold / capture | Deposits are quoted, never taken by the app. |
| No e-signed rental agreement | Paper or external. |
| No renter-facing portal | Renters cannot self-serve; they contact the desk. |
| No mileage/fuel overage billing | Overages must be caught by hand. |
| No telematics / GPS / keyless | Location and immobilisation are manual. |
| Revenue per vehicle not available | **0 of 31** payments carry a vehicle, so per-car economics cannot be computed yet. Bookings made on the board will fix this going forward. |

---

## 9. WHICH URL AM I ON?

This matters more than it sounds.

| URL | What it serves |
|---|---|
| `https://tmmt-ops.vercel.app` | **Production** — tracks `master`. |
| `https://tmmt-ops-git-feat-client-and-org-scoped-visibility-aixmos537.vercel.app` | Preview — tracks the feature branch. |
| `http://localhost:3000` | Your machine. `npm run dev`. |

> ⚠️ **A feature is only on production once its branch is merged to `master`.** A preview URL
> showing a screen proves nothing about what a client sees. Check which branch production is on
> before reporting a feature live.

---

## 10. IF SOMETHING LOOKS WRONG

1. **Do not work around it.** A refusal in this app is almost always deliberate.
2. Check §7 first — it is probably one of the known traps.
3. `npm run check-env` for environment gaps.
4. Report what you actually saw, including the exact wording of any refusal.

**Never**: grant a permission to make an error go away, disable a gate, or edit the database by
hand to unstick a screen. Every one of those has caused a worse outcome here than the original
problem.

---

*Related: `docs/runbooks/END-TO-END-TEST.md` (how to drive the app end to end) ·
`docs/commercialization/COMPETITIVE_TEARDOWN_2026-09-16.md` (feature-by-feature vs the market) ·
`docs/commercialization/PRICING_AND_CREDIT_GUARDRAILS_2026-09-16.md` (pricing + CROA fence) ·
`CUBE.md` (the four faces).*
