# RENT → APPROVAL — THE FULL FLOW

**Design, 2026-09-16.** From the owner's description:

> *"Rental lead comes in. If qualified they rent the vehicle. And if they choose to opt in
> to purchase a car, or just continue to rent it for however long, they will be asked to
> create a profile where they use MyFreeScoreNow to get their credit report. My system will
> assess any and all things with their profile and make a funding readiness UI within our
> app, and help us track how far along they are in their journey to get their credit fixed
> so that way they can get approved for financing."*

---

## THE FLOW

```
  1  LEAD           /forms/lead-intake ──▶ incoming_leads                      ✅ LIVE
  2  SCREEN         background_checks ──▶ bg_check_decide ──▶ decision         ✅ LIVE
  3  RENT           quote ──▶ booking ──▶ vehicle handover           ⚠️ quote ✅ / booking ✗
  4  OPT IN         "I want to own one day"  ──▶ client_journey            ✗ NO TRIGGER
  5  PROFILE        renter creates an account                          ✗ DOES NOT EXIST
  6  PULL           renter pulls own report via MyFreeScoreNow      ⚠️ importer ✅ / self-serve ✗
  7  ASSESS         auto-financing readiness                        ✅ BUILT TODAY
  8  SHOW           readiness UI the renter sees                            ✗ NOT BUILT
  9  TRACK          8-gate ladder + good standing                    ✅ engine, ✗ writes
 10  APPLY          renter applies to a lender                       ✗ NO RECORD OF IT
 11  OWN            approved ──▶ handover                       ✅ gated correctly, ✗ writes
```

**Steps 1, 2, 7, 9 exist. Everything between them is the gap.** Almost none of it is new
design — most is a write path into a table that is already there.

---

## WHAT EXISTS ALREADY (and is better than expected)

| Piece | Where | State |
|---|---|---|
| Lead intake → `incoming_leads` | `/forms/lead-intake` | live, 885 rows |
| Screening + decision + reason codes | `background_checks`, `bg_check_decide` | live, 299 rows |
| Renter sees their own decision | `client_bg_status` + `/status/<token>` | built 2026-09-16 |
| Rental quote engine | `src/lib/rental-pricing/` | built by a parallel session |
| **MyFreeScoreNow importer** | `src/lib/credit-dispute/importers/myfreescorenow.ts` | **exists** |
| Business-funding readiness | `src/lib/credit-dispute/engine/funding-readiness.ts` | exists |
| **Auto-financing readiness** | `src/lib/drive-to-own/financing-readiness.ts` | **built today** |
| The 8-gate ladder | `journey_checkpoints` + `src/lib/drive-to-own/` | defined + engine built |
| Lease/sale record | `lto_agreements` | table only, 0 rows |

### The connection that does not exist

`/command/credit-dispute` describes itself as *"MyFreeScoreNow → client_journey → funding
handoff."* **That sentence is marketing copy.** `client_journey` appears nowhere in
`src/lib/credit-dispute/` — grep confirms it. The credit engine and the rental journey are
two islands with a claim of a bridge between them. **Building that bridge is the product.**

---

## WHAT WAS BUILT TODAY — `financing-readiness.ts`

Auto-financing readiness, deliberately separate from the existing business-funding engine.

**Why separate.** The existing engine scores readiness for *business* funding — funders, LLC
lines, a 620/680/720/760 cutoff ladder. Auto lending is a different underwrite: it weighs a
prior repossession far more heavily, and it is tiered on published subprime/prime bands.
Pointing a renter at the business engine would give them a confident number about the wrong
question.

**Six factors**, each `strength` / `watch` / `blocker` / `unknown`:
report on file · score tier · **prior repossession** · public records · collections and
charge-offs · **the renter's TMMT payment record**.

**Two design decisions worth keeping:**

1. **It judges on the LOWEST bureau score, not the average.** 800/800/520 averages to prime;
   a lender sees the 520. Tested.
2. **The TMMT rental record is a scored factor.** A renter's on-time weekly payments are real,
   documented payment behaviour. That is the thing no competitor can produce — SmartCredit can
   show a score, DisputeFox can dispute an item, **neither has the payment history because
   neither is the landlord of the car.** Once furnished as a tradeline it lands on the report
   itself; until then it is still evidence the renter can put in front of a lender.

