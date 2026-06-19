# GHL Copy-Paste Pack — paste this straight into GoHighLevel

**For:** PROJECT X · **Date:** 2026-06-18 · Companion to `ACTIVATE-GHL-MONEY-COLLECTION.md`
Everything here is ready to paste. Prices from your price ladder — adjust any before publishing.
**Credit items use CROA/FTC-safe wording — do not change them to promise results.**

---

## A. PRODUCTS — create each in GHL → Payments → Products
> **Billing:** "one-time" = single charge · "mo" = recurring subscription · "setup + mo" = initial charge then monthly.
> **On purchase:** add the listed tag(s) — that's what fires your webhook + automations.

| # | Product name (paste) | Price | Billing | On-purchase tag(s) | Env var for its link |
|---|---|---|---|---|---|
| 1 | AIXMOS Membership | $97 | mo | `member-97`, `ready-for-aixmos` | `NEXT_PUBLIC_GHL_CHECKOUT_97` |
| 2 | Credit Audit | $97 | one-time | `credit-guidance`, `lane-a-credit` | `NEXT_PUBLIC_GHL_CREDIT_GUIDANCE` |
| 3 | Credit Guidance Program | $750 | one-time | `credit-guidance`, `lane-a-credit` | `GHL_CREDIT_GUIDANCE` |
| 4 | Halal Credit Program | $97 | one-time | `credit-guidance`, `lane-a-credit` | — (add var if needed) |
| 5 | Funding Readiness | $1,500 | one-time | `credit-guidance`, `lane-a-credit` | — |
| 6 | VIP Coaching | $3,000 | one-time | `member-97` | — |
| 7 | OPS-001 Kit | $997 setup + $297/mo | setup + mo | `member-97`, `ready-for-aixmos` | `GHL_CHECKOUT_OPS_KIT` |
| 8 | OPS-001 Kit (USB) | $997 setup + $297/mo | setup + mo | `member-97`, `ready-for-aixmos` | `GHL_CHECKOUT_OPS_KIT_USB` |
| 9 | CMD-001 Kit | $2,997 setup + $497/mo | setup + mo | `member-97`, `ready-for-aixmos` | `GHL_CHECKOUT_COMMAND_KIT` |
| 10 | CMD-001 Kit (USB) | $2,997 setup + $497/mo | setup + mo | `member-97`, `ready-for-aixmos` | `GHL_CHECKOUT_COMMAND_KIT_USB` |
| 11 | DLR-BND Bundle | $3,497 setup + $697/mo | setup + mo | `member-97`, `ready-for-aixmos` | `GHL_CHECKOUT_DEALER_BUNDLE` |
| 12 | GHL Sub-Account (resell) | $197 | mo | `member-97` | — |
| 13 | LLC Formation | (your price) | one-time | `member-97` | `GHL_CHECKOUT_LLC` |
| 14 | Discovery / Consult Call | $0 or your price | one-time | `consult-booked` | `GHL_CONSULT_CALL` |
| 15 | Operator Application | $0 (deposit optional) | one-time | `operator-applied` | `NEXT_PUBLIC_GHL_OPERATOR_APPLY` |
| 16 | Empire Build (custom) | $7,500–$100,000 | quote | `member-97` | — (quote via Consult, not a fixed link) |
| 17 | Cohort #1 Seat | $7,997 / $9,997 | one-time (split) | `member-97`, `ready-for-aixmos` | — |

### Product descriptions to paste (compliant)
- **AIXMOS Membership:** "Access to the AIXMOS engine + the Learn·Earn·Churn program. Software & education. Cancel anytime."
- **Credit Audit / Credit Guidance / Halal Credit / Funding Readiness (ALL credit items):**
  "Educational review and guidance to help you understand your own credit and funding options.
  **This is education and software, not credit repair. We do not guarantee results, remove items, or
  raise scores. Results vary. Not financial or legal advice.**"  ← keep this wording.
- **Kits (OPS/CMD/DLR):** "Done-for-you AIXMOS operator deployment + monthly engine access & support."
- **Operator Application:** "Apply to run AIXMOS in your area. Reviewed before access is granted."

## B. TAGS — create once, exact spelling (GHL → Settings → Tags)
**Lane tags (routing):**
`lane-a-credit`, `lane-b-transport`, `lane-a-source-tmmt`, `lane-a-source-moe-ads`, `lane-b-source-moe`
**Product/event tags (your CODE reacts to these — spelling matters):**
`member-97`, `ready-for-aixmos`, `credit-guidance`, `consult-booked`, `operator-applied`, `funded`, `credit-consult-booked`

