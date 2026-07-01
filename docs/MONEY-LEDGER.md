# Money Ledger — every deal, your cut, paid upfront

> The law, from now on and forever:
> **💵 PAID UPFRONT. No pay, no work.**
> A deal isn't GO until it's collected. Every deal records WHO · WHAT · WHEN ·
> WHERE · WHY · HOW MUCH · YOUR CUT. Nothing gets built on a promise.

Tool: **`bash scripts/deal.sh`** · the books live in `.aixmos/ledger/` (private,
gitignored — your money never touches the repo).

---

## Log a deal

```bash
bash scripts/deal.sh add \
  --who   "Acme Co" \
  --what  "Credit repair stack" \
  --where moelegacy \
  --why   "50K funding prep" \
  --amount 5000 \
  --cut    50% \
  --paid            # ← only add this when the money is IN
```

- **`--cut 50%`** → your cut is computed ($2,500). Use a flat number instead
  (`--cut 2500`) if it's fixed. Omit it and it's 100% yours.
- **`--paid`** stamps it collected and marks the work **GO**.
- **No `--paid`** → the deal sits on **⛔ HOLD**. The work does not start. That's
  the rule enforcing itself.

When the money lands on a HOLD deal:
```bash
bash scripts/deal.sh paid <id>     # releases the work
```

## See the money

```bash
bash scripts/deal.sh list      # every deal, paid + hold
bash scripts/deal.sh hold      # UNPAID only — do NOT start these
bash scripts/deal.sh summary   # collected · your cut · on hold · by business
```

`summary` gives you the whole picture:
```
  collected upfront : $5000.00  (1 deals)
  YOUR CUT (paid)   : $2500.00
  on HOLD (unpaid)  : $1200.00  (1 deals)  ← chase or kill
  booked total      : $6200.00
  ── by business ──
    moelegacy      booked $5000.00 · your cut $2500.00
    tmmt           booked $1200.00 · your cut $0.00
```

## It enforces the rule for you

- The **CEO brief** reads the ledger every morning. Collected + your cut show under
  **💰 THE NUMBER**. Any **unpaid** deal lands in **🔴 ON FIRE** — "work should be on
  HOLD" — so you never quietly do work you haven't been paid for.
- Each deal is the seven answers in one row: who, what, when, where, why, how much,
  your cut. No more guessing what a client owes or what's yours.
- Every deal gets a **unique id** (monotonic, never collides) so `paid <id>` always
  hits the right one.

## The standing rules

- **Paid upfront, always.** The default state of an unpaid deal is HOLD. You opt
  *into* "collected," never the reverse.
- **Your cut is on every deal.** Set it once per deal; the books total it.
- **The books are private.** `.aixmos/ledger/` is gitignored — never pushed.
- **No pay, no work — forever.** The system won't let a HOLD deal look done.

---

_Tool: `scripts/deal.sh`. Feeds `💰 THE NUMBER` in the CEO brief (`scripts/ceo.sh`).
Pairs with `docs/COST-AND-OBSOLESCENCE.md` (what you spend) — together they're the
full P&L picture: money in, your cut, money out._
