# PARKED migrations — DO NOT APPLY without reconciliation

These migrations are **intentionally moved out of the auto-apply path** (the `_parked/`
prefix keeps `supabase db push` / migration runners from picking them up).

## Why

Production already runs a mature lead-routing + operator-provisioning + affiliate system
(the June-11 `lead_routing_engine` / `operator_claim_and_book` / `operator_affiliate_network`
/ `operator_provisioning_va` series, with live data in `operator_profiles`, `affiliate_links`,
`routing_candidates`, etc.). The migrations here build a **parallel** `lead_pool`-based
system. Applying them would create a **split-brain** — two lead/operator systems side by side.

Decision (see `docs/RECONCILIATION-lead-systems.md`): **the live system is the source of
truth.** These stay as a **reference design**, not applied to prod.

## What's parked

| File | Builds | Why parked |
|---|---|---|
| `20260619030000_lead_pool_subaccounts.sql` | `lead_pool`, `lead_routes`, `lead_route/claim/assign/cross_refer`, `organizations.parent_org_id/org_kind` | Duplicates the live lead-routing + operator-claim engine |
| `20260619040000_lead_pool_view.sql` | `mask_phone`, `lead_pool_feed` | Depends on the parked `lead_pool` |
| `20260619020000_pocket_referrals.sql` | `pocket_referral_codes/earnings` | Overlaps the live `partner_referrals` + `affiliate_links` system |

## The one net-new piece that is NOT parked

The **AIXMOS Pocket assistant** (`src/app/api/pocket/chat`, `src/lib/pocket-brain.ts`)
runs on the **already-live token ledger** (`tmmt_token_balances` is in prod) and needs **no
new table** — only the `POCKET_BRAIN_URL` env var. It is the genuinely additive value.

## If you ever want to adopt the pool model

Reconcile first: pick a single source of truth, migrate live data, and retire the other —
don't apply these on top of the live system.
