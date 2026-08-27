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
| `aixmos-prequal` | **Second door.** Declined on their own profile before ever renting — see *Phase 0* |
| `market-waitlist` | Declined on geography only. **Not a credit lead** — hold for market expansion |
| `tmmt-requalified` | Finished AIXMOS work and is eligible again — hand back to TMMT |

## Phase 0 — the second door (declined applicants)

Everything below Phase 1 assumes the person **completed a rental happily**.
`ready-for-aixmos` is explicitly gated on `rental-completed`, which means a
person who was never approved for a car can never enter the funnel — even
though they are exactly who AIXMOS was built for.

`aixmos-prequal` is that second entrance. It runs off
`background_checks.eligibility_status`, decided in code by
`decidePrequalRoute()` in `src/lib/aixmos-prequal.ts`.

**Not every decline is a credit problem.** Live counts across 299 checks:

| eligibility_status | people | routes to | tag |
|---|---:|---|---|
| `Eligible` | 81 | nothing — Phase 1 owns them | — |
| `Need Manager's Review` | 69 | wait for the human | — |
| *(null)* | 67 | nothing | — |
| `out of radius` | 49 | market expansion, **not credit** | `market-waitlist` |
| `Not Eligible` | 24 | AIXMOS prequal | `aixmos-prequal` |
| `Not found` | 9 | re-run the check | — |

Selling credit guidance to the 49 people whose only problem is distance would
be wrong and would read as spam. They get held, not pitched.

**Trigger:** Tag `aixmos-prequal` added
**Actions:**

1. SMS — acknowledge the decline plainly, offer the path. No score promises.
2. On reply, book the credit consult → `credit-consult-booked`
3. Paid program → `credit-guidance-active` — rejoins the main pipeline at stage 9
4. When `funding_ready` or `elite` → add `tmmt-requalified` and route **back**
   to TMMT as a fresh rental applicant

**Consent gate.** The database function that moves a person between the two
companies — `request_handoff(...)` — takes a `p_consent_channel` argument, and
`handoffArgs()` returns `null` without it. Capture consent on the decline SMS
before any cross-company handoff. This is not optional plumbing; it is why the
argument exists.

**Do not** let `aixmos-prequal` and `ready-for-aixmos` share a workflow. They
describe opposite situations — one has never rented, the other rented and
loved it — and the copy for each is different.

**Where this fires.** The call site is saving a background check in the admin —
`saveBackgroundCheck()` in `src/app/(admin)/background-checks/actions.ts`, which
calls `routeDeclinedApplicant()` in `src/lib/aixmos-prequal-act.ts`. Setting
eligibility is the moment the lane exists; lead intake is too early, because a
new lead has no eligibility outcome and no credit file to route on.

The same form now carries an **AIXMOS handoff consent** field. Leave it at *Not
captured yet* and the tag still goes out while the handoff waits — which is the
normal path, since the tag is what starts the SMS that asks. Set it once the
person says yes and the handoff is created on save.

One naming trap worth writing down: `partner_referrals` CHECKs `source_org` and
`dest_org` against `'tmmt'` and `'aixmos'` — the entity slugs, **not** the
`organizations.name` values `TMMT RENTALS` and `AIXMOS`. Passing the names makes
`request_handoff()` fail the constraint. `HANDOFF_ORG` in `aixmos-prequal.ts`
holds the accepted values.

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
