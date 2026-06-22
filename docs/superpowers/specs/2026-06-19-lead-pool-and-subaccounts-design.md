# Lead Pool + Operator Sub-Accounts — Design Spec

**Date:** 2026-06-19
**Author:** Owner (PROJECT X HAILMARY) + Claude (architecture)
**Status:** DRAFT — blueprint for owner approval before any prod-affecting migration
**Topology:** `docs/NETWORK-TOPOLOGY.md` · **Tenancy baseline:** the Moe partner-deploy
control plane (`docs/superpowers/specs/2026-06-09-moe-legacy-partner-deploy-design.md`)

## Executive summary

Build the one subsystem the network model needs that doesn't exist yet: a **shared,
attributed lead pool** that routes leads by vertical/campaign to the right **agency
main account** (MOE LEGACY or TMMT RENTALS) and lets the agency **distribute/claim**
them down to **student/operator sub-accounts** — each a fenced child tenant with its own
leads, customers, metered engine access, and (later) its own funnel and payments. The
engine stays PROJECT AIXMOS; the agencies are tenants; operators are sub-accounts.

This rides the rails that already exist (`organizations`, `tenants`, `incoming_leads`
with `organization_id`, the `/api/leads/webhook?org=` capture, the per-org token ledger,
`is_org_member`/`is_staff` RLS) and adds the missing pieces additively — **no existing
table is dropped or repurposed**, so it ships behind the owner's explicit go without
risking the live business.

## Goals

- **One lead pool, many destinations.** Every ad/funnel lead lands attributed (utm +
  source + vertical) and routes to the correct agency, then to an operator.
- **Parent → child tenancy.** An agency is a tenant; an operator is a **child tenant**
  under it. RLS fences a child to its own rows; the parent agency sees its children.
- **Fair, race-safe distribution.** Operators **claim** available leads atomically (no
  two operators get the same lead), with optional round-robin / capacity rules.
- **Plug-and-play operator business.** A sub-account comes with its own leads bucket,
  metered engine access (TMMT tokens, parent-funded sub-allocation), and the deployable
  kit — mesh-gated.
- **Protective + compliant by construction.** Single-tier earnings, collected-sales-only;
  credit = "guidance"; least-privilege RLS; fail-closed; owner ships migrations.

## Non-goals (v1)

- Per-operator **Stripe Connect** payouts and per-operator **branded funnels/subdomains**
  (designed as later phases; v1 routes leads + fences data + meters tokens).
- Replacing the Moe partner-deploy license control plane — this **composes** with it.
- Separate Supabase projects per agency (decided against; use tenant RLS).
- Any change to the credit-guidance compliance posture.

## Data model (additive; all RLS-locked, owner-applied)

1. **`organizations.parent_org_id uuid references organizations(id)`** — the hierarchy.
   Agencies have `parent_org_id = null`; operator sub-accounts point at their agency.
   Add `org_kind text` in (`engine`,`agency`,`operator`) for clarity.
2. **`lead_pool`** — the shared intake/distribution record (one row per pooled lead):
   `id`, `lead_id` (→ `incoming_leads`), `vertical` (`rentals`|`funding`),
   `agency_org_id` (routed-to agency), `status` (`available`|`claimed`|`assigned`|`closed`|`expired`),
   `claimed_by_org_id` (operator sub-account), `claimed_by_user_id`, `claimed_at`,
   `expires_at`, `created_at`. Append-only status transitions via a function.
3. **`lead_routes`** — routing rules: `match` (utm_campaign / source / vertical) →
   `agency_org_id`, `fallback_org_id`, `priority`. The router resolves a lead to an agency.
4. **`tmmt_token_suballocations`** — parent funds/caps a child: `parent_org_id`,
   `child_org_id`, `allocated`, `spent`, `period`. Spends draw from the child's balance,
   bounded by the allocation.

## Functions (SECURITY DEFINER, service-role only — mirror the token ledger)

- **`lead_route(lead_id)`** → resolves agency via `lead_routes` (+ vertical default),
  inserts a `lead_pool` row `available`. Idempotent on `lead_id`.
- **`lead_claim(pool_id, operator_org_id, user_id)`** → **atomic** claim:
  `UPDATE lead_pool SET status='claimed', claimed_by_* WHERE id=$1 AND status='available'
  RETURNING` — no double-claim, no race. Logs the transition.
- **`lead_assign(pool_id, operator_org_id)`** → agency/owner pushes a lead to an operator.
- **`org_is_descendant(child, ancestor)`** → helper for parent/child RLS.

## RLS (the fence)

