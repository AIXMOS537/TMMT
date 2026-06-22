# Sovereign Operator — the MoeLegacy model (Umar = operator #1)

> How an operator owns their **own** everything, while the Owner (Muhammad Taha)
> serves as their **systems engineer by invitation**. First sovereign operator:
> **Muhammad Umar / MoeLegacy** (credit guidance + funding). Companions:
> `scripts/one-shot.sh` (sovereign setup), `scripts/engineer` (the support console),
> `docs/AIXMOS-MESH-BLUEPRINT.md` (the bridge), `docs/OFFER-STACK.md` (founder terms).

## The model in one line

**The operator owns their own agency, account, mesh, seal, and data. The Owner
engineers it for them only through a consented, revocable bridge.** Two separate
houses; the operator hands the engineer a key to one room, and can take it back.

```
  UMAR / MoeLegacy (sovereign)              TAHA (systems engineer)
  ┌───────────────────────────┐            ┌──────────────────────┐
  │ his own Tailscale account  │            │ his own M5 + mesh     │
  │ his own seal + data        │            │ runs `engineer`       │
  │ his own AIXMOS / agency    │  shares 1  │                       │
  │ MoeLegacy credit+funding   │◀─ node ───▶│ reaches ONLY that node│
  └───────────────────────────┘  (revoke   └──────────────────────┘
        owns everything          anytime)        support, not ownership
```

## What's the operator's (Umar owns all of this)
- **His own Tailscale account / tailnet** — separate from Taha's. Default = zero overlap.
- **His own owner seal** — he's the boss of *his* node (set via `one-shot.sh own`).
- **His own agency** — MoeLegacy, his clients, his brand, his revenue.
- **His own AIXMOS instance + data** — local-first on his hardware; his to keep.
- **His own kill switch** — `dark`/`light` on his node answer to *his* word.

## What the engineer (Taha) can do — and only by invitation
- Reach **one shared machine** of Umar's, over a Tailscale **node-share**, with
  **Tailscale SSH** — to support: `engineer pull|status|sync|fix|run|setup`.
- Nothing covert: Umar sees the share, and **revokes it anytime** (instantly cuts
  Taha's access). Least-privilege — Taha reaches only the shared node, not Umar's
  whole tailnet.
- Taha **never owns** Umar's mesh, seal, or data. Support ≠ control.

## Setup — the consented bridge (one-time)

**On Umar's Mac (he's the owner of his own world):**
1. `bash scripts/one-shot.sh` → pick **MY OWN** → his sovereign node + **his own**
   Tailscale login + his own seal.
2. In **his** Tailscale admin: **Share** the machine he wants Taha to support to
   **Taha's Tailscale account**, and enable **Tailscale SSH** on it.

**On Taha's M5 (the engineer):**
3. Accept the shared node in Tailscale.
4. `engineer add "Moe Legacy" <umar-user>@<shared-host>`
5. `engineer status "Moe Legacy"` → **● reachable**. Now support flows:
   `engineer pull|sync|fix|run|setup`.

**To end it:** Umar removes the share in his Tailscale admin — Taha's access is
gone immediately. His sovereignty is never in question.

## Founder terms (Umar is operator #1)
Per `docs/OFFER-STACK.md`: **Umar / MoeLegacy is a founding operator — brain free
until $50K is collected** (settled via hours/salary/commission). He's the
lighthouse: a real agency, owned by him, engineered with him — proof the model works.

## Why this is the right shape
- **Dignity + ownership** — operators build *their own* thing; they're partners,
  not tenants. That's how the network scales without resentment.
- **Security by separation** — separate accounts = separate blast radius. A
  problem on one operator's mesh can't reach Taha's or another operator's.
- **Reversible by design** — every access is granted by the operator and revoked
  by the operator. Mirrors the whole system's charter (consent, least-privilege,
  reversibility).

---

_Operator #1: Muhammad Umar — MoeLegacy. His agency, his account, his everything;
Taha engineers it at his invitation. The template for every operator after him._
