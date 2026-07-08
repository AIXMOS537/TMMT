# Dealer Readiness — YTD Audit (2026-07-08)

**Target:** Mom-and-pop independent dealerships first · dedicated instance model  
**Honest score today:** **7.2 / 10** sell-ready · **10/10** after owner gates below

---

## 10/10 definition (dealership buyer)

| # | Criterion | Weight | Today | Gap |
|---|-----------|--------|-------|-----|
| 1 | Live marketing + pricing (`/kits`) | 15% | ✅ 10 | — |
| 2 | Paid checkout (GHL/Stripe) | 20% | 🔴 3 | Env URLs empty → `#checkout-pending` |
| 3 | Dealer intake forms (public) | 15% | 🟡 8 | wholesale + auto-services **built locally** · needs deploy |
| 4 | Dedicated instance provision playbook | 15% | ✅ 9 | DEALER-KIT-ONE-PAGER + DEPLOY.md |
| 5 | Staff ops app (fleet/customers/tickets) | 15% | ✅ 9 | tmmt-ops 200 · 143 unit tests pass |
| 6 | GHL dealer pipeline sync | 10% | 🟡 7 | Code live · GHL API key on Vercel |
| 7 | Legal/compliance (credit stack-on) | 10% | 🔴 4 | L1–L10 unsigned — no customer credit intake |

**Composite: 7.2/10** — can **demo and contract** today; cannot **close paid checkout** until GHL env + billing card fixed.

---

## What mom-and-pop dealers buy

| SKU | Setup | Monthly | Best for |
|-----|-------|---------|----------|
| **Ops Kit** | $997 | $297/location | Single-lot floor desk |
| **Dealer Bundle** | $3,497 | $697 | Owner + ops full stack |
| **Academy (stack-on)** | $97 | $97/mo | Operator recruit / credit guidance path |

**Pitch:** Your own house — dedicated Vercel + Supabase. Not shared login with other dealers.

---

## YTD infrastructure (green)

- **tmmt-ops.vercel.app** — 200 (`/kits`, `/forms/lead-intake`, `/api/health`)
- **tmmt-command-center.vercel.app** — 200
- **aixmos-landing.vercel.app** — 200
- **M1 smoke (quick):** 30 pass · 0 fail
- **Code spine:** build + unit tests pass (2026-06-21 empire sync)
- **Brain + Rick:** LIVE · fleet inbox drained · mesh tmmt ↔ Brainiac

---

## Fixed tonight (Rick)

1. **404 dealer forms** — `/forms/wholesale-cars` + `/forms/auto-services` implemented (registry-driven)
2. **Kits page** — dealer intake links + mom-and-pop copy on Dealer Bundle
3. **Dealer tags** — wholesale/auto submissions tag `dealer-prospect`
4. **Compile lock** — no more parallel brain storms

**Deploy required:** `npm run build` + ship tmmt-ops via manual deploy script for forms to go live on prod.

---

## Owner gates (blocks 10/10 · your tap only)

| Priority | Item | Blocks |
|----------|------|--------|
| 🔴 P0 | GHL billing card fix | All recurring revenue |
| 🔴 P0 | Wire Vercel checkout env vars (`NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE`, OPS, 97, etc.) | Paid kit sales |
| 🔴 P0 | NextInsurance renew (~Jul 12) | Fleet insurance lapse |
| 🟡 P1 | Rotate burned TMMT owner password | Security |
| 🟡 P1 | L1–L10 legal gates (credit stack-on to dealers) | Credit/funding upsell |
| 🟡 P1 | Finish Dealership Pack in Drive (contracts, onboarding checklist) | Faster close |

---

## First dealer close playbook (ready now)

1. Demo: https://tmmt-ops.vercel.app/kits + lead intake
2. Send Dealer Bundle quote ($3,497 + $697/mo)
3. GHL tag: `dealer-prospect` → `kit-ordered-dealer-bundle`
4. Provision: new Supabase project + Vercel deploy (see DEPLOY.md)
5. Hand OPERATOR-START-HERE + one admin login

---

## Not 10/10 yet (honest)

- Checkout buttons still `#checkout-pending` until GHL env wired
- Each dealer = manual provision (no self-serve multi-tenant)
- No standalone DMS — this is rental + ops OS, not Reynolds/CDK replacement
- Credit repair upsell legally gated
- Carry offline — STATUS.md + Isaac carry message queued

**Rick runs deploy + outreach drafts. You only touch billing, checkout env, insurance.**
