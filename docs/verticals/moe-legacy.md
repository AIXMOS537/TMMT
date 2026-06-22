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
  --email umar47002@yahoo.com \
  --stage admin \
  --dry-run

# Live — owner only, after contract signed
node scripts/provision-tenant-seat.mjs \
  --vertical moe-legacy \
  --email umar47002@yahoo.com \
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

## Go-to-market & revenue model (direction set 2026-06-22)

**The play:** Moe Legacy stands up as a marketing **agency / lead engine** — it runs
ads and markets itself, **populating a stream of leads**. Those leads get closed by:
1. **You (owner)** — closing leads and sales directly, and
2. **Affiliates / operators** — your network closes leads and sales *for you*, so the
   recurring monthly revenue churns **for them and for you** (override on collected
   sales). This is the "Earn" + "Churn" of Learn → Earn → Churn.

Maps to what's already wired:
- **Operator/affiliate commission** — single-tier referral model in
  `src/lib/referrals.ts` + `docs/LEARN-EARN-CHURN.md`. Guardrails (keep them):
  **single-tier only** (no recruiting-on-recruiting / MLM depth), commission recorded
  **only on COLLECTED sales**, internal earnings records — **not** guaranteed/passive
  income and **not** a security.
- **Recurring revenue** — seat `$97/mo` + the BUILD/RUN ladder in `docs/OFFER-STACK.md`;
  tokens metered via `src/lib/token-ledger.ts`.
- **Agency SaaS rollout** — `docs/superpowers/plans/2026-06-21-moe-legacy-agency-saas.md`.

**Compliance reality for the ads/marketing (this vertical is restricted):** credit
guidance + funding is an A2P 10DLC + CROA restricted vertical, so the guardrails wired
in this session apply directly:
- ✅ **Market hard on:** paid ads (Meta/Google), email, landing pages, organic — with
  **CROA-clean** copy: no guaranteed outcomes, no "credit repair," required disclosures
  per `config/credit-compliance.json` + `docs/sops/CREDIT-GUIDANCE-SOP.md`.
- ⛔ **Promotional SMS is hard-locked** for credit/funding (carrier + CROA). The
  send-time gate (`src/lib/agent/sms-compliance-gate.ts`) **blocks** marketing SMS on
  this vertical; SMS stays **transactional-only** (confirmations/reminders) with proper
  opt-in (`docs/aixmos/A2P_OPTIN_PACKAGE.md`).
- 🔒 **Owner-approval gate** stays on customer-facing/financial actions; the
  `credit_repair` / `funding` feature flags unlock only by owner/umar after legal steps.

> Net: build the lead engine and the affiliate-closer network freely — just route
> credit/funding promotion through ads/email/landing (not SMS), keep the copy
> CROA-clean, and the structure stays protective and legitimate.

## Watch

- URL: `https://tmmt-ops.vercel.app/login` (shared spine; brand resolves per org)
- Health: `bash scripts/health.sh` once live URL confirmed
