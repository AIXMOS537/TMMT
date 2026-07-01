# Business Model — the company-store glide path

> The decision, on the record: **stop scaling your own fleet; scale licensed
> operators who pay upfront.** Keep a few owned cars as the flagship/proof. Grow
> through one-car, 50/50 partnerships with licensed dealers. Capital exposure
> capped at one car per location; income uncapped; the stress moves off you.

---

## What you actually built

You didn't build a car-rental company. You built a **franchise machine** — and the
cars were the proof it works. The evidence is in the toolbox:

- `new-business.sh` stamps a whole business in one command
- `portal-config` brands each one
- `grant.sh` / `revoke.sh` control operators (with a breach cascade)
- `deal.sh` enforces paid-upfront and computes your cut
- the legacy bundle runs without your backend
- GHL is multi-agency

Every one of those is a *platform* tool, not a *fleet* tool. The business is the
system. The cars are the demo.

## The glide path (how McDonald's actually does it)

1. **Keep a small owned fleet — frozen.** Not for growth: as your flagship, your
   demo, your training ground, your quality benchmark. When you pitch an operator,
   you show them a working store. Stop *buying* cars.
2. **Grow only through licensed partners.** One car each, 50/50, dealership license
   required. Every new unit of growth is asset-light and risk-transferred.
3. **Watch the mix flip.** `deal.sh summary` now splits **owned vs operator** income
   and tells you when partners carry more than your own cars — the moment you've gone
   asset-light. You can see the model shift in the books every morning.

## Why this is the right call (and the honest risk)

**Owning cars** captures full margin — *when rented, undamaged, insured, not in the
shop.* But capital's locked, value depreciates daily, and **it doesn't scale**: every
car is more money out and more stress on you. That stress is structural, not a mood.

**Licensed operators paying upfront** removes the car capital, the depreciation, and
the 2am "it got wrecked" call — those become *theirs.* It scales anywhere. Your margin
becomes recurring partnership income off your balance sheet.

**The risk** is depending on operators to execute and not embarrass the brand. But
you armored exactly that: paid-upfront (no deadbeats), the compliance gate (no illegal
copy under your name), the license hard-block (legit, insured, bonded only),
revoke + breach cascade (one bad actor gone, and whoever vouched), the handover gate
(no car leaves unprotected), and Sentry/Guardian over the core. The risk isn't
unmanaged — it's caged.

## The numbers that prove the shift

`deal.sh summary` shows it plainly:

```
  ── owned vs operator (your cut, paid) ──
    🚗 owned (your cars/biz) : $1000.00  (23% of your income)
    🤝 operator (partners)   : $3300.00  (77% of your income)
    → the model has shifted: partners now carry your income. asset-light. 👑
```

When operator income passes owned income, you've made it: a network instead of a
fleet, growth without more of your own capital at risk.

## The standing rules

- **Freeze the owned fleet.** Flagship only; never scale your own capital again.
- **Grow through licensed partners.** One car, 50/50, license required, paid upfront.
- **Cap the downside at one car.** Max loss per location is recoverable. Always.
- **Watch the mix.** Asset-light is the goal; the books tell you when you're there.

---

_Companions: `docs/PARTNERSHIP-MODEL.md` (the 1-car/50/50 mechanics + protective math),
`docs/MONEY-LEDGER.md` (paid-upfront + your cut), `docs/COST-AND-OBSOLESCENCE.md`
(money out). Tools: `deal.sh` (owned vs operator), `handover.sh` (no car leaves
unprotected), `grant.sh`/`revoke.sh` (operators in/out)._
