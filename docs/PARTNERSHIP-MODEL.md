# Partnership Model — one car, 50/50, licensed dealers only

> The model, decided: for each new location/operator, the owner puts in **one car**
> and splits **50/50** — but only with people **worth it**, and the minimum bar is a
> **dealership license**. The structure is built to protect the owner first:
> **you never bleed on the car, and you never carry a partner who isn't legit.**

---

## The deal in one line

**One car · 50/50 of the upside · your cost comes off the top first · licensed
dealers only · title stays with you · they pay upfront.**

## Why this shape protects you

- **Downside capped at one car per location.** You're never betting a fleet on a
  stranger. Worst case: revoke them, pull the car, move on. (`scripts/revoke.sh`.)
- **Dealership license = the minimum, hard-blocked.** No license number on the card,
  no grant — enforced in `scripts/grant.sh`, no exceptions. A license means *their*
  insurance, *their* bonding, *their* liability — not yours. One requirement, many
  shields.
- **Title stays in your name. Always.** The 50/50 is a split of the *money*, never
  the *car*. Your asset, your collateral, your control.
- **Their half is paid upfront too.** The same law as every deal: licensed + pays
  upfront + proven = "worth it." If they flinch at upfront, you just saved a car.

## The money math — you never bleed

Your car's carrying cost (depreciation + insurance reserve) is your **base**. It
comes off the top **before any split**:

```
  net rental on the car         = AMOUNT  (after the operator's ground costs)
  your cost-recovery            = BASE    (set once per car)
  your split of the upside      = SPLIT%  (default 50)

  if AMOUNT ≤ BASE:  YOU take ALL of it,  partner gets $0   ← you're made whole first
  else:              YOU take BASE + SPLIT% of (AMOUNT − BASE)
```

Log it:
```bash
bash scripts/deal.sh add --who "Real Dealer" --where austin \
  --what "Location car" --amount 2000 --base 800 --split 50 --paid
```
- Good month — net **$2,000**: you get **$1,400** ($800 recovery + 50% of $1,200),
  partner **$600**.
- Slow week — net **$500** (under your $800 recovery): **you take all $500**, partner
  **$0**. The car can't lose you money.

Every partnership deal lands in the ledger with your protected cut computed, and
feeds `💰 THE NUMBER` in the CEO brief. Unpaid = HOLD = no work (the standing law).

## Getting a partner in (the gate)

1. They onboard (`dist/onboard.command`). The interview now asks operators for a
   **dealership license number**. No number → they can't be granted as a car partner.
2. They send their card. You run `bash scripts/grant.sh <card>`.
   - **No license → BLOCKED.** "No license, no grant. No exceptions."
   - **Non-car role** (e.g. a setter who never touches a vehicle): grant it on
     purpose with `bash scripts/grant.sh <card> --no-car` — the only exception, and
     you have to declare it.
3. The grant records the license #, the sponsor (who vouched), and the partnership
   terms (1 car · 50/50 after cost-recovery · title with X).

## "Worth it" — the full bar (not just the license)

The license is the *minimum*. The real bar is all three:

- ✅ **Licensed** dealer (hard requirement)
- ✅ **Pays upfront** — their buy-in/half before the car ships (`deal.sh`, paid-first)
- ✅ **Proven** — track record, or starts small and earns more

Miss any one and the answer is no. That's how one car per location compounds into a
network instead of a liability.

## If it goes bad

You already hold every lever:
- **Revoke** them instantly; **breach cascade** removes whoever vouched too.
- **Pull the car** — your title, your asset.
- **Rotate** any brokered secret they saw. **Sentry/Guardian** keep the core sealed.

Max loss: one car, recoverable. That's the whole point.

---

_Enforced by: `scripts/grant.sh` (license hard-block), `scripts/onboard-interview.sh`
(captures the license), `scripts/deal.sh` (`--base`/`--split` protective math),
`scripts/revoke.sh` (exit + cascade). Companion: `docs/MONEY-LEDGER.md`,
`docs/ACCESS-AND-ACCOUNTABILITY.md`, `docs/BUSINESS-MODEL.md`._
