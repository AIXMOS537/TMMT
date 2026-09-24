# PRICING DECISION + CREDIT BUILD GUARDRAILS — 2026-09-16

**Annex to `COMPETITIVE_TEARDOWN_2026-09-16.md` (authored by a parallel session).**
That document is good and its build order stands. This adds two things it left open:
the pricing call it marked **"YOUR CALL"**, and a legal guardrail on its credit list.

All figures read live, read-only, from production `uapxakmlwnpfsftfeezx` on 2026-09-16.
**No production write was made.**

---

## 1. THE RATE CARD — INDEPENDENTLY VERIFIED, AND WORSE THAN REPORTED

The teardown said the seeded economy rate ($280/wk) sits under the cheapest real car
($300/wk). **Confirmed.** But the problem is bigger than one tier being low.

### The card prices a fleet that does not exist

| Rule | Card weekly | Cars in `fleet` it matches |
|---|---|---|
| luxury · Mercedes-Benz S-Class | $1,600 | **0** |
| luxury · BMW 7 Series | $1,550 | **0** |
| luxury · Porsche (any) | $1,400 | **0** |
| mid · Mercedes-Benz C-Class | $780 | **0** |
| mid · BMW 3 Series | $750 | **0** |
| economy · Tesla Model Y | $590 | 1 |
| economy · Tesla Model 3 | $550 | 1 |

**Five of the seven make/model rules match zero vehicles.** The card describes a luxury
rental business. The actual book is a gig-driver fleet.

### The real fleet, measured

- 43 rows · 33 carry a weekly price
- weekly range **$300 – $550**, average **$389**
- `lowest_possible_price` range **$300 – $450**
- generic tiers on the card: economy **$280**, mid **$470**, luxury **$950**

So the card is wrong in **both** directions: generic economy is **$20 below** the cheapest
real car, while every luxury rule is **2.5×–5× above** the most expensive one.

### It is also wrong on the one car it does match
`Tesla Model 3 (2019)` — real posted weekly **$450**, card says **$550**. The card
**overprices** the single vehicle it correctly matches by $100/wk.

### The tier column is corrupt — confirmed
Only **3 of 43** rows carry a `vehicle_class`, and all three are wrong:
Tesla Model 3 → `sport_bike`, Tesla Model Y → `sport_suv`, 2013 Corolla → `sport_car`.
The parallel session's engine already refuses to read this column. **Keep that refusal.**

---

## 2. THE REFRAME THAT DECIDES IT

`fleet` is the **repossessed** book — 21 `Rented`, 6 `Retired`, 5 `Under Maintenance`,
4 `Available`. It is history, not inventory. TMMT runs **2 vehicles** today.

So `rental_pricing_rules` is not pricing Taha's cars. It is **the default rate card that
ships to every customer who installs TMMT OS.** A buyer installing today gets a card
quoting BMW 7 Series at $1,550/wk against their own economy fleet.

That turns this from a bookkeeping tidy-up into a **product defect on the first screen a
paying customer sees.**

### RECOMMENDATION — one path

1. **The car's own posted price is the price.** Already how the engine behaves. Keep it.
2. **Delete the five fiction rules.** They match nothing and can only mislead.
3. **Re-seed the three generic tiers to the real distribution** — floor $300, not $280 —
   so an unpriced car falls back to something true.
4. **Ship the card empty for new tenants.** A customer's rate card should be seeded from
   *their* fleet during provisioning, never inherited from TMMT's history. This is the
   `provision-client.md` runbook step that does not exist yet.

**Ready to apply, not applied** — this is a production write and needs the baton:

```sql
-- 1. retire the rules that match no vehicle
update rental_pricing_rules set active = false
 where make is not null
   and (make, coalesce(model,'')) in
       (('Mercedes-Benz','S-Class'),('BMW','7 Series'),('Porsche',''),
        ('Mercedes-Benz','C-Class'),('BMW','3 Series'));

-- 2. floor the generic economy tier at the real cheapest car
update rental_pricing_rules set weekly_rate_cents = 30000, daily_rate_cents = 5500
 where tier = 'economy' and make is null;

-- 3. the Model 3 rule overprices the one car it matches
update rental_pricing_rules set weekly_rate_cents = 45000
 where tier = 'economy' and make = 'Tesla' and model = 'Model 3';
```

⚠️ These are **pricing decisions, not code fixes.** I have not run them. Confirm the
numbers are what you want to charge before anyone applies them.

---

## 3. 🔴 CREDIT GUARDRAIL — MOST OF THE DISPUTEFOX LIST IS NOT LEGAL FOR TMMT TODAY

The teardown's §3 lists what DisputeFox / CRC / SmartCredit have that TMMT lacks. It is
an accurate feature scrape. **It should not be read as a build list**, because of this,
which the repo already records:

> `CLAIMS_AUDIT.md`: *"All seven legal gates CLOSED except the permanent CPN prohibition.
> No attorney-approved CROA suite, no VDACS registration, no surety bond."*
> `FIRST_SALE_CHECKLIST.md`: *"❌ Any credit-repair capability."*

**Building these makes TMMT a credit repair organization under CROA (15 U.S.C. § 1679a)
with none of the required apparatus.** Sorted by what the gates actually permit:

### ⛔ GATED — do not build until the seven gates open
- Bulk dispute-letter generation, per-agency letter routing, saved signatures
- AI dispute letters with escalating tone tiers
- Certified-mail / print-and-mail rails and tracking
- Pre-loaded dispute-reason and furnisher libraries
- Live video notarization for Power of Attorney
- Anything that **acts as the consumer's agent** toward a bureau, creditor or furnisher

Each of these is the *regulated act itself*, not a tool around it. Hands-on credit work
is referred to **Khan Strategies LLC** — that referral structure is the entire basis on
which the disclaimer holds. Building the letter engine in-house collapses it.

### ✅ SAFE TO BUILD NOW — no CROA exposure
- **Rent-to-Credit furnishing** (teardown §4a). Furnishing *accurate positive* payment
  data is a **furnisher** activity under FCRA, not a credit repair activity under CROA.
  This is the moat and it is the one credit item outside the gate. ⚖️ Still needs counsel
  on the furnisher agreements and e-OSCAR enrolment — but it is not gate-blocked.
- **Credit-gated rental underwriting** (§4b) — using a score TMMT already pulls to set
  its *own* deposit and rate. That is underwriting its own product, not repairing anyone's
  credit.
- **Side-by-side report diff** — read-only visualisation of the consumer's own data,
  provided it recommends no dispute and drafts no letter.
- **ScoreMaster-style paydown simulator** (§3, "best idea scraped") — education and
  arithmetic on the consumer's own balances. Stays clean **only** while it is framed as
  information and promises no score outcome. No "we will raise your score by N."
- Branded portal, two-way messaging, document upload, recurring billing, 2FA, affiliate
  commission rails — all infrastructure, none credit-specific.

**Net:** the credit half of the roadmap is roughly **⅓ buildable now, ⅔ gated.** The
buildable third happens to contain the only genuinely differentiated item in the whole
teardown. That is a good trade — build the moat, skip the commodity.

---

## 4. WHAT I DID NOT TOUCH

`src/lib/rental-pricing/` is being actively written by a parallel session in this same
working tree. I read it, verified its findings against production, and **changed nothing
in it.** Its `enforceFloor()` refusal and its refusal to read `vehicle_class` are both
correct and should survive any later edit.
