# GoHighLevel — AIXMOS × TMMT pipeline setup

Configure in GHL (Locations → your AIXMOS/TMMT location). This doc matches the funnel in [`AIXMOS-TMMT-FUNNEL.md`](AIXMOS-TMMT-FUNNEL.md).

## Tags

Create these tags before automations:

| Tag | When to apply |
|-----|----------------|
| `tmmt-customer` | New renter or lead from TMMT |
| `rental-active` | Vehicle out on contract |
| `rental-completed` | Return completed, no open balance dispute |
| `ready-for-aixmos` | Owner/VA confirms happy customer — **required before membership pitch** |
| `member-97` | $97/mo subscription active |
| `membership-offered` | Pitch sent, not yet paid |
| `credit-consult-booked` | Consult scheduled |
| `credit-guidance-active` | Paid credit guidance program |
| `funding-prep` | Ready for funding partner handoff |

## Pipeline stages (recommended)

**Pipeline name:** `TMMT → AIXMOS`

1. TMMT Lead  
2. TMMT Customer (rental booked)  
3. Rental Active  
4. Rental Completed  
5. Ready for AIXMOS *(tag `ready-for-aixmos`)*  
6. Membership Offered  
7. Member $97  
8. Credit Consult Booked  
9. Credit Guidance Active  
10. Funding Prep  
11. Funded / Closed Won  

## Phase 1 — Post-rental nurture (no AIXMOS pitch)

**Trigger:** Tag `rental-completed` added  
**Wait:** 7 days  
**Actions:**

1. SMS — thank you + “How was the vehicle?” (CHUMMO voice, &lt;160 chars)  
2. Wait 3 days  
3. Task for VA — one human call or WhatsApp  
4. Wait 4 days  
5. **Internal only:** If positive outcome → add tag `ready-for-aixmos` (manual or survey “5 = great”)

Do **not** send $97 link until step 5.

## Phase 2 — Membership upsell

**Trigger:** Tag `ready-for-aixmos`  
**Actions:**

1. Email — value of AIXMOS ecosystem (no credit guarantees)  
2. SMS — single CTA to membership checkout  
3. Add tag `membership-offered`  
4. Move stage → Membership Offered  

**Checkout URL:** set `NEXT_PUBLIC_GHL_CHECKOUT_97` in Vercel → runs `npm run prebuild` → [`public/aixmos/ghl-config.js`](../public/aixmos/ghl-config.js)

## Phase 3 — Credit guidance

**Trigger:** Tag `member-97` + intake form submitted  
**Actions:**

1. Move to Credit Consult Booked  
2. VA sends consult calendar link  
3. On payment → `credit-guidance-active` + stage Credit Guidance Active  
4. Follow [`sops/CREDIT-GUIDANCE-SOP.md`](sops/CREDIT-GUIDANCE-SOP.md)

## Owner hub shortcut

In TMMT owner hub (`.net`) → **AIXMOS upsell queue** → set `NEXT_PUBLIC_GHL_UPSELL_PIPELINE_URL` to your GHL filtered view (contacts with `ready-for-aixmos`).

## CSV tracker

Update live URLs in [`AIXMOS/airtable/csv/GHL_Links.csv`](../AIXMOS/airtable/csv/GHL_Links.csv) when links are live.
