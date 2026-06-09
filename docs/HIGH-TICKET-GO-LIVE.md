# High-ticket go-live — payments & `/build`

Turn on deposit checkouts for done-for-you builds. Until this is done, `/build` shows CTAs but money does not flow.

**Prereq:** GHL account with Stripe connected. TMMT deployed on Vercel.

---

## 1. Create GHL products (Stripe)

Create one **one-time payment** product per deposit tier in GHL → Payments → Products:

| Tier | Full price | Deposit collected | GHL product name (suggested) |
|------|------------|-------------------|------------------------------|
| Base Infrastructure | $3,750 | $3,750 (full) | TMMT Build — Base deposit |
| Enterprise Systems | $7,500 | $3,750 (50%) | TMMT Build — Enterprise deposit |
| Car Rental in a Box | $15,000 | $7,500 (50%) | TMMT Build — CarBox deposit |
| E-Commerce Ecosystem | $25,000 | $12,500 (50%) | TMMT Build — Ecom deposit |
| Full Ecosystem | $50,000 | Consult-first | No checkout — book-a-call only |

For each product: create a **checkout link** or funnel step URL. Copy the public checkout URL.

Also create (if not already):

| Product | Env var | Used on |
|---------|---------|---------|
| $97/mo membership | `NEXT_PUBLIC_GHL_CHECKOUT_97` | Funnel, `/forms/*` |
| Operator high-ticket | `NEXT_PUBLIC_GHL_CHECKOUT_3750` | Legacy alias for Base tier |
| Strategy call booking | `NEXT_PUBLIC_GHL_CONSULT_CALL` | `/build` top tier + fallback CTA |

Kit SKUs (USB + online): see [`SALES-CHANNELS.md`](SALES-CHANNELS.md) and [`FLASH-DRIVE-PRODUCT-LINE.md`](FLASH-DRIVE-PRODUCT-LINE.md).

---

## 2. Set Vercel env vars

In Vercel → Project → Settings → Environment Variables (Production + Preview):

```bash
# Deposits — powers /build reserve buttons
NEXT_PUBLIC_GHL_CHECKOUT_3750=https://...   # Base ($3,750)
NEXT_PUBLIC_GHL_CHECKOUT_7500=https://...   # Enterprise deposit
NEXT_PUBLIC_GHL_CHECKOUT_15000=https://...  # CarBox deposit
NEXT_PUBLIC_GHL_CHECKOUT_25000=https://...  # Ecom deposit

# Universal fallback when a tier URL is blank
NEXT_PUBLIC_GHL_CONSULT_CALL=https://...

# Membership funnel
NEXT_PUBLIC_GHL_CHECKOUT_97=https://...

# Webhook auth (server-only — never NEXT_PUBLIC_)
GHL_WEBHOOK_SECRET=<long-random-string>
```

Optional support line on `/build` and `/kits`:

```bash
NEXT_PUBLIC_SUPPORT_PHONE=
NEXT_PUBLIC_SUPPORT_EMAIL=
```

Pull locally after setting:

```bash
vercel env pull .env.local   # or copy into .env for local dev
```

Redeploy after env changes.

---

## 3. Point GHL webhook at TMMT

**Endpoint:**

```
POST https://tmmt-ops.vercel.app/api/webhooks/ghl
Header: x-ghl-webhook-secret: <GHL_WEBHOOK_SECRET>
Content-Type: application/json
```

> **Why `tmmt-ops`, not `tmmt-command-center`:** the public webhook routes are deployed on the canonical `tmmt-ops` Vercel project. The `tmmt-command-center` deploy has staff-only middleware gating that returns `307 → /login` on POST. Verified 2026-06-09 with a live smoke test (`tmmt-ops` returned 405 to GET = correct POST-only route; `tmmt-command-center` returned 307).

Wire in GHL workflows for:

- **Tag added** — CRM sync (`ready-for-aixmos`, `member-97`, etc.)
- **Payment received** — inserts `customer_payments`, fires revenue tags
- **Program handoff** — tag `ready-for-aixmos` can forward to `/api/webhooks/ghl/program`

Full payload examples: [`GHL-WEBHOOK-SETUP.md`](GHL-WEBHOOK-SETUP.md).

Revenue tags for build deposits (must match [`src/lib/high-ticket.ts`](../src/lib/high-ticket.ts)):

- `build-base-deposit`
- `build-enterprise-deposit`
- `build-carbox-deposit`
- `build-ecom-deposit`

Add corresponding tags in GHL when payment succeeds.

---

## 4. Verify before sharing `/build`

```bash
npm run ghl:check                    # P0 env audit
npm run ghl:check -- --test-webhook  # optional local webhook POST
npm run ghl:test-webhook payment     # payment payload smoke test
```

Manual checks:

1. Open `/build` — each tier’s **Reserve** button goes to a real GHL checkout (not `#reserve-pending`).
2. Complete a **test payment** in GHL sandbox/stripe test mode.
3. Confirm webhook returns `{ ok: true }` and a row appears in `customer_payments`.
4. When ready for SEO: remove `robots: { index: false }` from [`src/app/build/page.tsx`](../src/app/build/page.tsx) and link `/build` from nav.

---

## 5. Affiliate / operator attribution

Operators push prospects to public forms — no login required:

- Lead intake: `/forms/lead-intake`
- Affiliates landing: `/forms/affiliates`

Set each operator’s **affiliate code** at provision time (`app_metadata.affiliate_code`) and pass it on GHL checkout URLs as a custom field or UTM (`?affiliate=CODE`) so payouts credit the right person. Payout tracking: `/forms/affiliates` + GHL tags.

---

## Rollback (safe)

- Unset checkout env vars → CTAs fall back to consult link (no dead buttons).
- Disable GHL workflow webhook → payments stop syncing; forms still work.
- `/build` stays noindex until you flip metadata.

Do **not** share `/build` widely until step 4 passes.
