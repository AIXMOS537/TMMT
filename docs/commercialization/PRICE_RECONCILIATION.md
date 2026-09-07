# PRICE RECONCILIATION

**Every monetary term in the system, its surface, and where it conflicts.**

Audit date: 2026-09-07 · Repo `TMMT-LIVE` @ `6a2b5aff` · DB `uapxakmlwnpfsftfeezx`
Companion to `COMMERCIAL_MASTER.md`. Decisions live in `OWNER_DECISIONS.md`.

> **This document selects no winners.** The "Recommended Authority" column names
> the source that *should govern* on the evidence, and is a recommendation only.
> No price has been changed anywhere.

**Legend — Billing Basis:** `ONE-TIME` · `RECURRING/mo` · `SETUP+MO` ·
`RANGE` · `THRESHOLD` (a trigger, not a price) · `DEPOSIT` · `INBOUND`
(money flowing to TMMT from an operator) · `COMMISSION`.

---

## 0. THE SHAPE OF THE PROBLEM

There is no single price list. There are **three rival ladders**, plus four
independent pricing systems in the database, plus a static marketing tree whose
deployment status cannot be determined from the repo.

| Ladder | Where it lives | Evidence strength | Sells |
|---|---|---|---|
| **A — OFFER-STACK** | `docs/OFFER-STACK.md` (self-declares "canonical pricing for the whole network", `:3`) | Docs only. No code reads it. | BUILD $1,875→$100K + RUN $97/$1,875/$3,750/$7,500 per month |
| **B — Storefront kits** | `src/app/kits/page.tsx`, `src/app/dealers/page.tsx` | **Shipped code + 10 docs agree.** Public. | $997/$2,997/$3,497 setup + $297/$497/$697 mo |
| **C — `/build` high-ticket** | `src/lib/high-ticket.ts` | Shipped code, deposits enforced. Public. | $3,750 → $50,000 |

**Ladder A contains none of Ladder B's SKUs, and Ladder B contains none of
Ladder A's numbers.** The contract templates (`docs/deal-kit/PAYMENT-SCHEDULE.md:5`)
point at Ladder A — which does not price what the storefront actually sells.

---

## 1. MASTER RECONCILIATION TABLE

### 1.1 Operator / membership seat — **BOTH PRICES ARE PUBLICLY LIVE**

| Offering | Surface | Amount | Billing Basis | Audience | Existing/Proposed | Conflict | Recommended Authority |
|---|---|---|---|---|---|---|---|
| Operator seat · 2,000 tokens | **PUBLIC** `/forms`, `/forms/operator-apply` — `src/lib/forms/catalog.ts:65-70`; `src/app/forms/operator-apply/page.tsx:12,14` | **$297** | RECURRING/mo | Operator applicants | EXISTING | **C-2 · direct** | ⚠️ **Undeliverable — see note** |
| Lead value written to DB | `src/app/forms/actions.ts:686` → `incoming_leads.priceCents` | **29700** | — | internal | EXISTING | records the $297 as lead value | — |
| AIXMOS Operator · 500 tokens | **PUBLIC** `/kits` — `src/app/kits/page.tsx:37,63,103,199` | **$97** | RECURRING/mo | Operators / members | EXISTING | **C-2 · direct** | ✅ **`kits/page.tsx` + `OFFER-STACK.md:72`** |
| Operator Seat | `docs/OFFER-STACK.md:72` | $97/seat | RECURRING/mo | Operators | EXISTING | agrees with `/kits` | ✅ |
| AIXMOS Membership | **PUBLIC** `/upgrade` — `src/lib/ghl-offers.ts:137` | $97 | RECURRING/mo | Members | EXISTING | naming only | ✅ |
| Academy seat · 500 tokens | `src/lib/forms/catalog.ts:54,57,59` | $97 | RECURRING/mo | Students | EXISTING | same file prices "Operator" at $297 | ✅ |
| Operator onboarding fee | `scripts/onboard:31` — `FEE_CENTS=9700` | $97 | — | internal | EXISTING | agrees with $97 | ✅ |
| Operator licence fee | **DB** `operator_profiles.license_fee_cents` (max 9700) | $97 | RECURRING/mo | Operators | EXISTING | agrees with $97 | ✅ |
| Curriculum reference | `src/lib/operator/academy-modules.ts:41,125,132,202` | $97/mo · 500 tokens | RECURRING/mo | Operators | EXISTING | agrees | ✅ |
| Static tree | `AIXMOS/public/forms/index.html:29` "Operator $297" **and** `AIXMOS/public/index.html` "$97 operator seat" | both | RECURRING/mo | public | EXISTING | **carries the conflict too** | ⚠️ deployment status undetermined |

