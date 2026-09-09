# COMMERCIAL SYNC PLAN

**Every surface that will need to change once the owner sets commercial authority.**

Audit date: 2026-09-07 · Repo @ `97a78d69` · DB `uapxakmlwnpfsftfeezx`

---

> ## ⛔ THIS DOCUMENT IS NOT AUTHORITY AND IS NOT EXECUTABLE
>
> **No owner answers exist yet.** Every `Approved Value` below reads `PENDING`
> against the decision that will supply it. Nothing here may be applied.
>
> This is an **inventory of what is true today**, built so that execution is a
> filling-in exercise rather than another discovery pass once the ten decisions in
> `OWNER_ACTION_SHEET.md` are answered.
>
> **`COMMERCIAL_AUTHORITY.md` has deliberately not been created.** Creating a file
> with that name containing only placeholders is precisely the failure mode D-18
> exists to prevent — a later agent reads a document as policy because of what it
> is called. It will be written when, and only when, there are answers to put in it.

**Nothing in this plan has been modified. No price, copy, variable, contract,
database row or production setting was touched.**

---

## 1. THE CONFLICT INVENTORY

**Change type:** `COPY` (words only) · `CONFIG` (env/GHL) · `DATA` (DB row) ·
`DOC` (internal document) · `CODE` (source change) · `CONTRACT` (legal instrument)

### 1.1 Operator seat — the live public contradiction

| Surface | Current Value | Approved Value | Change Type | Risk | Code? | Prod? |
|---|---|---|---|---|---|---|
| `src/lib/forms/catalog.ts:65-70` → public `/forms` | "Operator seat · $297" / "$297 / month" / "2,000 tokens" | PENDING · **D-2** | COPY | **HIGH** — public, and the 2,000-token tier cannot be provisioned | No | Deploy |
| `src/app/forms/operator-apply/page.tsx:12,14` | duplicated "$297" strings (not shared with the catalog) | PENDING · **D-2** | COPY | HIGH — second copy must move with the first | No | Deploy |
| `src/app/forms/actions.ts:686` | writes `priceCents: 29700` to `incoming_leads` | PENDING · **D-2** | CODE | MED — corrupts lead-value reporting | **Yes** | Deploy |
| `src/app/kits/page.tsx:37,63,103,199` | "$97/mo · 500 tokens" | PENDING · **D-2** | COPY | LOW — likely the survivor | No | Deploy |
| `src/lib/token-ledger.ts` `TOKEN_GRANT_TAGS` | only `member-97` exists; no operator/$297 tag | PENDING · **D-2** | **CODE** | **Blocks any $297 tier** — raising the env cap would change the $97 product, not create a tier | **Yes** | No |
| DB `operator_profiles.license_fee_cents` | max observed 9700 ($97) | PENDING · **D-2** | DATA | LOW | No | **Yes** |
| `AIXMOS/public/forms/index.html:29` | "Operator $297" | PENDING · **D-2** | COPY | **UNKNOWN — deployment status undetermined** | No | ? |

### 1.2 Price authority — the three ladders

| Surface | Current Value | Approved Value | Change Type | Risk | Code? | Prod? |
|---|---|---|---|---|---|---|
| `src/app/kits/page.tsx`, `src/app/dealers/page.tsx` | $997+$297 · $2,997+$497 · $3,497+$697 | PENDING · **D-1** | COPY | LOW if it wins | No | Deploy |
| `src/lib/high-ticket.ts:48-145` | $3,750 → $50,000 with deposits | PENDING · **D-1** | COPY/CODE | MED | Maybe | Deploy |
| `docs/OFFER-STACK.md` | BUILD $1,875→$100K + RUN $97/$1,875/$3,750/$7,500 | PENDING · **D-1** | DOC | LOW | No | No |
| `docs/deal-kit/PAYMENT-SCHEDULE.md:5` | points contracts at OFFER-STACK | PENDING · **D-1** | CONTRACT | **HIGH** — contracts cite a list that prices none of the live SKUs | No | No |
| `docs/SALES-CHANNELS.md:74` | "Add Command Kit for $2,000" → $2,997 total | PENDING · **D-1** | DOC | MED — **undercuts the $3,497 bundle by $500** | No | No |

### 1.3 The vehicle offer — **HOLD**

