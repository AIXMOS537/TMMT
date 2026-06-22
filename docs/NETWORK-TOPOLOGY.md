# NETWORK TOPOLOGY — the law of the network (engine + two agencies + operators)

> Canonical reference for how PROJECT AIXMOS, the two agencies, the lead pool, and
> operator sub-accounts fit together. Like the charters, this is **architecture and
> intent** — the shape every build conforms to. Companions: `docs/AIXMOS-CHARTER.md`,
> `docs/HAILMARY-CHARTER.md`, `docs/OFFER-STACK.md`, `docs/THREE-APP-ECOSYSTEM.md`,
> `docs/AIXMOS-TMMT-FUNNEL.md`.

## The three pillars

| Pillar | What it is | In the repo today |
|---|---|---|
| **PROJECT AIXMOS** | **The engine.** The AI + infrastructure brain that powers everyone — the swarm, the agents, the token-metered services, the deployable infra. Owner-only; never sold (`docs/AIXMOS-CHARTER.md`). | `scripts/aixmos`, the mesh/swarm, the token ledger, the Pocket assistant brain. |
| **MOE LEGACY** | **The credit-guidance + business-funding agency** (B2B + B2C capital seekers). Compliance: **"guidance," never "repair."** | `tenants` row `moe-legacy` (`supabase/migrations/20260609000001_tenants.sql`); partner-deploy control plane (`docs/superpowers/.../2026-06-09-moe-legacy-partner-deploy-*`); `credit_funding_sessions`. |
| **TMMT RENTALS** | **The car broker / rentals / transportation agency + hub** (B2B + B2C). | The live app — fleet, customers, payments, dispatch core (`docs/DISPATCH-CORE.md`). |

**Rule:** the public ever sees **AIXMOS** (the brand) and the two agencies. HAILMARY
and the owner's private AIXMOS network stay behind the curtain (`docs/OFFER-STACK.md`).

## The flow (ads → lead pool → main + sub-accounts → close)

```
  MOE LEGACY ads          TMMT RENTALS ads          (each agency promotes its verticals)
        │                        │
        ▼                        ▼
   ┌─────────────────────  LEAD POOL  ─────────────────────┐   one shared, attributed pool
   │  capital seekers (funding/credit)   ·   car renters    │   (utm + source on every lead)
   └───────────────┬───────────────────────────┬───────────┘
                   │ routed by vertical/campaign │
        ┌──────────▼──────────┐       ┌──────────▼──────────┐
        │ AGENCY MAIN ACCOUNT │       │  AGENCY MAIN ACCOUNT │
        │   (MOE LEGACY)      │       │   (TMMT RENTALS)     │
        └──────────┬──────────┘       └──────────┬──────────┘
                   │ distribute / claim           │
        ┌──────────▼───────────┐       ┌──────────▼───────────┐
        │ STUDENT/OPERATOR      │  ...  │ STUDENT/OPERATOR      │  each = a plug-and-play
        │ SUB-ACCOUNTS          │       │ SUB-ACCOUNTS          │  deployable business,
        └───────────────────────┘       └───────────────────────┘  mesh-gated, in their palm
```

- **Ads** are run by the agencies toward **any/all services in their verticals**
  (rent a car · seek capital · the rung-ladder builds in `docs/OFFER-STACK.md`).
- **Lead pool** = one attributed intake; leads route by vertical/campaign to the right
  agency, then are **claimed/distributed** to operators.
- **Main account** = the agency tenant (MOE LEGACY, TMMT RENTALS).
- **Sub-account** = a student/operator's own tenant **under** an agency — their own
  leads, customers, and deployable business, fenced from siblings.
- **Mesh-gated:** an operator only gets the engine + tools after joining the network
  (Tailscale + license), per `docs/MESH-SWARM.md` and the operator kit.

## Who gets what (the fence)

| Actor | Gets | Never gets |
|---|---|---|
| **Owner (PROJECT X HAILMARY)** | Everything — HAILMARY, the AIXMOS network, all tenants. | — |
| **Agency main account** (Moe Legacy / TMMT) | Its tenant, its leads, its operators/sub-accounts, the engine via AIXMOS Pocket / the deployable kit. | The owner's HAILMARY; other agencies' data. |
| **Student / operator sub-account** | Their own fenced sub-account: their leads, customers, funnel, metered engine access (TMMT tokens), the plug-and-play business. | The agency's full book; sibling operators' data; the engine internals. |
| **Customer (renter / capital seeker)** | The service they came for. | Any back-office. |

## Tenancy model (current → target)

- **Current:** flat `organizations` + `profiles.organization_id`; a parallel `tenants`
  table for partner licensing; `org_roles` (dispatch core); `is_org_member`/`is_staff`
  RLS. **No parent/child, no lead pool, no sub-account isolation.**
- **Target:** an agency is a tenant; an operator sub-account is a **child tenant** of an
  agency; the **lead pool** distributes to main + sub-accounts; RLS fences each
  sub-account to its own rows while letting the parent agency see its children.
  Designed in `docs/superpowers/specs/2026-06-19-lead-pool-and-subaccounts-design.md`.

## Metering & money (already protective)

- **Engine access is metered in TMMT tokens** per tenant (`src/lib/token-ledger.ts`):
  the agency/sub-account spends tokens for engine jobs; owner + first-10 operators are
  `unlimited`. The sub-account model adds **per-child token sub-allocations** so a parent
  can fund and cap each student.
- **Referrals/earnings** are single-tier, **collected-sales-only** (`src/lib/referrals.ts`)
  — the protective structure for the owner. No guaranteed/passive income.

## Compliance & charter (non-negotiable, carried everywhere)

- Credit side is **"guidance," never "repair"**; no guaranteed score or income
  (`src/lib/compliance.ts`, `docs/sops/CREDIT-GUIDANCE-SOP.md`).
- Public only ever sees AIXMOS + the agencies; HAILMARY/owner-AIXMOS are never sold.
- Mesh access is least-privilege, consented, logged; fail-closed.

## Gap list (what must be built for the target) — see the spec for the plan

🔴 Lead pool + distribution/claim · 🔴 parent→child tenancy (`parent_org_id` + RLS) ·
🔴 operator sub-account provisioning + isolation · 🟠 per-operator funnel/lead routing ·
🟠 operator-owned payments (Stripe Connect) · 🟡 per-sub-account token sub-allocations ·
🟡 per-operator reporting. Full detail + phasing:
`docs/superpowers/specs/2026-06-19-lead-pool-and-subaccounts-design.md`.