> ⚠️ **The $297 seat cannot be fulfilled.** `src/lib/token-ledger.ts:30-45` can
> grant **only 500 tokens**, and only on tag `member-97`. Nothing in the system can
> deliver the advertised **2,000 tokens**. This is not merely a price conflict — it
> is a public offer the platform cannot honour.
>
> **Origin (git):** the collision was created three days apart and neither commit
> touched the other's file. `9e97dd8b` (2026-08-19) introduced the $297 / 2,000-token
> form. `8e4a5d7f` (2026-08-22) renamed the pre-existing **$97 Academy** card to
> **"AIXMOS Operator"**, colliding the name onto the cheaper product. `setup: "$97"`
> predates that rename and was not changed.
>
> `src/lib/forms/catalog.ts` is read by exactly one file (`src/app/forms/page.tsx:2`,
> prints `f.cost` at `:54`), so the blast radius of correcting it is one page.

### 1.2 Dealer kit storefront — Ladder B (internally consistent)

| Offering | Surface | Amount | Billing Basis | Audience | Existing/Proposed | Conflict | Recommended Authority |
|---|---|---|---|---|---|---|---|
| Ops Kit | **PUBLIC** `/kits` `:9-10`; `/dealers:109` | $997 + $297/mo | SETUP+MO | Mom-and-pop dealers | EXISTING | none | ✅ `kits/page.tsx` |
| Command Kit | **PUBLIC** `/kits` `:23-24` | $2,997 + $497/mo | SETUP+MO | Dealers | EXISTING | none | ✅ |
| Dealer Bundle | **PUBLIC** `/kits:180`; `/dealers:131` | $3,497 + $697/mo | SETUP+MO | Dealers | EXISTING | none | ✅ |
| Bundle saving claim | `/kits:177`; `docs/sales/DEALER-KIT-ONE-PAGER.md:18` | "save $497" | — | Dealers | EXISTING | **understated** | ✅ arithmetic verified |
| Order-bump alternative | `docs/SALES-CHANNELS.md:74` "Add Command Kit for $2,000" | $2,997 total | SETUP | Dealers | EXISTING | **$500 cheaper than the $3,497 bundle for the same two kits** | ⚠️ undercuts the bundle |

**Arithmetic check (both verified):** setup $997 + $2,997 = $3,994 vs $3,497 → the
advertised **$497** saving is correct. Monthly $297 + $497 = $794 vs $697 → a
further **$97/mo** saving that no document states. First-year true saving is
**$497 + $1,164 = $1,661**, marketed as $497.

### 1.3 `/build` high-ticket — Ladder C (deposits enforced in code)

| Offering | Surface | Amount | Billing Basis | Audience | Existing/Proposed | Conflict | Recommended Authority |
|---|---|---|---|---|---|---|---|
| Base Infrastructure | **PUBLIC** `/build` — `high-ticket.ts:54-56` | $3,750 (full deposit) | ONE-TIME | SMB | EXISTING | vs Ladder A $3,750 rung **and** $3,750/mo RUN | ⚠️ **C-7** |
| Enterprise Systems | `high-ticket.ts:73` | $7,500 (dep. $3,750) | ONE-TIME | SMB | EXISTING | vs $7,500/mo RUN | ⚠️ **C-6** |
| Car Rental in a Box | `high-ticket.ts:88-95` | $15,000 (dep. $7,500) | ONE-TIME | Rental operators | EXISTING | vs Ladder A "$15K agency" | ⚠️ **C-3** |
| E-Commerce Ecosystem | `high-ticket.ts:108-115` | $25,000 (dep. $12,500) | ONE-TIME | Sellers | EXISTING | vs Ladder A "$25K credit+funding vertical" | ⚠️ **C-4** |
| Full Ecosystem | `high-ticket.ts:126-142` | $50,000, consult-only | ONE-TIME | Enterprise | EXISTING | **one of seven $50K meanings** | ⚠️ **C-5** |

