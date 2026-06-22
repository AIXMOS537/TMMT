# 🏦 Moe Legacy — vertical profile

> Spun up 2026-06-21. Vertical **#2** on the shared spine (TMMT Rentals = #1).
> Partner: Muhammad Umar · Credit guidance + business funding · SaaS-agency model.
> Status: 🟡 **spec + code ready** — live login gated on signed contract + owner `--apply`.

## What it is

- **Offer:** Credit guidance (never "repair") + business funding pathway + operator/agency seats
- **Who it's for:** Moe Legacy clients, operators, affiliates, students on Learn → Earn → Churn
- **Pricing:** See `docs/OFFER-STACK.md` — seat $97/mo + BUILD/RUN ladder
- **Compliance:** `docs/sops/CREDIT-GUIDANCE-SOP.md` — no guaranteed outcomes

## Architecture (already built in repo)

| Piece | Location | Status |
|---|---|---|
| Vertical brand config | `src/lib/verticals/registry.ts` | ✅ code |
| Branded operator portal | `src/app/(operator)/layout.tsx` + `PortalChrome` | ✅ code |
| Seat provisioning (dry-run) | `scripts/provision-tenant-seat.mjs` | ✅ code |
| Org isolation RLS (review) | `supabase/migrations/20260621020000_tenant_scope_rls_policies.sql` | 📋 owner review |
| Genie meter (tokens) | `src/lib/token-ledger.ts` | ✅ code |
| Founding onboarding | `scripts/onboard-founding-operators.mjs` | ✅ exists |

## Provision Umar (when contract signed)

```bash
cd ~/Projects/TMMT

# Preview — no writes
node scripts/provision-tenant-seat.mjs \
  --vertical moe-legacy \
  --email [email removed] \
  --stage admin \
  --dry-run

# Live — owner only, after contract signed
node scripts/provision-tenant-seat.mjs \
  --vertical moe-legacy \
  --email [email removed] \
  --stage admin \
  --apply
```

Or batch from `config/seats.example.csv`.

## Apply org isolation (owner gate)

```bash
npm run db:finish-tenancy -- --dry-run   # preview existing migrations
# Then apply 20260621020000_tenant_scope_rls_policies.sql via SQL Editor or access token
# ONLY after owner approves the RLS phase.
```

## Devices

| Device | Role | Status |
|---|---|---|
| Umar Carry M5 | Thin-client operator seat | `scripts/deploy operator` when ready |
| Surface Pro 4 | Fenced command-center agent | Gated on payment milestones |
| TMMT Traptop | Owner possession | Never ships to partner |

## Spec + plan

- Design: `docs/superpowers/specs/2026-06-21-moe-legacy-agency-saas-design.md`
- Rollout: `docs/superpowers/plans/2026-06-21-moe-legacy-agency-saas.md`

## Watch

- URL: `https://tmmt-ops.vercel.app/login` (shared spine; brand resolves per org)
- Health: `bash scripts/health.sh` once live URL confirmed
