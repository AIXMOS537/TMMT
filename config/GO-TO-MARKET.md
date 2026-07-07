# Go-to-Market & Scale

How the cooked product gets sold, onboarded, and scaled. Pairs with
`docs/LAUNCH-READINESS.md` (the technical switch-on).

## What the product is
An AI-run operations platform: **one brain** (Memory Fabric) that remembers every
actor, a **Quo support line** that turns customer contact into routed work, a
**full-pool routing engine** that auto-assigns the best employee/agent/vendor/unit,
a **channel topology** that protects the owner's lines, a **licensed/lockable
backend**, and **HAILMARY** — the owner's cross-device agent.

## Packaging (recorded in the brain)

| Tier | Price | What it is |
|---|---|---|
| Entry | **$3,750** | software offer tier 1 |
| Mid | **$7,500** | software offer tier 2 |
| Top | **$15,000** | software offer tier 3 |
| **Full installation** | **$50,000** | unlocks the backend + the full laptop; the supercomputer ships everything pre-loaded but **locked** until paid + setup + comprehension + activation |

Operator hardware tiers: **8 / 16 / 32 GB** laptops → remote dispatch operators
who need only a laptop + internet to earn, **learn**, and **teach** (only after
100% completion).

## Onboarding a new client (repeatable motion)
1. Create an **organization** row for the client.
2. Create an **`installations`** row (their device `hardware_uuid`), drive
   `paid → setup → comprehension → active`.
3. Load their **`customer_services`** opt-ins (what they bought).
4. Register their **`routing_candidates`** (their staff/vendors/units + capability tags).
5. Add any new **`verticals`** they operate in.
6. Flip `BACKEND_LOCK_ENABLED=true` once licenses are seeded — locked clients see `/locked` until active; **you (admin) are always exempt**.

## Why it scales
- **Multi-tenant by org** — `organizations` + RLS + per-org `installations` mean
  a new client = new rows, not new code.
- **Vertical-agnostic routing** — new business lines = `verticals` +
  `routing_candidates` rows. The ranker doesn't change.
- **Vendor-neutral brain** — `remember/recall` interface is stable; recall can
  upgrade to pgvector or a hosted memory backend with zero caller changes.
- **Channels are config** — `comm_channels` rows, not hardcoded numbers.

## Two ship modes (the secrecy posture)
- **Server-hosted (recommended for SaaS):** backend on your infra; clients get a
  thin, licensed client. Fastest to scale, source never leaves.
- **Sealed appliance (the supercomputer):** everything pre-loaded on an encrypted
  volume, key released on activation. Premium, hardware-bound.

## Channels at market
- **GHL** = top-of-funnel: campaigns, ads, lead capture → `incoming_leads`.
- **Quo** = post-sale: customer support + vendor coordination → routed work.
- Owner protected: **work cell** for escalations (working hours), **personal line
  never contacted**.

## Suggested launch sequence
1. **Daily-drive internally** (TMMT) for 1–2 weeks — you're the first tenant.
2. **Pilot** 1–3 paying clients on the full-install tier; activate licenses.
3. **Onboard operators** via the hardware tiers + training/comprehension gate.
4. **Expand verticals** by adding registry rows.
5. **Decide ship mode** per segment (SaaS vs. appliance) and scale.

## First-90-days metrics to watch
- Support: inbound → assigned %, time-to-assign, no-candidate (escalation) rate.
- Routing: assignments per candidate (load fairness), vendor vs. employee mix.
- Licensing: installs activated, time setup→active.
- Brain: events/day, recall usage by agents.
