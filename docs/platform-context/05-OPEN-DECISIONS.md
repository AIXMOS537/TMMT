# 05 — Open Business Decisions

Decisions only the owner can make. Claude Code must not invent answers to any of these.

Each item shows **what's currently in the system** so the decision is "confirm or
change," not "start from nothing."

Legend: 🔴 blocking · 🟡 needed soon · ⚪ can wait

---

## 1. Rental qualification 🔴

| Decision | Currently in the system |
|---|---|
| Minimum driver rating to qualify | `Rating` field exists on leads, no threshold defined |
| Which platforms are approved (Uber, Lyft, delivery, others) | `programs` routing matches uber/lyft/doordash/ubereats keywords; no approval list |
| What background-check result disqualifies | `Eligibility Status` + `Background Check Status` exist, criteria undefined |
| Minimum verified earnings, if any | `Earnings Verification Status` field exists, threshold undefined |
| Whether TMMT-placed insurance is mandatory or optional | 6 insurance products active, all requiring background approval |
| Required documents to be considered complete | Attachment fields exist per document, no completeness rule |
| **Disqualification reason list** | 🔴 **No field exists at all.** This one blocks Pathway 2 entirely. |

## 2. Pricing & rental terms 🔴

**Already seeded in `rental_pricing_rules` — confirm or void:**
economy $45/day, $280/week, $400 deposit · mid $75/$470/$500 · luxury
$150/$950/$1,000 · plus 7 make/model-specific rules up to $250/day, $1,600/week,
$2,000 deposit (Mercedes S-Class).

Still undefined: minimum and maximum rental period · payment schedule · late-payment
rules · cancellation rules · mileage limits and overage · what the deposit covers and
refund conditions · **damage responsibility** · **vehicle replacement rules** (what
happens when a renter's vehicle goes down) · geographic markets served.

## 2b. Insurance structure 🔴

Who provides the insurance — TMMT, an affiliate, or the customer's own carrier? Is it
mandatory? Can a customer use their own policy, and what coverage minimums must it
meet? At what point in the funnel is the affiliate option presented? Who pays, and is
TMMT compensated for the placement?

Currently in the system: six active products under two different `coverage_source`
values — `tmmt_internal` and `corporate_non_owner`. **These two are legally very
different businesses.** Confirm which one TMMT is actually in before this ships.

## 3. Investor / vehicle management economics 🔴

| Decision | Currently in the system |
|---|---|
| Revenue split with owners | `fleet.partner_percentage` on 7 of 43 vehicles: 0.60, 0.65, 0.70. Unconfirmed. |
| Management fee structure | Not modeled anywhere |
| Who pays maintenance — TMMT or owner | Not modeled |
| Who pays repairs, tickets, insurance | `expenses` records cost but not liability |
| Payout cadence | Not modeled |
| Vehicle eligibility to enter the fleet (age, mileage, condition, type) | `Vehicle Onboarding Inspections` exists; no acceptance criteria |
| What happens when a vehicle sits unrented | Not modeled |
| Owner exit / vehicle withdrawal terms | Not modeled |
| Minimum commitment period for an owner | Not modeled |
| Who approves a repair, and above what amount | `expenses` records cost, not authority |
| What happens when a vehicle becomes uneconomical to operate | Not modeled |
| Is the fleet company-owned, investor-owned, or both | Both in practice — 8 vehicles marked TMMT, the rest named individuals |

**This section blocks Phase 2, which is the highest-value work available.**

## 4. Partners 🔴

| Decision | Currently in the system |
|---|---|
| **Which credit partner** | 🔴 The only `partners` row is deactivated ("do not re-enable"). There is no active credit capability. |
| All In One Management's exact scope and responsibilities | Referenced in strategy, not modeled |
| Which funding partners | Not modeled |
| Referral compensation terms per partner | Not modeled |
| What the partner reports back and how often | Not modeled |
| Credit product pricing | `credit_product_catalog`: $97/mo · $250+$250 · $1,000 DFY. Unconfirmed, and CROA-sensitive. |
| Is the `moe-legacy` Supabase project still in scope | Project exists; credentials fail; partner record deactivated |
| What customer data is exchanged with each partner, and under what consent | Not modeled — this is a privacy question, not a technical one |
| Partner SLAs and what they report back, how often | Not modeled |
| Who contacts the customer after a referral — TMMT or the partner | Not modeled |

**Marketing claims question, which is really a legal one:** what may TMMT say it does,
versus what the partner does? The answer determines the copy on every progression
surface, and getting it wrong is the compliance exposure in §6 of the blueprint.

## 5. Vendors & platform 🟡

Payment processor · accounting platform · background-check provider · driver
verification provider · e-signature · SMS/voice · insurance carrier or broker
(the `rental_insurance_products` table names "National Fleet Underwriters" — confirm
whether that is a real relationship or placeholder) · hosting tier (currently Vercel
hobby) · GoHighLevel agency plan and SaaS-mode status.

## 6. People & permissions 🟡

Employee roles and what each may see, edit, and approve · which actions require the
owner gate vs. a manager · which require the compliance co-approver · what a customer
can see about themselves · what an investor can see about their vehicles and renters
(privacy question: does an owner see the renter's identity?).

Specifically, name the person or role who can: **approve a renter · approve a vehicle
into the fleet · authorize an expense (and above what amount) · issue a refund · modify
a financial record · access sensitive personal information · escalate, and to whom.**
Each of these is an authority decision, not a permissions-screen detail — the software
just enforces whatever you decide.

Also open: which non-qualified customers should enter the alternative pathway at all,
versus simply be closed. Not everyone should be routed onward, and the system needs
your criterion, not a guess.

`Employee Access Rights` exists in Airtable with 1 row; `org_roles` in Supabase with 1
row. Effectively undefined.

## 7. Operator network ⚪

How a student becomes an operator · what an operator's split is · what an operator can
see and do in the system · the relationship between the 100-cap and the resale package
ladder ($1,875 → $35–50k in `packages`).

Current state: 19 operator profiles against a 100 cap, 15 training modules, 1 rubric
score recorded.

## 8. Progression program design 🟡

The realistic timeline range and how it is communicated (**never as a guarantee**) ·
what "good standing" means concretely (`journey_checkpoints` has `day_90_good_standing`
with no definition attached) · what triggers re-assessment · what the client is
required to do vs. what the partner does · what happens when someone stalls · the
lease-to-own terms behind the `lto_eligible` checkpoint and `lto_agreements` table
(0 rows).

Also undefined: **financing approval criteria** (what makes a client fundable, and who
decides — TMMT or the funding partner) and the **vehicle acquisition process** for a
client who becomes able to buy (does TMMT source the vehicle, and is TMMT compensated).

## 9. Technology stack ⚪

The stack is largely settled by what is deployed — Supabase, Airtable, GoHighLevel,
Vercel, Cloudflare Pages. The open questions are consolidation, not selection: whether
Airtable stays as the staff interface long-term or is replaced by a first-party
surface, and whether the second Supabase project is retired. Neither should be decided
until `SYSTEM_OF_RECORD.md` (Roadmap 0.4) exists.

---

## How to use this file

When Claude Code hits one of these, it should:

1. Note the `[OPEN]` reference in whatever it is producing,
2. Build the surrounding structure so the answer is **configuration**, not code,
3. Present the decision to the owner in plain English with a recommendation and the
   trade-offs — not as a technical question,
4. Update this file when a decision is made, moving the item to a `DECIDED` section
   with the date and the answer.