- **`lead_pool` read:** `is_staff()` OR caller is in the routed `agency_org_id` OR caller's
  org = `claimed_by_org_id`. Operators see **available** leads for their agency + **their
  own** claimed leads — never a sibling's.
- **`organizations` parent visibility:** a parent agency may read its descendant orgs;
  a child reads only itself (+ shared parent rows where intended). Writes: service-role /
  `is_staff()` only.
- **`incoming_leads`:** extend the existing `organization_id` scoping so an operator sub-
  account sees only leads in `lead_pool` it has claimed/assigned (joins via `lead_pool`).
- All writes to pool/routes/suballocations: **service-role only** (no client write policy).

## Lead lifecycle (the state machine)

```
 capture (form / GHL / /api/leads/webhook)
        │  lead_route()
        ▼
   POOL: available ──claim/assign──► claimed ──work──► assigned ──win/loss──► closed
        │                                                              │
        └────────────── expires_at ──► expired ──► re-pooled ◄─────────┘
```

- **Capture** already works; the webhook calls `lead_route()` after insert.
- **Round-robin / capacity** (optional v1.1): `lead_assign` picks the next eligible
  operator by load; default v1 is operator-pull **claim**.
- **Expiry** returns unworked leads to `available` so no lead dies in a drawer.

## Provisioning an operator sub-account

1. Agency (or owner) creates a child org: `org_kind='operator'`, `parent_org_id=agency`.
2. Operator user gets `app_metadata.role='operator'` + `profiles.organization_id=child`
   (extends `docs/OPERATOR-START-HERE.md`).
3. Token **sub-allocation** funded from the agency (`tmmt_token_suballocations`).
4. Operator joins the mesh (Tailscale + license) and gets the deployable kit / AIXMOS
   Pocket — now mesh-gated and live.

## Phases (each gated by `npm run build` + owner review; migrations owner-applied)

1. **Phase 1 — hierarchy + pool schema.** Additive migration: `parent_org_id`/`org_kind`,
   `lead_pool`, `lead_routes`, the SECURITY DEFINER functions, RLS. TS wrappers
   (`src/lib/lead-pool.ts`) + unit tests. No UI yet.
2. **Phase 2 — capture → pool.** `lead_route()` called from the lead webhook + forms;
   attribution (utm/vertical) drives routing. Backfill `organization_id` where missing.
3. **Phase 3 — operator claim/assign UI.** `/operator` gets "Available leads" (claim) and
   "My leads"; agency gets distribute/assign. Reuses the admin DataTable pattern.
4. **Phase 4 — sub-account provisioning + token sub-allocations.** Create-sub-account flow;
   parent funds/caps child tokens; AIXMOS Pocket reflects the sub-account.
5. **Phase 5 (later) — per-operator funnel + payments.** Branded funnel/subdomain + Stripe
   Connect split. (Non-goal for v1.)

## Success criteria

1. A captured lead is **attributed and routed** to the correct agency automatically.
2. Two operators cannot claim the same lead (atomic claim proven by test).
3. An operator sub-account sees **only** its agency's available leads + its own claimed
   leads — never a sibling's (RLS proven).
4. A parent agency can see and fund its operator sub-accounts; a child cannot see the
   parent's full book.
5. Engine spend by a sub-account is bounded by its token sub-allocation.
6. No existing live table is dropped/repurposed; migrations apply cleanly and are
   owner-shipped. Build green; RLS audited.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Prod data exposure via wrong RLS | Additive tables first; per-table RLS audit; service-role-only writes; test the fence before prod |
| Double-claim race | Atomic conditional UPDATE (same pattern as `tmmt_token_spend`) |
| Lead leakage across sub-accounts | RLS keyed on agency + claimed_by; descendant helper; default-deny |
| Hierarchy breaks existing flat-org queries | `parent_org_id` nullable; existing orgs stay agencies/flat; no behavior change until routes exist |
| Compliance drift in operator funnels | Same compliance guard + copy review applies to every operator surface |

## Open decisions (owner)

1. **Distribution default:** operator **pull/claim** (v1, simplest) vs **auto round-robin**
   push? (Recommend claim first, add round-robin in v1.1.)
2. **Lead expiry window** before a claimed-but-unworked lead re-pools (e.g., 24–48h)?
3. **Token sub-allocation policy:** does a parent pre-fund each operator monthly, or
   draw from a shared agency pool? (Recommend per-operator monthly cap.)
4. **Cross-agency leads:** can one funnel feed BOTH agencies (e.g., a renter who also
   wants funding)? (Recommend yes — dual-tag, route primary + create a secondary lead.)
