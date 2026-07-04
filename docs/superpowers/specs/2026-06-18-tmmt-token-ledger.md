# TMMT Token Ledger — v0 Spec (smallest safe slice)

**Owner:** X (PROJECT X HAILMARY) · **Date:** 2026-06-18 · **Status:** spec for owner review — NOT yet built, NOT applied to prod

## Goal (plain English)
$97/mo buys a monthly stack of **TMMT tokens**. When the AIXMOS engine ("the genie") does a
job for someone, it **spends** their tokens. Run dry → locked until they top up or renew.
This **caps Taha's costs** (nobody can run the engine into the ground) and makes "pay me in
tokens" literally real. **No crypto** — internal credits only (crypto is a future, inshallah).

## Why this is the protective move
- Caps engine/API cost per paying user → protects the owner's margin (honors "low token use = hard constraint").
- Rides the billing + license gate that ALREADY exist — minimal new surface to secure.
- Every grant + spend is logged → a clean audit trail (protects the LLC, supports disputes/chargebacks).
- Owner (X) and the first-10 operators are **never metered** — their license carries an unlimited flag.

## Rides existing rails (verified in repo 2026-06-18 — do NOT rebuild)
- Stripe per-tenant webhook: `src/app/api/agent/stripe/webhook/[slug]/route.ts`
- License + kill-switch gating: `installation_licensing` migration, org licenses
- Learn·Earn·Churn UI: operator + training pages, `src/lib/client-journey`

## Data (2 new tables — RLS-locked, tenant-scoped)
1. **`tmmt_token_balances`** — one row per org/operator: `org_id`, `balance` (int ≥ 0),
   `monthly_allotment`, `plan_tier`, `unlimited` (bool — owner/operator bypass), `status`
   (active|suspended), `last_topup_at`.
2. **`tmmt_token_events`** — append-only audit log: `org_id`, `delta` (+grant / −spend),
   `reason`, `stripe_event_id` (nullable, **unique** for idempotency), `job_ref`, `created_at`.

## Flow
1. **Top-up:** Stripe `checkout.session.completed` / `invoice.paid` → grant monthly allotment
   (balance += allotment, write `+` event). **Idempotent on `stripe_event_id`** (no double-credit on retries).
2. **Spend:** before the engine serves a job → if `unlimited` OR `balance >= cost`: serve, then
   atomic decrement (`UPDATE ... SET balance = balance - cost WHERE org_id = $1 AND balance >= cost RETURNING`),
   write `−` event. Else: refuse with "out of tokens — top up", log the denial.
3. **Kill-switch:** suspended license → no serve regardless of balance (existing gate wins).

## Edges handled first (non-negotiable)
- **Idempotent grants** — unique `stripe_event_id`, retries can't double-credit.
- **Atomic spend** — conditional UPDATE, no race / no oversend / no negative balance.
- **RLS** — a user reads ONLY their own balance; only service-role writes events.
- **Default-deny** — unknown org / expired license → zero tokens, no serve.
- **Refund / chargeback** — claw back the allotment via a compensating `−` event.

## v0 scope cuts (honest — deferred, not hidden)
- Flat cost = **1 token per job** to start (real per-job/per-model pricing comes later).
- No standalone token dashboard yet — admin reads balances via existing payments page / a query.
- No partial tokens, no rollover (allotment resets monthly).

## Ship discipline
Build + test behind the existing gate → owner reviews → **owner ships via `scripts/ship`**.
Agents never deploy. Migration applied to prod only on owner's explicit go.
