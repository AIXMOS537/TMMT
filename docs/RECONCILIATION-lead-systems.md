# Reconciliation — two lead/operator systems (decision record)

**Date:** 2026-06-22 · **Decision:** the **live production system is the source of truth**;
the new `lead_pool` system (Phases 1–4) is **parked as a reference design**, not applied.

## How we got here

A session built a clean, tested `lead_pool`-based lead/operator system (Phases 1–4) and
merged it to `master`. On going to apply the migrations, a read of the live database
revealed prod **already runs** a mature, populated lead/operator/affiliate system that was
**never committed back to the repo** (schema drift: ~130 migrations applied in prod vs 23
in `supabase/migrations/`).

## The two systems

| Capability | Live in prod (source of truth) | Parked (reference) |
|---|---|---|
| Lead routing | `lead_routing_engine`, `lead_quality_gate` | `lead_pool` + `lead_routes` + `lead_route()` |
| Operator claim | `operator_claim_and_book` | `lead_claim()` + `/operator/leads` |
| Provisioning | `operator_provisioning_va` + install tokens, `operator_profiles` (7) | `provisionOperatorSubAccount()` + `/operators` |
| Referrals/affiliate | `partner_referrals`, `operator_affiliate_network`, `affiliate_links` (2) | `pocket_referral_*` |
| Cross-sell/refer | `credit_crosssell` | `lead_cross_refer()` |
| Routing pool | `routing_candidates` (18), `work_assignments` | — |

## Decisions

1. **Keep the live system.** It has real operators, affiliates, and routing data.
2. **Park the duplicates.** Moved to `supabase/migrations/_parked/` so they can't be
   accidentally `db push`-ed into prod (split-brain prevention). Code stays on `master` as
   reference; it is inert without the tables.
3. **Keep the one net-new piece: the AIXMOS Pocket assistant.** It runs on the
   **already-live token ledger** (`tmmt_token_balances` in prod) and needs **no new table** —
   only `POCKET_BRAIN_URL`. Turn it on by setting that env var.
4. **Fix the drift (standing risk).** The repo can't rebuild prod today. The prod migrations
   should be exported back into `supabase/migrations/`. This needs a one-time approval for a
   production read (the platform blocks direct prod DB access by default — add a permission
   rule or approve the read when prompted).

## Net effect

- **Nothing was applied to prod. Nothing broke.** All work remains on `master`, green.
- The duplicate system is safely parked; the live system is untouched and canonical.
- The Pocket assistant is ready to switch on with one env var, no migration.