## C. CUSTOM FIELD (GHL → Settings → Custom Fields)
- `lane_handoff_at` — type **Date**. Set by W1/W2. Powers the Friday Recap lane counts.

## D. PIPELINE STAGES
Use the full recommended set in `docs/GHL-PIPELINE-SETUP.md` §"Pipeline stages". Must-haves for handoffs:
- Moe Legacy pipeline → stage **"New — from ecosystem"**
- TMMT RENTALS pipeline → stage **"New — from Moe Legacy"**

## E. WORKFLOWS (build 3 — verbatim from LANE_WIRING_GHL.md)
- **W1 — Lane A handoff:** Trigger = tag `credit-consult-booked` added, OR `credit-funding-intake`
  form submitted, OR agent flags credit intent. Actions = add `lane-a-credit`; add `lane-a-source-tmmt`
  UNLESS contact already has `lane-a-source-moe-ads`; set `lane_handoff_at`; move to Moe Legacy
  "New — from ecosystem".
- **W2 — Lane B handoff:** Trigger = tag `funded` added, OR agent flags "needs vehicle", OR rental
  inquiry on a Moe surface. Actions = add `lane-b-transport` + `lane-b-source-moe`; set `lane_handoff_at`;
  stamp `aff: moe-legacy` in notes ONLY if no prior code (first-touch wins); move to TMMT RENTALS
  "New — from Moe Legacy".
- **W3 — Lane integrity guard (weekly):** list `lane-a-credit` not in a Moe pipeline + `lane-b-transport`
  not in a TMMT pipeline → post count to Slack #ops. Goal = zero.
- **PAYMENT webhook (add to any money workflow):** Webhook step → `POST https://<your-app>/api/webhooks/ghl`,
  header `x-ghl-webhook-secret: <GHL_WEBHOOK_SECRET>`. This is what records the sale + (soon) tops up tokens.

## F. ENV FILL SHEET — after links exist, set in Vercel then `vercel env pull .env --environment=production`
```
NEXT_PUBLIC_GHL_CHECKOUT_97       = <AIXMOS Membership $97/mo link>
NEXT_PUBLIC_GHL_CREDIT_GUIDANCE   = <Credit Audit $97 link>
NEXT_PUBLIC_GHL_OPERATOR_APPLY    = <Operator Application link>
GHL_CREDIT_GUIDANCE               = <Credit Guidance Program $750 link>
GHL_CHECKOUT_OPS_KIT              = <OPS-001 link>      GHL_CHECKOUT_OPS_KIT_USB     = <OPS-001 USB link>
GHL_CHECKOUT_COMMAND_KIT          = <CMD-001 link>      GHL_CHECKOUT_COMMAND_KIT_USB = <CMD-001 USB link>
GHL_CHECKOUT_DEALER_BUNDLE        = <DLR-BND link>      GHL_CHECKOUT_LLC             = <LLC Formation link>
GHL_CONSULT_CALL                  = <Consult Call link>
# already needed: GHL_API_KEY, GHL_LOCATION_ID, GHL_WEBHOOK_SECRET
```

## G. PRODUCTS CSV (if your GHL plan supports product import)
```csv
name,price,billing,on_purchase_tags
AIXMOS Membership,97,monthly,"member-97;ready-for-aixmos"
Credit Audit,97,one_time,"credit-guidance;lane-a-credit"
Credit Guidance Program,750,one_time,"credit-guidance;lane-a-credit"
Halal Credit Program,97,one_time,"credit-guidance;lane-a-credit"
Funding Readiness,1500,one_time,"credit-guidance;lane-a-credit"
VIP Coaching,3000,one_time,"member-97"
OPS-001 Kit,997,setup_plus_297_monthly,"member-97;ready-for-aixmos"
CMD-001 Kit,2997,setup_plus_497_monthly,"member-97;ready-for-aixmos"
DLR-BND Bundle,3497,setup_plus_697_monthly,"member-97;ready-for-aixmos"
GHL Sub-Account,197,monthly,"member-97"
```

## ⚠️ Reminder (the protection)
Money from ALL of these must deposit to All In One Management's **business** account (Step 0 of the
activation runbook). Credit-lane (Moe/Umar) revenue stays fenced from your software/agency revenue.