### 1.4 OFFER-STACK — Ladder A (docs only, self-declared canonical)

| Offering | Surface | Amount | Billing Basis | Audience | Existing/Proposed | Conflict | Recommended Authority |
|---|---|---|---|---|---|---|---|
| BUILD rung 1 | `OFFER-STACK.md:29` | $1,875 | ONE-TIME | Entry operator | EXISTING | = Credit Guidance **$1,875/mo** `:73` | ⚠️ **C-7** |
| BUILD rung 2 | `:30` | $3,750 | ONE-TIME | Operator | EXISTING | = Fleet Mgmt **$3,750/mo** `:74` | ⚠️ **C-7** |
| BUILD rung 3 | `:31` | $7,500 | ONE-TIME | Operator | EXISTING | = Full-Service **$7,500/mo** `:75` | ⚠️ **C-6** |
| BUILD rung 4 | `:32` | $15,000 | ONE-TIME | Agency | EXISTING | self-contradicts `:79-80` ("$15K (agency)" vs "car-rental vertical") | ⚠️ **C-3** |
| BUILD rung 5 | `:33` | $25,000 | ONE-TIME | Inner circle | EXISTING | says "**credit-repair**", violating its own rule at `:145` | ⚠️ **C-4 + compliance** |
| BUILD rung 6 | `:34` | $35,000 | ONE-TIME | Combined | EXISTING | "car included **or** no backend funding fee" — fee never defined | ⚠️ **C-13** |
| BUILD rung 7 | `:35` | $45,000–$50,000 | RANGE | Full stack | EXISTING | one of seven $50K meanings | ⚠️ **C-5** |
| BUILD apex | `:36` | $100,000 | ONE-TIME | Investor | EXISTING | "eventually"; `:139-140` says never public | ⚠️ **C-14** |
| RUN · Operator Seat | `:72` | $97/seat | RECURRING/mo | Operators | EXISTING | agrees with `/kits` | ✅ |
| RUN · Credit Guidance Basic | `:73` | $1,875/mo | RECURRING/mo | Credit clients | EXISTING | **C-8** — priced 4 other ways | ⚠️ |
| RUN · Fleet Management | `:74` | $3,750/mo | RECURRING/mo | Fleet | EXISTING | **C-7** | ⚠️ |
| RUN · Full-Service | `:75` | $7,500/mo | RECURRING/mo | Managed ops | EXISTING | **C-6** | ⚠️ |
| Engagement terms | `:88-95` | 50% deposit = GO; non-refundable; 10% max price-match | DEPOSIT | all | EXISTING | none | ✅ **only source** |

### 1.5 The `packages` table (production DB) — entitlement bundles

| Offering | Surface | Amount | Billing Basis | Audience | Existing/Proposed | Conflict | Recommended Authority |
|---|---|---|---|---|---|---|---|
| `resale_airtable_starter` | DB `packages` | $1,875 | **UNSPECIFIED** | Resale | EXISTING | no `billing_interval` — cannot distinguish rung from retainer | ⚠️ **structural** |
| `resale_airtable_pro` | DB | $3,750 | UNSPECIFIED | Resale | EXISTING | same | ⚠️ |
| `resale_airtable_automations` | DB | $7,500 | UNSPECIFIED | Resale | EXISTING | same | ⚠️ |
| `resale_business_in_a_box` | DB | $15,000 | UNSPECIFIED | Resale | EXISTING | same | ⚠️ |
| `resale_box_plus_car` | DB | $25,000 | UNSPECIFIED | Resale | EXISTING | **grants identical entitlements to `business_in_a_box`** — the $10k delta is unmodelled | ⚠️ |
| `resale_full_stack_max` | DB | $35,000–$50,000 | RANGE | Resale | EXISTING | **collapses Ladder A's $35K and $45–50K into one row** | ⚠️ |
| `starter`/`growth`/`elite`/`custom` | DB | **null** | — | Entitlement tiers | EXISTING | not on any ladder | ✅ leave null |

### 1.6 Credit lane — five prices for one concept

