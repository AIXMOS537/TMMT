# Mom-and-pop dealership — 10/10 readiness checklist

**ICP:** Independent BHPH / single-lot dealers (1–3 locations, 5–40 units).  
**Demo URL (share this):** https://tmmt-ops.vercel.app/kits  
**Sales 1-pager:** [DEALER-KIT-ONE-PAGER.md](./DEALER-KIT-ONE-PAGER.md)

---

## Score today: **6.5 / 10** sell-ready (pitch + demo) · **4 / 10** close-ready (money)

| Layer | Score | Status |
|-------|-------|--------|
| Product (Ops + Command + Bundle) | 9/10 | Built, priced, documented |
| Demo pages live | 8/10 | `/kits`, `/build`, `/forms/lead-intake` = 200 |
| Funnel pages public | 5/10 | `/lp/*`, `/join`, `/api/health` fixed in code — **needs deploy** |
| Checkout / take money | 2/10 | GHL env unset · billing card declining |
| Per-dealer isolation | 8/10 | Documented separate-instance flow; not automated |
| Mom-pop marketing copy | 7/10 | Kits page updated; no dedicated BHPH landing yet |
| Onboarding / USB kit | 7/10 | Flash-drive docs exist; E2E untested |
| Credit stack-on | 3/10 | Legal-gated L1–L10 |
| Voice AI (Bella) | 6/10 | Pack exists; not wired for dealer demo |
| Custom domain trust | 1/10 | Still `.vercel.app`; DNS empty |

**To hit 10/10 for mom-and-pop ASAP:** deploy code fixes → wire GHL checkout → one pilot dealer on dedicated instance.

---

## What to demo (5 minutes)

1. **https://tmmt-ops.vercel.app/kits** — Ops ($997) vs Dealer Bundle ($3,497)
2. **https://tmmt-ops.vercel.app/forms/lead-intake** — how their customers get on the lot
3. **https://tmmt-ops.vercel.app/build** — Car Rental in a Box ($15K) for bigger shops
4. Say: *"You get your own system — your customers, your data. We deploy and train. Not a shared login."*

---

## Close packages (mom-and-pop first)

| Package | Setup | Monthly | Best for |
|---------|-------|---------|----------|
| **Ops Kit** | $997 | $297/location | Floor manager, fleet desk only |
| **Dealer Bundle** | $3,497 | $697 | Owner who wants ops + command |
| **Car Rental in a Box** | $15,000 | custom | Full build + hand-hold |

---

## Rick-fixed tonight (code — deploy to go live)

- [x] Middleware: `/lp/*`, `/join`, `/api/health`, `/api/leads/*` public (no login redirect)
- [x] `/api/health` route for smoke tests
- [x] `/join` → redirects to `/kits`
- [x] Kit CTAs fall back to **lead intake** when GHL checkout unset (no dead buttons)
- [x] Kits hero copy targets independent / mom-and-pop dealers

**Deploy:** `bash scripts/ship.sh --yes` from clean `master` after verify passes.

---

## Owner walls (cannot automate)

1. GHL billing card + create checkout products (C1–C7 in ACTION-CHECKLIST)
2. Vercel env: `NEXT_PUBLIC_GHL_CHECKOUT_*` for Ops, Bundle, monthly
3. Custom domain DNS (`tmmtrentals.com` / `.net`)
4. NextInsurance before Jul 12 (fleet credibility)
5. Legal L1–L10 before selling credit/funding to dealer customers

---

## Pilot dealer playbook (first mom-and-pop close)

1. Demo on **tmmt-ops** (never command-center for sales pages)
2. CTA → lead intake (until GHL live) or Dealer Bundle checkout
3. Tag GHL: `dealer-prospect` → `kit-ordered-dealer-bundle` → `kit-shipped`
4. Provision: new Supabase + Vercel deploy per [DEPLOY.md](../DEPLOY.md)
5. Hand **OPERATOR-START-HERE.md** + one admin login
6. 14-day hand-hold window (adjust in contract)

**Hard rule:** Never onboard independent dealers on shared TMMT database.

---

## YTD assets inventory (what we built to sell)

| Asset | Path / URL |
|-------|------------|
| Dealer 1-pager | `docs/sales/DEALER-KIT-ONE-PAGER.md` |
| Flash-drive product line | `docs/FLASH-DRIVE-PRODUCT-LINE.md` |
| Sales channels + GHL tags | `docs/SALES-CHANNELS.md` |
| Kits landing | `src/app/kits/page.tsx` |
| High-ticket build funnel | `src/app/build/page.tsx` |
| LP SKUs (lead-magnet, rental-in-a-box) | `src/app/lp/[org]/[sku]/page.tsx` |
| GHL dealer pipeline sync | `src/lib/ghl/dealer-lead-sync.ts` |
| Operator onboarding | `OPERATOR-START-HERE.md`, `scripts/onboard-op` |
| Empire scorecard | `docs/EMPIRE-READINESS-SCORECARD.md` |

---

*Updated: 2026-07-08 · Rick autonomous audit*