**Four stages:** `no_report` → `building` → `close` → `ready_to_apply`. There is no fifth.

---

## THE COMPLIANCE SPINE — READ BEFORE CHANGING ANY OF THIS

### 1. The consumer pulls their own report. TMMT never does.
MyFreeScoreNow is consumer-initiated. The renter authorises and retrieves their own file, so
TMMT needs no **FCRA permissible purpose** and triggers no hard inquiry. If TMMT ever pulls a
report itself, that becomes a §604 permissible-purpose question. ⚖️ Do not cross without counsel.

### 2. Never use this score to price or decline a RENTAL.
Assessing ownership readiness is guidance the renter asked for. Using the same data to decline
a rental or set their rate is an **adverse action** under FCRA — written notice, the source of
the report, and dispute rights. The two uses must stay separated in code, not just in intent.

### 3. Readiness is never approval.
`approvalIsLenderDecision: true` is a literal field on every result, and a test asserts no key
or value anywhere in the output matches `approved|probability|odds|guarantee`. The top stage is
`ready_to_apply`.

### 4. Nothing here repairs credit.
Every gate is education, enrollment, training and on-time payment. ⛔ **No dispute letters in
this lane** — that is the CROA line, and all seven legal gates are still CLOSED
(`CLAIMS_AUDIT.md`). The existing `credit-dispute` engine is a separate, gated product; the
Drive-to-Own ladder must not grow into it.

### 5. The language gate is enforced, not trusted.
Every factor label, detail, and next step runs through the repo's `findBannedPhrases` across
four renter profiles — the same gate that already bans *guaranteed approval*, *100% approval*
and *fix your credit*. A future edit that promises an outcome fails the build.

---

## THE DESIGN DECISIONS STILL OWED BY THE OWNER

### 🔴 D1 — Renter accounts. The biggest one.
Step 5 says *"they will be asked to create a profile."* **Renters have no accounts today**, and
`background_checks` / `customer_payments` carry no `user_id` at all. Two ways:

| | Expiring link (today's pattern) | Real renter accounts |
|---|---|---|
| Effort | None — already live | Auth, resets, sessions, RLS for a new role |
| Fits | One-off status checks | A profile they return to for months |
| Risk | Link sharing | A new authenticated surface over PII |

A readiness journey the renter revisits over 90+ days probably needs real accounts. **That is a
build, and it is yours to authorise.** Recommendation: start with the link, add accounts when
the journey proves people come back.

### 🔴 D2 — How the MyFreeScoreNow report actually arrives.
The importer exists, but it is staff-operated at `/command/credit-dispute/import`. For the
renter to self-serve, one of: (a) renter uploads their export, (b) an affiliate/API integration,
(c) staff keeps importing on their behalf. **(c) works today and needs no build.** (b) is a
commercial conversation with MyFreeScoreNow, not a coding task.

### 🔴 D3 — There is no record of a financing application.
No table holds "applied to lender X on date Y, outcome Z". Until one exists, `financingApproved`
stays `null` and the ladder reads `pending` forever. **This is the single blocker on closing the
loop**, and it is a small table.

### 🔴 D4 — Lease-to-own vs third-party financing.
Unresolved from earlier today, and it decides D3's shape. `lto_agreements` implies TMMT finances
it (creditor: Reg Z/TILA, licensing, repossession law). The owner described a lender. ⚖️ Counsel.

---

## BUILD ORDER

| # | Ship | Size | Blocked on |
|---|---|---|---|
| 1 | `financing_applications` table + write path | small | D3/D4 |
| 2 | Readiness UI the renter sees | small | D1 (where it mounts) |
| 3 | Opt-in trigger: "I want to own one day" → `client_journey` | small | — |
| 4 | Write paths for education / enrollment / training | medium | — |
| 5 | `journey_checkpoint_events` emission as gates clear | small | 4 |
| 6 | Booking write path → `bookings` | medium | parallel session |
| 7 | Rent-to-Credit furnishing | large | ⚖️ counsel, e-OSCAR ($90) |

**#3 is the cheapest thing on this page and it starts the whole funnel.** One button on the
renter's status screen — *"I'd like to own a car one day"* — writing one row. Everything
downstream is worth building only once people press it.