| Offering | Surface | Amount | Billing Basis | Audience | Existing/Proposed | Conflict | Recommended Authority |
|---|---|---|---|---|---|---|---|
| Credit enrollment | **DB** `credit_product_catalog.path_a_monthly_97` | up to $97/mo (9700¢) | RECURRING/mo | Consumers | EXISTING | **C-8** | ✅ **DB is executable** |
| Credit payment plan | **DB** `path_b_plan_500` | $250 + $250 (50000¢) | ONE-TIME (split) | Consumers | EXISTING | — | ✅ |
| Credit mentorship DFY | **DB** `path_c_mentorship_1000` | $1,000 (100000¢) | ONE-TIME add-on | Consumers | EXISTING | — | ✅ |
| Credit Guidance Basic | `OFFER-STACK.md:73` | $1,875/mo | RECURRING/mo | Consumers | EXISTING | **C-8** | ⚠️ |
| Credit Guidance band | `docs/pitch/02-credit-guidance.md:52,90,120,164,178` + 5 more | $500–$1,000 | ONE-TIME | Consumers | EXISTING | **C-8** | ⚠️ |
| Credit Guidance Program | `docs/runbooks/GHL-COPY-PASTE-PACK.md:17` | $750 flat | ONE-TIME | Consumers | EXISTING | **C-8** | ⚠️ |
| Credit Audit | **PUBLIC** `/lp/*/intro-97` — `copy.ts:32,39` | $97 | **ONE-TIME** | Consumers | EXISTING | **C-9 — `/try` sells it as $97/mo** | ⚠️ |
| Halal Credit Program | `GHL-COPY-PASTE-PACK.md:17` row 4 | $97 | ONE-TIME | Consumers | EXISTING | third distinct $97 | ⚠️ |
| Funding Readiness | `GHL-COPY-PASTE-PACK.md` row 5 | $1,500 | ONE-TIME | Consumers | EXISTING | not in any ladder | ⚠️ |
| VIP Coaching | `GHL-COPY-PASTE-PACK.md` row 6 | $3,000 | ONE-TIME | Consumers | EXISTING | not in any ladder | ⚠️ |

> **All seven legal gates are CLOSED** (`shared/compliance-gates/gates.config.json`)
> except the permanent CPN prohibition. Nothing in this section may be sold as
> done-for-you credit repair regardless of which price wins.

### 1.7 Sovereign / licensing

| Offering | Surface | Amount | Billing Basis | Audience | Existing/Proposed | Conflict | Recommended Authority |
|---|---|---|---|---|---|---|---|
| Sovereign install | **PUBLIC** `/forms/sovereign:9`; `catalog.ts:79` | **$50,000 once + $97/agent/mo** | ONE-TIME + RECURRING | Enterprise | EXISTING | one of seven $50K meanings | ✅ **only hybrid SKU** |
| Sovereign lead value | `src/app/forms/actions.ts:687`; `api/leads/webhook/route.ts:47` | 5000000¢ | ONE-TIME | internal | EXISTING | **filed under LP sku `flagship`**, whose copy is a *different* unpriced offer ("Full Empire Build", `copy.ts:62-71`) | ⚠️ SKU collision |
| GHL Sub-Account resell | `GHL-COPY-PASTE-PACK.md` row 12 | $197/mo | RECURRING/mo | Operators | EXISTING | not in any ladder | ⚠️ orphan |
| One-time platform licence | `workstream-3/TASKS.md:9` "own forever" | **unpriced** | ONE-TIME | Operators | **BLOCKED** | `:29` "BLOCKED — needs human" | ❌ **OWNER DECISION** |

### 1.8 The seven meanings of $50,000

| # | Concept | Source | Kind |
|---|---|---|---|
| M1 | **Full Ecosystem** build, consult-only, no checkout | `high-ticket.ts:126-142`; `ghl-offers.ts:161`; campaign `build-50000` | ONE-TIME build |
| M2 | **Sovereign install** — $50K once **+ $97/agent/mo** | `forms/sovereign:9`; `catalog.ts:79` | ONE-TIME + RECURRING |
| M3 | **$45–50K flash-deploy band** | `OFFER-STACK.md:38`; `HOMELAND-HQ:68`; `scripts/member:49` | RANGE, 50% deposit |
| M4 | **~$50K/operator DFY incl. 1 year management**, only 10 sought | `PROJECT-X-HAILMARY.md:70-77` | ONE-TIME, capped |
| M5 | **Founder deferral threshold** — "brain free until $50K is collected" | `OFFER-STACK.md:15-16`; `PAYMENT-SCHEDULE.md:10-15`; `CLOSE-CHECKLIST.md:32` | **THRESHOLD — not a price** |
| M6 | **Upfront deposit target** | `OFFER-STACK.md:95` | **DEPOSIT** |
| M7 | **Tier-3 co-investment partnership** — operator pays *in* | `workstream-3/TASKS.md:17,29` | **INBOUND**, blocked |

