# Partner Model — Recommendation

**2026-09-01** · Written in response to the owner's instruction: *"help us keep the best business model to get more cars and more partners and work on collecting more for the company."*

Everything here is `[RECOMMENDED]` unless marked otherwise. Nothing is decided. The numbers in §4 are the owner's to set.

---

## 1. The short version

**You are not losing money because your split is too generous. You are losing it because nothing is being counted.**

Three facts, all verified in production today:

| | |
|---|---|
| Vehicles currently rented | **21** |
| Vehicles with an agreed split recorded | **7 of 43** (16%) |
| Rows in `revenue_splits` | **0** |
| Owner statements ever produced | **0** |

For 36 of 43 vehicles there is no recorded agreement about who gets what. Revenue is coming in and going out with no ledger behind it. **You cannot collect what you never invoiced.**

Raising your percentage from 40% to 50% on a business that isn't invoicing gets you 50% of nothing extra. Recording and invoicing what is *already agreed* is where the money is.

**Recommendation: fix the counting first, then tier the split. In that order.** The counting is worth more, is not a negotiation, and does not risk a single partner relationship.

---

## 2. The tension in your instruction, named honestly

You asked for three things that pull against each other:

```
more cars  ←→  more for the company
more partners  ←→  more for the company
```

A bigger company share makes the offer less attractive. That is real and there is no clever way around it.

**But there is an honest way through it, and it is already your own rule.** From the 2026-06-04 contract review, in your words:

> *"Higher % must reflect MORE real services — keeps it a fair service fee, not exploitation."*

That is the answer to the whole question. **You don't raise the split. You raise the service, and the split follows.** A partner paying you 45% because you handle insurance, maintenance, collections, claims and the renter relationship is getting a better deal than one paying 30% and doing half of it themselves. Both are fair. Both are halal. One brings you more money *and* is easier to sell.

---

## 3. What the record actually says — four different answers

Before recommending anything, here is every version of the split that exists, because they disagree and someone has been acting on each of them.

| Source | Model | Date | Authority |
|---|---|---|---|
| **Legacy JV Agreement** | Tiered management fee 10 / 20 / 30% — **partner keeps 70–90%** | pre-2026-06 | Signed contract |
| **Real monthly P&L** | ~$21,884 sales · **60% partner payout** ($13,130) · $5,400 salaries | seen 2026-06-04 | Actual money |
| **Your new direction** | Tiers **10 / 20 / 30 / 40 / 50%**, up to a 50% split, *"higher % must reflect MORE real services"* | 2026-06-04 | `[STATED]` by you |
| **`docs/PARTNERSHIP-MODEL.md`** | One car · **cost recovery off the top, then 50/50** · title stays with you · licensed dealers only · paid upfront | undated | Written up as strategy; I could not find you endorsing it |
| **The live database** | 0.60 / 0.65 / 0.70 on 7 vehicles | seeded | Never confirmed |

⚠️ **The unreconciled gap flagged on 2026-06-04 and never closed:** *"P&L says 60% partner payout but JV says 70–90% — reconcile."* It is still open. Until it is, nobody can say whether the business is over- or under-paying its partners.

**The most important number in that table is $3,354.** $21,884 in sales, minus $13,130 to partners, minus $5,400 in salaries. That is what is left **before a single dollar of maintenance, repair, ticket, insurance or depreciation.** On 21 rented cars, that gap does not survive one transmission.

---

## 4. The recommendation

### 4.1 Cost recovery comes off the top. This is the whole ballgame.

`docs/PARTNERSHIP-MODEL.md` already describes it and `scripts/deal.sh` already implements it — but it writes to a text file on your computer, not to the system. **Nothing in the app does this.**

The rule, in plain words:

> **The car's real costs come out first. Whatever is left over, you split.**
> If there isn't enough to cover costs, you take what there is and the partner gets nothing that month.

Your own worked example:

| Month | Net in | Your cost recovery | Split of the rest | **You** | **Partner** |
|---|---:|---:|---|---:|---:|
| Good | $2,000 | $800 | 50% of $1,200 | **$1,400** | **$600** |
| Slow | $500 | $800 | nothing left | **$500** | **$0** |

**Why this matters more than the percentage:** a 40% split *after* costs beats a 60% split *before* costs almost every month. And it is easier to defend — you are not taking more, you are simply not absorbing someone else's expenses.

**It is also the halal-correct shape.** A profit share on *real profit* is a partnership. A percentage of gross while you silently eat the costs is you subsidising them, which is worse for you and no better for them.

`[OPEN]` — What counts as recoverable cost? Recommend: insurance, maintenance, repairs, tickets, cleaning, and a depreciation reserve. Explicitly **not** your overhead or salaries — those come out of your share, or the model stops being fair.

### 4.2 Tier the split to the service, and publish the tiers

Stop negotiating each deal from scratch. Publish a ladder and let the partner pick. `[RECOMMENDED]` shape — **the percentages are yours to set:**

| Tier | Partner does | You do | Company share |
|---|---|---|---|
| **Self-managed** | Insurance, maintenance, their own renter relationship | Platform, matching, contracts | lowest |
| **Managed** | Owns the car. Nothing else. | Everything: renter, insurance, maintenance, collections, claims | middle |
| **Full service** | Owns the car | Everything above **plus** guaranteed placement, replacement vehicle when theirs is down, claims handling | highest |

