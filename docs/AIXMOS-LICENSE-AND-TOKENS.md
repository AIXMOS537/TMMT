# AIXMOS Engine — License, TMMT Tokens & the $50K Graduation Gate

> **Owner-only.** How a partner (e.g. Moe Legacy) uses the AIXMOS engine, pays for
> it, and graduates to a full white-label instance — and exactly where X keeps the
> keys. Companion to `docs/RICK-SORKIN.md`, `docs/PROJECT-X-HAILMARY.md`.

---

## 1. The deal in one line

A partner **drives the car** (operates + markets as their own brand). **X owns the
car** (engine IP, platform agency, master kill-switch). The leash releases to a full
white-label license **only after $50K of real, collected engine-usage payments** —
never before, and even then **as a license, not a sale.**

---

## 2. The $50K graduation gate (`leash_release_50k`)

| State | Until $50K collected | After $50K collected |
|---|---|---|
| **Day-to-day control** | Moe drives; Rick Sorkin serves Moe | Moe drives |
| **Owner-approval gate** (money/legal/customer-facing) | **X approves** | Moe approves his own lane |
| **Branding / credit** | AIXMOS-assisted | **Full white-label — Moe takes the credit** |
| **Master kill-switch + engine IP** | **X** | **Still X** (licensed, revocable) |

- Flips **true only when** ≥ **$50,000 USD** of *real, collected* engine-usage
  payments is verified (not invoiced, not promised — collected).
- Until then X holds break-glass (`dark`/`light` needs the owner seal), per-node
  kill (`kill-partner.sh`), and the owner-approval gate on Moe's money/legal/customer actions.
- This is an **owner-approval-style gate** — same primitive as `shared/owner-approval-gate`.
  Add the runtime flag where billing is tracked; do not hand-wave it in copy.

---

## 3. TMMT Tokens = prepaid engine-usage credits (NOT a currency, NOT a security)

To stay clean, TMMT Tokens are defined narrowly:

- **What they are:** USD-priced, **closed-loop prepaid usage credits** for the AIXMOS
  engine. USD in → engine usage out. Like API credits.
- **What they are NOT** (hard lines — never cross):
  - ❌ Not redeemable for cash / never "cashed out" (one-way only).
  - ❌ Not transferable or resellable; no secondary market.
  - ❌ No yield, no appreciation, no profit promise, no "investment" framing.
  - ❌ Not used to pay third parties (closed-loop = us only).
- **Why these lines:** crossing them turns tokens into **money transmission**
  (state MTLs) and/or a **security** (Howey). Kept closed-loop + usage-only, they're
  ordinary prepaid B2B credits. (Root `CLAUDE.md` COMPLIANCE: Reg D / Howey-sensitive.)
- Counting toward the $50K gate uses the **USD actually collected**, not token face value.

> If we ever want tokens to move value between parties or be cashable, **stop and get
> counsel first.** Until then: usage credits, full stop.

---

## 4. White-label = license, not assignment

"Take any and all credit" = **marketing/branding rights**, granted. It does **not**
transfer ownership.

- Moe may brand, market, and present the stack as Moe Legacy's. ✅
- Engine **IP, source, platform-agency ownership, and revocation right stay X's.** 🔒
- A true sale of IP or equity is a **separate, lawyered transaction** (Reg D / Howey;
  §83(b) within 30 days for any profits-interest). Don't bundle it into the license.
- The white-label license is **revocable** for covenant breach or non-payment.

---

## 5. Guardrails

- Moe never sees HAILMARY / Project X / X — face (DREAMA/AIXMOS) only.
- Credit = **"guidance"** in AIXMOS copy; actual repair stays in Moe's DisputeFox lane.
- Operator/student commissions pay on **real collected client services** — never
  recruitment or "staying on" (anti-pyramid; `workstream-3/covenant`).
- Every money/legal/customer action routes through the owner-approval gate until graduation.

---

_The keys release on $50K collected — and even then, X still holds the title._