**M1 and M2 are both public, both say "$50,000", and deliver different things.**
M5, M6 and M7 are not prices at all. Any future sales document using "$50,000"
without naming M1–M7 is ambiguous by construction.

### 1.9 Revenue share, royalty and commission — **five incompatible schemes**

| Scheme | Source | Rate | Status |
|---|---|---|---|
| By operator level | `src/lib/client-journey/types.ts:36-41` | candidate 35 / certified 35 / senior 30 / master 25 | **DEAD CODE — zero importers.** Higher level = *lower* share. |
| By seat stage | `src/lib/verticals/registry.ts:115-144` + `config/verticals.json:15-18` | learn 0 / earn 70 / admin 70 / graduate 85 | ⚠️ **THE ONLY ONE THAT WRITES TO THE DATABASE** via `provision-tenant-seat.mjs:274-297` → `operator_profiles.revenue_share_pct`. **Inverts** the scheme above. |
| CLI default | `scripts/onboard:29` | 30 | A shell default for the same DB column — a third value. |
| Partnership / referral | `AIXMOS/public/operator.html:491,498` | 50/50 or 10% referral | **PUBLIC marketing with a live application form.** Unreferenced by any code. No doc corroborates it. |
| Commission tiers | `workstream-3/TASKS.md:14-17` | T1 $50–$150/referral; funding 1–3% or 15–25% of origination; T2 40–60% | Unchecked backlog. Ranges, not rates. |
| Affiliate (public) | `src/app/forms/affiliates/page.tsx:50`; `catalog.ts:113` | **30% recurring (~$29/mo)**, tiering to 40% | **PUBLIC and live.** |
| Affiliate (contract) | `docs/affiliates/AFFILIATE_AGREEMENT_DRAFT.md:35` | **flat $35 per $97 sale**, tier to $45–50 | **Contradicts the public page.** $35 ≠ 30% of $97 ($29.10). `AFFILIATE_RECRUITMENT_KIT.md:22` reasons "you keep $62 of every $97" — i.e. flat $35, and says "Stay flat". |
| Agency share | **DB** `organizations.agency_revenue_share_pct` = 80 on all 9 orgs | 80% | **DB observation only** — no migration in `supabase/migrations/` defines this column. |

> **VERDICT: no authoritative revenue-share or royalty rate exists anywhere in
> this repository.** `{{REV_SHARE_PCT}}` in the only signable instrument
> (`PAYMENT-SCHEDULE.md:24`) is filled with the literal `[TBD]` by
> `scripts/new-operator:39` — while the *same script* fills late fee (1.5%/mo),
> grace, cure, term and venue. The blank is deliberate, not a tooling gap.
> **`{{ROYALTY}}` is never filled by anything.** `OFFER-STACK.md`, designated "the
> single pricing authority" by `HOMELAND-HQ-AND-OPERATOR-SEATS.md:88`, contains no
> percentage at all.
>
> **OWNER DECISION REQUIRED — no percentage has been invented here.**

### 1.10 Other terms found

| Offering | Surface | Amount | Basis | Conflict |
|---|---|---|---|---|
| Cohort #1 Seat | `GHL-COPY-PASTE-PACK.md:31` | $7,997 / $9,997 | ONE-TIME (split) | vs $7,000 in `MASTER_OPERATOR_RUNBOOK.md:183`; unpriced in landing copy — **C-10** |
| Empire Build (custom) | `GHL-COPY-PASTE-PACK.md:30` | $7,500–$100,000 quote | RANGE | folds the apex into a quote band — **C-14** |
| LLC Formation | `GHL-COPY-PASTE-PACK.md:27` | "(your price)"; slug `llc-397` | ONE-TIME | **only numeric hint is the campaign slug** |
| Discovery / Consult Call | `GHL-COPY-PASTE-PACK.md` row 14 | $0 or your price | ONE-TIME | unset |
| Operator Application | `GHL-COPY-PASTE-PACK.md` row 15 | $0 (deposit optional) | ONE-TIME | unset |
| Growth Kit setup | `docs/FLASH-DRIVE-PRODUCT-LINE.md:11` vs `docs/SALES-CHANNELS.md:53-54` | $97 incl. 1st month **vs** $97 setup **+** $97/mo as two SKUs | — | **$194 in month one if both charged — C-9** |
| Lease-to-Own Standard | `docs/pitch/01-lease-to-own.md:99` | $3,750 down | DEPOSIT | fourth meaning of $3,750 |
| Late fee | `scripts/new-operator:39` | 1.5%/mo | — | ✅ the one commercial variable that *is* filled |

