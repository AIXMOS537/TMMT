# Stocktake Result — the fleet is empty

**2026-09-01** · Owner completed the walk-the-lot stocktake. Result below, with what it forces us to change.

---

## The result

```
FLEET STOCKTAKE — 2026-09-01
Here: 0   Gone: 43   Not sure: 0   Not checked: 0
```

**Every one of the 43 vehicles in the database is gone.** Not one is present.

That includes all 21 that the database still marks `Rented`, all 10 company-owned cars, and every partner vehicle — Asad's two Corollas, Robin's Tesla, Marc's Corolla, Umar's Lexus, the lot.

---

## What else stopped at the same time

Once the fleet came back empty, every other operational signal was checked. They all point at the same moment.

### Vehicles and costs froze on one day

| Table | Last written | Distinct write days |
|---|---|---:|
| `fleet` (43 rows) | **2026-06-17** | **1** |
| `expenses` (34 rows) | **2026-06-17** | **1** |
| `active_customers` (35 rows) | 2026-06-22 | 2 |
| `customer_payments` (31 rows) | 2026-07-16 | 4 |

### Lead flow collapsed, and June is missing entirely

| Month | Leads | Days with any lead | Notes |
|---|---:|---:|---|
| April 2026 | **662** | **1** | All on 22 April — a bulk import, not organic flow |
| May 2026 | 111 | 4 | |
| **June 2026** | **0** | **0** | **Nothing at all** |
| July 2026 | 91 | 8 | |
| August 2026 | **11** | 7 | ~1.5 leads per week |

**So "875 leads" is really 662 imported in one batch plus 213 arrivals since.** Actual organic inbound last month: **eleven.**

### The rental program stopped being what leads ask for

The keyword router classifies every lead into a program. Rideshare rental, by month:

| | Apr | May | Jun | Jul | Aug |
|---|---:|---:|---:|---:|---:|
| Classified `rentals_rideshare` | 626 | 100 | — | **0** | **0** |
| Classified `general` | 24 | 7 | — | **90** | **11** |

**Not one rideshare-rental lead since May.** Every July and August lead falls through to `general`.

---

## What this means

> **The rideshare rental operation appears to have wound down around mid-June 2026.**
> No cars, no expenses recorded, no rental leads, and the last customer payment in mid-July.

Three independent signals — a physical stocktake, a data freeze, and a lead-mix change — all land in the same two-week window. That is not a data problem. **The database has been faithfully describing a business that stopped.**

### This may well be the plan working, not a failure

The company's own strategy documents say exactly this should happen:

- `docs/BUSINESS-MODEL.md`: *"stop scaling your own fleet; scale licensed operators who pay upfront"*
- `docs/PARTNERSHIP-MODEL.md`: *"**Freeze the owned fleet.** Flagship only; never scale your own capital again."* and *"Cap the downside at one car."*

An empty fleet is consistent with a deliberate exit from owning and renting cars, toward the operator / credit / funding model. `[OPEN]` — the owner confirms which this is.

---

## 🔴 What this voids

I recommended the investor/owner payout build as *"the highest-value work available."* **On this evidence that recommendation is withdrawn.**

| Work | Was | Now |
|---|---|---|
| `vehicle_owners` + `owner_agreements` backfill | Phase 2, highest value | **Void.** No vehicles to attach an owner to |
| Owner statements and payouts | The collection fix | **Void.** Nothing to invoice |
| Investor dashboard | Highest-value gap | **Void.** No investor vehicles exist |
| `partner_fleet_access` logins | Trust-building asset | **Void** |
| "21 rented vehicles, money moving without a ledger" | My framing | **Wrong. Withdrawn.** There is no money moving through those cars |

`CHANGE_REQUEST_001.md` is superseded. The migration is still well-designed and costs nothing to keep on the shelf — but there is no reason to apply it to an empty fleet, and no backfill to run.

**The good news, and it is real:** there is no legacy data to migrate. Nothing has to be reconciled, de-duplicated or carefully preserved. Whatever is built next starts clean. That is far cheaper than the reconciliation project this was going to be.

---

## What is still actually live

Short list, and worth being precise about it:

| Live | Evidence |
|---|---|
| GoHighLevel → Supabase contact sync | `ghl_contacts` current to 2026-08-31 |
| A trickle of inbound leads | 11 in August, all unclassified `general` |
| The credit / funding / operator scaffolding | `journey_checkpoints`, `programs`, `operator_profiles` (19 against a 100 cap), 15 training modules |
| The legal suite | Nine Virginia contracts, plus the halal v3 redrafts |
| The compliance debt | Every item in `BUSINESS-RULES-RECOVERED.md` §11 is still outstanding |

Note that **two compliance items do not go away with the fleet**, because they concern people, not cars:

- **C4** — the sales script still promising *"$800 to $1,000+ a month on autopilot"* and *"$50K+ in funding"* is still the most recently edited document in the data room. Still live, still a CROA/FTC problem.
- **C1** — Intelius is not a CRA, and 304 people's background checks, licences and paystubs still sit in Airtable.

---

## The question this forces

Everything downstream depends on one answer, and it is a business question, not a technical one:

> **What business is running right now?**

Three possibilities, with very different builds behind them:

1. **Wound down deliberately** — the pivot to operators/credit/funding worked as written. Then the roadmap should be rewritten around the operator network and the credit pathway, and the entire rental/fleet/investor half archived.
2. **Paused, restarting** — cars are coming back. Then the migration stays on the shelf and we build for a clean restart, which is genuinely easier than the reconciliation we were facing.
3. **Still running, elsewhere** — cars and renters exist but live in Airtable, a spreadsheet, or someone's phone, and Supabase simply never saw them. Then the priority is capturing the real operation before anything else.

**Nothing more should be built until this is answered.** Building for the wrong one of these three is how the last six months of scaffolding ended up describing a business that had already moved on.