| Surface | Current Value | Approved Value | Change Type | Risk | Code? | Prod? |
|---|---|---|---|---|---|---|
| DB `packages.resale_box_plus_car` | $25,000, named **"Resale: Box + Vehicle"** | PENDING · **D-20** | DATA | **HIGHEST — physical asset, real acquisition cost** | No | **Yes** |
| `docs/OFFER-STACK.md:34` | car included at **$35,000** | PENDING · **D-20** | DOC | HIGH — $10,000 apart from the DB | No | No |
| DB `packages.resale_full_stack_max` | $35,000–$50,000 in one row | PENDING · **D-20** | DATA | HIGH — car owed at the bottom of the range, not the top | No | **Yes** |
| `docs/OFFER-STACK.md:34` "no backend funding fee" alternative | **defined and priced nowhere** | PENDING · **D-20** | DOC | MED — the alternative's value cannot be stated | No | No |
| Entitlements for `resale_box_plus_car` | **identical to `resale_business_in_a_box`** — the $10k delta records nothing | PENDING · **D-20** | DATA | HIGH | No | **Yes** |

### 1.4 `/try` — subscription copy, one-time destination

| Surface | Current Value | Approved Value | Change Type | Risk | Code? | Prod? |
|---|---|---|---|---|---|---|
| `src/app/try/page.tsx:184,190` | "Starts at $97/mo" / "Get started — $97/mo" | PENDING · **D-12** | COPY | **HIGH — live mis-sale** | No | Deploy |
| `src/app/try/page.tsx:187` | links to `/lp/moe-legacy/intro-97` (a **one-time** $97 audit) | PENDING · **D-12** | COPY | HIGH — wrong of two co-existing offers | No | Deploy |
| same URL slug | contains the fenced party's name, customer-visible | PENDING · **D-12/D-13** | COPY/CONFIG | MED | No | Deploy |
| `src/app/try/page.tsx:184` | "No $5k guru tax" | PENDING · **D-12** | COPY | MED — a price anchor of the exact shape `copy-compliance.test.ts:52` warns against, on a page outside the guarded copy | No | Deploy |

### 1.5 Revenue share, royalty, affiliate

| Surface | Current Value | Approved Value | Change Type | Risk | Code? | Prod? |
|---|---|---|---|---|---|---|
| `src/lib/verticals/registry.ts:115-144` + `config/verticals.json` | learn 0 / earn 70 / **graduate 85** | PENDING · **D-4** | **CODE** | **HIGHEST — the only scheme that writes to production, never approved** | **Yes** | **Yes** |
| `src/lib/client-journey/types.ts:36-41` | 25/30/35 by level — **dead code, zero importers**, inverts the above | PENDING · **D-4** | CODE | LOW — delete | Yes | No |
| `scripts/onboard:29` | default `30` for the same DB column | PENDING · **D-4** | CODE | MED — third value | Yes | No |
| `src/app/forms/affiliates/page.tsx:50` → public | "**30% recurring**, ~$29/mo, tiering to 40%" | PENDING · **D-4** | COPY | **HIGH — public, contradicts the agreement** | No | Deploy |
| `docs/affiliates/AFFILIATE_AGREEMENT_DRAFT.md:35` | "**flat $35** per $97 sale" ($35 ≠ 30% of $97) | PENDING · **D-4** | CONTRACT | HIGH | No | No |
| `AIXMOS/public/operator.html:491,498` | "**50/50 partnership**" / "10% referral" with a **live application form** | PENDING · **D-4** | COPY | **HIGH — terms nothing backs; deployment status undetermined** | No | ? |
| DB `organizations.agency_revenue_share_pct` | 80 on all 9 orgs; **no migration defines the column** | PENDING · **D-4** | DATA | MED | No | **Yes** |

### 1.6 Contracts — nothing is signable

| Surface | Current Value | Approved Value | Change Type | Risk | Code? | Prod? |
|---|---|---|---|---|---|---|
| `docs/deal-kit/PAYMENT-SCHEDULE.md:24` | `{{REV_SHARE_PCT}}` → `scripts/new-operator:39` substitutes literal **`[TBD]`** | PENDING · **D-4** | CONTRACT | **BLOCKING** | No | No |
| `docs/deal-kit/digitization/COMPENSATION-SCHEDULE.md:18` | `{{ROYALTY}}` — **never filled by anything** | PENDING · **D-4** | CONTRACT | **BLOCKING** | No | No |
| Deal kit policy placeholders | `{{REV_BASE}}` `{{GRACE_DAYS}}` `{{CURE_DAYS}}` `{{PRICE_NOTICE_DAYS}}` `{{REVOCATION_DAYS}}` `{{NOTICE_DAYS}}` `{{LIABILITY_MONTHS}}` `{{EXPORT_DAYS}}` `{{DISCOVERY_DAYS}}` `{{RETENTION_PERIOD}}` `{{EXCLUSIVE_OR_NONEXCLUSIVE}}` `{{DISPUTE_VENUE_OR_ARBITRATION}}` `{{TERRITORY}}` | PENDING · **D-5** | CONTRACT | **BLOCKING** | No | No |
| `{{LATE_FEE}}` | **already filled** — 1.5%/mo | ✅ settled | — | — | No | No |
| `{{FOUNDER_SETTLEMENT}}` / `{{FOUNDER_TERMS}}` | deferral threshold naming the fenced party | PENDING · **D-13** | CONTRACT | HIGH | No | No |