---

## 2. GHL PRODUCT CONFIGURATION — and a defect that would silently cost money

`docs/runbooks/GHL-COPY-PASTE-PACK.md` §A lists **17 products** to create in
GoHighLevel, with prices, billing type, tags and the env var for each link. It is
the closest thing to an activation checklist.

### ⚠️ The env var prefix defect

The application reads checkout links **only** from `NEXT_PUBLIC_`-prefixed
variables. Verified: `grep process.env.GHL_*` across `src/` returns only API,
webhook and location config — **never a checkout link**.

The runbook instructs the owner to set **eight checkout variables without the
prefix**:

| Runbook says | Code actually reads |
|---|---|
| `GHL_CHECKOUT_OPS_KIT` | `NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT` |
| `GHL_CHECKOUT_OPS_KIT_USB` | `NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT_USB` |
| `GHL_CHECKOUT_COMMAND_KIT` | `NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT` |
| `GHL_CHECKOUT_COMMAND_KIT_USB` | `NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT_USB` |
| `GHL_CHECKOUT_DEALER_BUNDLE` | `NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE` |
| `GHL_CHECKOUT_LLC` | `NEXT_PUBLIC_GHL_CHECKOUT_LLC` |
| `GHL_CONSULT_CALL` | `NEXT_PUBLIC_GHL_CONSULT_CALL` |
| `GHL_CREDIT_GUIDANCE` | `NEXT_PUBLIC_GHL_CREDIT_GUIDANCE` |

**Consequence if followed literally:** all five kit checkout links plus LLC,
consult and credit-guidance would resolve to `""`, and `checkoutHref()` would
silently fall back to the generic GHL campaign site. Every button would still
"work" — the owner would see no error — while every product-specific checkout was
dead. The runbook is internally inconsistent too: rows 1, 2 and 15 *do* use the
`NEXT_PUBLIC_` prefix.

### ⚠️ Three recurring-checkout variables are undocumented

`src/lib/kit-checkout.ts:9,12,16` reads three variables that appear **nowhere** in
`.env.example` and nowhere in the runbook:

- `NEXT_PUBLIC_GHL_CHECKOUT_OPS_MONTHLY` — the $297/mo link
- `NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_MONTHLY` — the $497/mo link
- `NEXT_PUBLIC_GHL_CHECKOUT_DEALER_MONTHLY` — the $697/mo link

**The entire recurring half of Ladder B has no documented configuration path.**

---

## 3. PAYMENT READINESS — three separate questions

### 3.1 CODE READINESS — ✅ **READY**

`checkoutHref()` (`src/lib/kit-checkout.ts:33-38`) takes the env URL when set and
otherwise falls back to `ghlOffer()`, which sends the visitor to
`https://allinonemanagementsolutions.com` with a campaign UTM. `isLiveHttpUrl()`
guards against placeholder strings. **There is never a dead link.** 14 offers are
registered in `src/lib/ghl-offers.ts`. The code is correct and complete.

### 3.2 CONFIG READINESS — ⚠️ **UNVERIFIED PRODUCTION CONFIGURATION**

I inspected the authorized Vercel surface for team `AIXMOS PROJECTS`
(`aixmos537`, plan **hobby**). Project `tmmt-ops`
(`prj_Cw4lJPwwlYSyVWLvuo98nuk1r5gV`) is the one linked to `AIXMOS537/TMMT`.

**Environment variable *values* are not exposed by the tooling available to me and
were not retrieved.** Therefore:

> **`.env.example` containing placeholders is NOT evidence about production.**
> The prior audit's claim that "nothing can take money today" was **overstated**
> and is corrected here. Whether the production checkout URLs are set can only be
> confirmed in the Vercel dashboard by the owner.

