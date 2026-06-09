# High-Ticket Builds — Go-Live Checklist

How to turn on money collection for the high-ticket SaaS / done-for-you build
tiers ($3,750–$50,000) on the `/build` page.

**Mechanic:** deposit / reserve. The customer pays a **deposit** through a
GHL-hosted checkout (Stripe under the hood); the **balance is invoiced** at
kickoff. The top tier ($50,000) is consult-first ("Book a call").

The page (`/build`) and catalog (`src/lib/high-ticket.ts`) already ship. It is
**unlisted** (not linked in nav, `robots: noindex`) and every CTA falls back to
the book-a-call link until you connect real checkout URLs — so nothing can
charge money until you complete the steps below.

---

## The tiers

| Tier | Price | Deposit collected | CTA | Checkout env var |
|---|---|---|---|---|
| Base Infrastructure | from $3,750 | $3,750 | Reserve | `NEXT_PUBLIC_GHL_CHECKOUT_3750` |
| Enterprise Systems | $7,500 | $3,750 (50%) | Reserve | `NEXT_PUBLIC_GHL_CHECKOUT_7500` |
| Car Rental in a Box | $15,000 | $7,500 (50%) | Reserve | `NEXT_PUBLIC_GHL_CHECKOUT_15000` |
| E-Commerce Ecosystem | $25,000 | $12,500 (50%) | Reserve | `NEXT_PUBLIC_GHL_CHECKOUT_25000` |
| Full Ecosystem | $50,000 | — | Book a call | `NEXT_PUBLIC_GHL_CONSULT_CALL` |

Prices, deposits, copy, and bullets all live in `src/lib/high-ticket.ts` — edit
there, in one place, and the page updates.

---

## Steps to go live

### 1. Create the GHL checkout products (one per deposit tier)
In GoHighLevel, create a payment/checkout page for each **deposit** amount
above (4 deposit products + 1 booking calendar for the $50k consult). Set them
to add a tag on successful payment — use the exact tags below so the payment is
recorded automatically:

| Tier | GHL success tag (must match) |
|---|---|
| Base | `build-base-deposit` |
| Enterprise | `build-enterprise-deposit` |
| Car Rental in a Box | `build-carbox-deposit` |
| E-Commerce | `build-ecom-deposit` |
| Full Ecosystem (consult) | `build-ecosystem-consult` |

These tags are wired into `src/lib/ghl-payment-sync.ts` (`REVENUE_TAGS`), so a
paid deposit auto-creates a `customer_payments` row visible on the admin
**Payments** page. The webhook's actual charged amount takes precedence over the
fallback figures in the table above.

### 2. Set the Vercel env vars
On the marketing app (`aixmos-landing` / wherever `/build` is served), set:

```
NEXT_PUBLIC_GHL_CHECKOUT_3750=https://link.gohighlevel.com/...   # already existed
NEXT_PUBLIC_GHL_CHECKOUT_7500=https://link.gohighlevel.com/...
NEXT_PUBLIC_GHL_CHECKOUT_15000=https://link.gohighlevel.com/...
NEXT_PUBLIC_GHL_CHECKOUT_25000=https://link.gohighlevel.com/...
NEXT_PUBLIC_GHL_CONSULT_CALL=https://link.gohighlevel.com/widget/booking/...
NEXT_PUBLIC_SUPPORT_PHONE=...        # optional, shown on the page
NEXT_PUBLIC_SUPPORT_EMAIL=...        # optional
```

Confirm `GHL_WEBHOOK_SECRET` is set on the app that receives the webhook
(`POST /api/webhooks/ghl`) so payment events are accepted.

### 3. Confirm the webhook is connected
In GHL, point the payment/checkout automation at
`https://<your-app>/api/webhooks/ghl` with header
`x-ghl-webhook-secret: <GHL_WEBHOOK_SECRET>`. (This endpoint already records
the $97 membership and credit-guidance payments today.)

### 4. Test end to end (use a $1 test product or Stripe test mode)
1. Open `/build`, click **Reserve your build** on a tier → lands on the GHL checkout.
2. Complete a test payment.
3. GHL fires the success tag → webhook → check the admin **Payments** page for a
   new row (correct amount, `product_code` = `build_*`, status **Paid**).
4. Verify the lead/customer linked correctly (the sync matches by email/phone).

### 5. Flip it live
Once checkouts work and copy/prices are approved:
- Add a link to `/build` from your public nav / funnel (it's intentionally
  unlinked today).
- To let search engines index it, remove `robots: { index: false }` from
  `src/app/build/page.tsx` (note: middleware still sets a site-wide
  `X-Robots-Tag: noindex` — adjust there if you want it indexed).

---

## Built-in reliability (already shipped)
- ✅ **Webhook idempotency** — `recordGhlPayment()` de-dupes on the transaction
  id (`transaction_id`/`order_id`/`payment_id`/`charge_id`/`invoice_id`). A
  retried or duplicate webhook won't create a second `customer_payments` row.
  Recurring charges (e.g. monthly $97) are unaffected — generic `id`/`contact_id`
  are intentionally not used for de-dup.
- ✅ **Affiliate attribution** — if the payment carries an affiliate code
  (explicit field, or an `aff-`/`ref-`/`via-<code>` tag) it's stamped on the
  payment record (`aff: <code>` in notes) so high-ticket sales can be tied back
  to the referrer. To pay commissions, pass the affiliate code on the GHL
  checkout (e.g. Rewardful/FirstPromoter referral → tag). See
  `docs/AFFILIATE_RECRUITMENT_KIT.md`.

## Further hardening (optional, not required to collect money)
- **Balance tracking**: record the invoiced balance as a `Pending`
  `customer_payments` row at kickoff so the ledger shows full contract value.
- **Refund/chargeback status** column on `customer_payments`.
- **Dedicated `affiliate_code` column** (currently stored in notes) once you
  build affiliate payout reporting.