Three real advantages:

1. **It sells better.** A partner choosing a higher tier is *buying more*, not conceding more.
2. **It is defensible under your own rule** — more percentage, more service.
3. **It scales.** New partners self-select. You stop pricing every conversation.

`[OPEN]` — the three percentages, and what exactly sits in each tier.

### 4.3 Fix the three leaks that are costing you now

These are not negotiations. They are things nobody is doing.

| Leak | What's happening | Fix |
|---|---|---|
| **No agreement on 36 of 43 cars** | 84% of the fleet has no recorded split | Record what's already agreed, per vehicle. Not a renegotiation — a write-down |
| **No expense attribution** | Repairs and tickets are recorded as costs but not tied to a car or an owner | Every expense gets a vehicle and a liability owner. Then costs come off the top automatically |
| **No statement, no invoice** | Zero owner statements have ever been produced | Monthly statement per owner: revenue, costs, your fee, their net. **An owner who gets a clear statement pays. One who gets a text message argues** |

### 4.4 What actually gets you more cars and more partners

Not a better percentage. Partners with capital are not primarily shopping on split — they are shopping on **trust that they will get paid correctly and on time.**

Right now you cannot show a prospective partner:
- what their car would earn (no rental history — `bookings` has **0 rows**)
- what it would cost to run (expenses aren't attributed per vehicle)
- what they would have been paid (no statements)
- a login to watch it (`partner_fleet_access` has **0 rows**)

**Every one of those is a sales asset you already have the data to build.** A partner portal showing a real car's real twelve months is worth more than five points of split. That is the honest version of "get more cars" — and it is a build, not a negotiation.

⚠️ One correction on `PARTNERSHIP-MODEL.md`'s *"licensed dealers only"*: I could not find you saying that. If it is real it is a serious constraint on partner recruitment and belongs in the tier table. If it is not, it is quietly limiting your pipeline. `[OPEN]`

---

## 5. Non-negotiables this must respect

| Rule | Consequence for the model |
|---|---|
| **No riba** `[STATED]` | Late fees go to charity, never into revenue and never into a split. Deposits are ʿarbūn, not financing. No payment ever allocates to accrued interest |
| **Higher % = more real services** `[STATED]` | The tier ladder is the mechanism. A higher share with no added service fails your own test |
| **Mercy in collections** `[STATED]` | Grace periods, mornings only, a hardship door. This applies to partners in a bad month too — a car that under-earns is not a debt to chase |
| **Money is owner-gated** `[STATED]` | Statements can generate automatically. **Payouts never send themselves.** *"Draft never send. Track never pay."* |
| **Related-party disclosure** | All In One Management is your own entity — see `SYSTEM_OF_RECORD.md` §9a. Any fee flowing between it and TMMT is related-party and must be disclosed as such |

---

## 6. Build order

Deliberately smallest-first. Each step pays for itself before the next one starts.

| # | Build | Unlocks | Needs a decision from you? |
|---|---|---|---|
| **1** | `vehicle_owners` — real records, replacing 22 spellings of ~18 people | Everything downstream | Only to confirm who's who |
| **2** | `owner_agreements` — per vehicle: cost-recovery base, split %, tier, who pays what, dates | The split can finally be *stored* | **Yes — §4.1, §4.2** |
| **3** | Expense attribution — every cost tied to a vehicle and a liable party | Cost recovery off the top | Who pays for what |
| **4** | `bookings` backfill — reconstruct rental history from `active_customers` + `fleet` | Proof of earnings for sales | No |
| **5** | Owner statements — monthly, per owner, revenue → costs → fee → net | **The invoice. This is the collection fix** | Cadence |
| **6** | Partner portal — turn on `partner_fleet_access` | Trust, and a sales asset | Privacy: does an owner see the renter's name? |
| **7** | Payouts — recorded, reconciled, **owner-gated** | Correct money | Payment rails |

**Steps 1–5 need no partner conversations at all.** They are pure recording. Do them first, generate the first month of statements, and *then* discuss tiers — from a position where you can show every partner exactly what their car did.

---

## 7. The one-line answer to your question

> **Count first, then charge.**
> Recording and invoicing what you have already agreed will collect more this quarter than any renegotiation, and costs you nothing with any partner.
> Then tier the split to the service — so a bigger company share arrives as a better offer, not a worse one.

---

## 8. Decisions needed from you

| # | Decision | Blocks |
|---|---|---|
| 1 | Reconcile the 60% P&L vs 70–90% JV gap — which is real? | Everything. Two years of payouts may be wrong |
| 2 | Cost recovery off the top — yes for all deals, or only some? | Step 2 |
| 3 | What counts as a recoverable cost | Step 3 |
| 4 | The three tier percentages and what sits in each | Step 2 |
| 5 | Who pays maintenance, repairs, tickets, insurance — per tier | Step 3 |
| 6 | Payout cadence — weekly, monthly, on collection? | Step 5 |
| 7 | Is *"licensed dealers only"* real? | Partner recruitment |
| 8 | Does an owner see their renter's identity? | Step 6 — privacy |
| 9 | Minimum commitment and exit terms for an owner | Step 2 |