What *is* verifiable:
- Three recurring vars are absent from `.env.example` entirely (§2) — a real
  documentation gap regardless of production state.
- The runbook's prefix defect (§2) would produce silent failure even if the owner
  diligently set every variable it names.

### 3.3 PAYMENT READINESS — ⚠️ **PARTIAL, and gated on GHL, not on this repo**

Production facts established:

| Fact | Evidence |
|---|---|
| Last **successful** production deployment | commit `23323acf`, **2026-09-06 01:49 UTC**, state `READY` |
| Most recent production deployment | commit `6a2b5aff`, 2026-09-07 19:57 UTC, state **`CANCELED`** |
| Prior 13 deployments | state **`BLOCKED`** (Hobby-plan commit-author verification) |
| Project `live` flag | `false` |
| Domains on `tmmt-ops` | only `tmmt-ops-aixmos537.vercel.app` + branch alias — **no custom domain attached** |
| `/kits`, `/dealers`, `/try`, `/build`, `/upgrade`, `/forms` | **public** in the deployed commit (`middleware.ts` `isFunnelPublicPath`) |
| Anonymous `/` | 301s to `allinonemanagementsolutions.com` with UTM |

**Money is taken in GoHighLevel, not in this application.** Stripe is present
(`stripe ^22.2.0`) but **receipt-only — no charge is ever initiated in this
codebase**, and no organization has a `stripe_subscription_id`. So the answer to
"can a real customer complete a transaction today?" depends on whether the 17 GHL
products exist and are published — **which is outside this repository and outside
what I can inspect.** Marked `UNVERIFIED PRODUCTION CONFIGURATION`.

### 3.4 FULFILMENT READINESS — ❌ **the real constraint**

Even assuming checkout works, the delivery chain is manual end-to-end and **has
never been run**:

| Step | State | Evidence |
|---|---|---|
| 1. Visitor reaches `/kits` | ✅ public | `middleware.ts:40` |
| 2. Clicks Buy → GHL | ⚠️ unverified | §3.2 |
| 3. Pays in GHL | ⚠️ unverified | GHL products outside repo |
| 4. Webhook maps tag → SKU | ⚠️ **returns a string; no queue, no worker** | `src/lib/ghl/dealer-provision-queue.ts` |
| 5. Login invite issued | ❌ **manual only** — `scripts/invite.mjs` is the sole creator | `signup_invites` = **0 rows, ever** |
| 6. Customer redeems invite → account | ✅ works | `(auth)/login/actions.ts:42-134` |
| 7. Instance provisioned | ❌ **manual 11-step runbook** | `provision-dealer-instance.mjs`; `handoffs/` never created |
| 8. Package / entitlements granted | ❌ **unwired** — 0 profiles carry a `package_id`; "entitlement" appears nowhere in `src/` | DB + grep |

**There is no self-serve path.** Account creation is invite-gated by design, and
nothing issues an invite on purchase. At low volume with services pricing this is
acceptable; for a $97/mo self-serve seat it is not.

---

## 4. RECOMMENDED AUTHORITY — summary

| Domain | Recommended authority | Why |
|---|---|---|
| Dealer kits (Ladder B) | `src/app/kits/page.tsx` | Shipped, public, internally consistent, corroborated by 10 docs |
| High-ticket builds (Ladder C) | `src/lib/high-ticket.ts` | Shipped, public, deposits encoded |
| Operator seat | **$97** — `/kits` + `OFFER-STACK.md:72` + DB + `scripts/onboard` | 8 sources vs 2; the $297 variant is undeliverable |
| Credit products | **DB** `credit_product_catalog` | Executable, carries `ghl_tag`, already models one-time vs recurring vs add-on |
| Engagement terms | `OFFER-STACK.md:88-95` | Only source of the 50%-deposit rule |
| Rev-share / royalty | **NONE EXISTS** | Owner decision |
| GHL product list | `GHL-COPY-PASTE-PACK.md` §A **after the prefix fix** | Only end-to-end activation checklist |

**None of the above has been applied.** These are recommendations for
`OWNER_DECISIONS.md`.

---

*Sources: full repo read, git history, live production DB, and authorized Vercel
project inspection. Detailed line-level forensics in the session scratchpad:
`P2-01-pricing-forensics.md`, `P2-03-risk-verification.md`.*