### 1.7 GHL and Vercel configuration

| Surface | Current Value | Approved Value | Change Type | Risk | Code? | Prod? |
|---|---|---|---|---|---|---|
| `docs/runbooks/GHL-COPY-PASTE-PACK.md` §A rows 7-11,13,14 | instructs **8 checkout vars WITHOUT `NEXT_PUBLIC_`** | PENDING · **D-6** | DOC | **HIGH — silent failure; every kit checkout falls back with no error** | No | No |
| `.env.example` | omits `..._OPS_MONTHLY`, `..._COMMAND_MONTHLY`, `..._DEALER_MONTHLY` | PENDING · **D-6** | DOC | **HIGH — the whole recurring line has no documented setup path** | No | No |
| Vercel `tmmt-ops` env values | **UNVERIFIED — not inspectable by this session** | PENDING · **D-6** | CONFIG | **UNKNOWN** | No | **Yes — owner only** |
| GHL products (17 proposed) | **existence unverified** | PENDING · **D-6** | CONFIG | UNKNOWN | No | **Yes — owner only** |
| `AIXMOS/public/*` deployment | **undetermined from the repo** | PENDING · **D-12** | CONFIG | MED — may be publishing unbacked terms | No | **Yes — owner only** |

### 1.8 Governance and documents

| Surface | Current Value | Approved Value | Change Type | Risk | Code? | Prod? |
|---|---|---|---|---|---|---|
| `docs/CONTROL-PLANE-OPERATING-SCRIPT.md` §3 | standing grant to apply production changes without asking | PENDING · **D-18** *(amendment text drafted, not applied)* | DOC | **HIGH — a later agent may read it as policy** | No | No |
| `docs/OFFER-STACK.md:15-16` | names the fenced party as a founding operator with deferred terms | PENDING · **D-13** | DOC | HIGH | No | No |
| DB `organization_licenses` `seed-moe-legacy` | `active: false`, **unused install-token hash present** | PENDING · **D-13** | DATA | MED | No | **Yes** |
| `docs/OFFER-STACK.md:33` | sells "**credit-repair**" — violates its own rule at `:145` | PENDING · **D-1** | DOC | **HIGH — compliance wording** | No | No |
| `GO.command:74-75` | reports green on **file existence** | PENDING · **D-14** | CODE | MED — masks the missing gate | **Yes** | No |
| `.gitignore:111` | bare `dist/` while `dist/` is tracked | PENDING · **D-7** | CODE | LOW | Yes | No |

---

## 2. EXECUTION ORDER, ONCE AUTHORITY EXISTS

Sequenced so nothing is done twice.

1. **D-1 lands** → §1.2 resolves, and it determines §1.7's SKU list.
2. **D-2 lands** → §1.1 in one pass: two copy strings, one lead-value write, and
   an explicit decision to *not* touch `TOKEN_GRANT_TAGS` unless a real tier is
   commissioned.
3. **D-4 + D-5 land** → §1.5 and §1.6 together. **Nothing can be papered before
   this**, so it gates every contract regardless of the price decision.
4. **D-20 lands** → §1.3. Until then **no quote may name a vehicle**.
5. **D-6 lands** → §1.7. Fix the runbook prefix defect *before* the owner follows
   it, not after.
6. **D-12, D-13, D-18, D-7** → §1.4 and §1.8. Independent of the rest; can run in
   parallel.

**Everything above is copy, config, documents and data. The only genuine code
changes are:** the lead-value write (`actions.ts:686`), the rev-share scheme
cleanup (§1.5), `GO.command`, `.gitignore`, and — **only if a $297 tier is
actually commissioned** — a new token grant tag.

---

## 3. WHAT MUST NOT HAPPEN DURING INTAKE

No production writes · no price changes · no public copy edits · no environment
changes · no GHL product creation · no contract edits · no lead transfer · no SMS ·
no commission logic · no token changes · no migrations · no deployment.

**Silence is not approval.** An unanswered decision stays unanswered.
