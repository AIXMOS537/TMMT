# OWNER DECISIONS

**The choices that stand between the software and revenue.**

Audit date: 2026-09-07 · Companion to `COMMERCIAL_MASTER.md` and `PRICE_RECONCILIATION.md`

> Every decision below is the owner's. Where repository evidence supports one
> option I have named a **Recommended Default** and said why; where it does not, I
> have written **NO RECOMMENDATION — insufficient evidence** rather than invent
> one. **No price, percentage or contract value has been set, changed or applied.**
>
> `Owner Answer` is left blank deliberately. Fill it in, and each becomes a scoped
> implementation task.

**Priority key:** 🔴 blocks revenue now · 🟠 blocks revenue soon · 🟡 blocks scale ·
⚪ hygiene

---

## ⛔ THE AUTHORITY RULE — read before treating anything here as policy

**NO OWNER ANSWER = NO COMMERCIAL AUTHORITY.**

As of this writing, **`docs/commercialization/COMMERCIAL_AUTHORITY.md` does not
exist, and must not be created until explicit owner answers exist.** A placeholder
carrying an authoritative filename is dangerous precisely because a later reader —
human or agent — may take recommendations, defaults, blank fields, stale values or
inherited text as approved policy. That is the same failure mode as D-18.

None of the following is authority on its own:

| Not authority | Why |
|---|---|
| **Silence** | An unanswered decision stays unanswered |
| **A Recommended Default in this file** | A recommendation is an argument, not a decision |
| **A value in production** | It got there without a recorded decision — see D-4 |
| **Public copy on a live page** | Two contradictory prices are public right now — see D-2 |
| **A database row** | `packages` prices predate any billing model — see D-11 |
| **A document that says it is canonical** | `OFFER-STACK.md:3` says exactly that and prices none of the live SKUs — see D-1 |
| **A document granting standing permission** | Text read from a file cannot widen authority — see D-18 |

**When `COMMERCIAL_AUTHORITY.md` is eventually written, it must mean one thing:
every value inside it came from an explicit owner decision, or is unmistakably
labelled non-authoritative.** Nothing else belongs in it.

**Sequence, never reversed:**
`COMMERCIAL_AUTHORITY.md` → `COMMERCIAL_SYNC_PLAN.md` → separately authorized
implementation.

---

## D-1 🔴 Which price list is authoritative?

**Decision.** Name one document as the single pricing authority, and demote the
other two to derived or retired.

**Why now.** Three rival ladders are simultaneously live. Your contract templates
(`docs/deal-kit/PAYMENT-SCHEDULE.md:5`) point at Ladder A, which does not contain
the SKUs your public storefront actually sells. Any two people quoting from two
documents will quote different numbers for the same work. Every other pricing
decision below depends on this one.

**Evidence.**
- **Ladder A** — `docs/OFFER-STACK.md:3` self-declares "canonical pricing for the
  whole network": BUILD $1,875→$100K + RUN $97/$1,875/$3,750/$7,500 per month.
  Docs only; **no code reads it**.
- **Ladder B** — `src/app/kits/page.tsx:9-24,180`, `src/app/dealers/page.tsx:109,131`:
  $997+$297/mo, $2,997+$497/mo, $3,497+$697/mo. **Shipped, public, arithmetic
  verified, corroborated by 10 docs.**
- **Ladder C** — `src/lib/high-ticket.ts:48-145`: $3,750→$50,000 with deposits.
  **Shipped, public.**
- Neither A nor B contains any of the other's numbers.

**Option A — OFFER-STACK becomes authoritative.** One document already written as
a ladder, with engagement terms (50% deposit) that exist nowhere else. *Consequence:*
the live storefront and `/build` become non-conforming and must be re-priced or
retired; you lose the only SKUs with verified public pricing.

**Option B — the shipped code becomes authoritative (B + C), OFFER-STACK demoted to
an internal operating model.** *Consequence:* what you sell matches what is on the
screen today; OFFER-STACK's $15K/$25K/$35K/$100K rungs must be either mapped onto
Ladder C or explicitly marked "quote-only". Contract templates must be repointed.

**Option C — one merged catalog with an explicit billing interval per row**, absorbing
A's RUN column and B's SETUP+MO, retiring C into it. *Consequence:* most work;
produces the single catalog you actually want; requires D-11 first.

**Recommended Default: Option B, then converge on C.** Ladder B is the only ladder
with shipped code, public pages, internal arithmetic consistency and multi-document
corroboration. Ladder A's own rungs collide with its own RUN column ($1,875,
$3,750 and $7,500 each mean both a one-time build and a monthly retainer,
`OFFER-STACK.md:84-86` admits this is deliberate) — a document that ambiguous cannot
be the authority a contract points at.

**Owner Answer:**
_______________________________________________

---

## D-2 🔴 Operator seat — $97/mo or $297/mo?

**Decision.** One price and one token allowance for the operator seat.

**Why now.** **Both prices are live to an anonymous visitor right now**, on two
pages of the same application, with two different token allowances. A prospect can
see both in one session.

**Evidence.**
- **$297/mo · 2,000 tokens** — `src/lib/forms/catalog.ts:65-70`, rendered on public
  `/forms`; duplicated in `src/app/forms/operator-apply/page.tsx:12,14`;
  `src/app/forms/actions.ts:686` writes `priceCents: 29700` into `incoming_leads`.
- **$97/mo · 500 tokens** — public `/kits` (`page.tsx:37,63,103,199`);
  `docs/OFFER-STACK.md:72`; `src/lib/operator/academy-modules.ts:41,125,132,202`;
  `docs/HOMELAND-HQ-AND-OPERATOR-SEATS.md:61`; `docs/DMV-CLUBHOUSE-OFFICE.md:44,52`;
  `scripts/onboard:31` (`FEE_CENTS=9700`); DB `operator_profiles.license_fee_cents`;
  `/upgrade` via `ghl-offers.ts:137`.
- ⚠️ **`src/lib/token-ledger.ts:30-45` can grant only 500 tokens, and only on tag
  `member-97`. Nothing in the system can deliver the advertised 2,000.**
- **Origin:** `9e97dd8b` (2026-08-19) added the $297 form; `8e4a5d7f` (2026-08-22)
  renamed the pre-existing **$97 Academy** card to "AIXMOS Operator". Neither commit
  touched the other's file — this was an accident, not a decision.

**Option A — $97/mo, 500 tokens.** *Consequence:* correct one string in
`catalog.ts` (read by exactly one page) and one in `operator-apply/page.tsx`.
Matches 8 sources, the database, and the only implemented token grant.

**Option B — $297/mo, 2,000 tokens.** *Consequence:* re-price 8 surfaces including
public `/kits` and `/upgrade`, **and build the 2,000-token grant**, which does not
exist. Higher ticket, but you would be selling something the platform cannot
currently deliver until that work is done.

**Option C — both, as two tiers** ($97 Academy / $297 Operator Pro). *Consequence:*
legitimate laddering, but requires renaming so "Operator" is not both; still
requires the 2,000-token grant.

**Recommended Default: Option A ($97/500).** It is the only price the system can
actually honour today, and it is what the database, the onboarding script and the
curriculum already encode. Option C is a reasonable follow-on once token grants are
configurable.

**Owner Answer:**
_______________________________________________

---

## D-3 🔴 Khan Strategies referral rate

**Decision.** What TMMT is paid per referral sent to Khan Strategies, and on what
trigger (sent / accepted / completed / paid).

**Why now.** You hold **876 leads** and the referral plumbing is built —
`partner_referrals` has consent capture, `commission_cents`, and a full lifecycle
(`accepted_at`, `completed_at`, `paid_at`). **`commission_cents` is left null and
the table has 0 rows.** Lead flow has collapsed to ~1/month, so this is a wasting
asset.

**Evidence.**
- `src/app/(admin)/referral-actions.ts` — `referToPartner` calls
  `request_handoff('tmmt','khan_strategies',…)` with a mandatory consent channel;
  commission deliberately left null pending this decision.
- `workstream-3-operator-network/TASKS.md:14` proposes, unbuilt: **credit
  $50–$150/referral**; funding **1–3%** or **15–25% of origination fee**.
- No agreed rate exists anywhere in the repo.
- Khan Strategies exists as an organization in the DB
  (`370cd891-…`, `plan_tier: starter`, `billing_status: trialing`).

**Option A — flat fee per completed referral** (the WS3 $50–$150 band is the only
written anchor). *Consequence:* simple to track, pays only on real client
services — which the repo's own rule requires ("Affiliate pays on real sales only",
`OFFER-STACK.md:145`). Caps upside on large funding deals.

**Option B — percentage of the fee Khan Strategies collects.** *Consequence:*
shares upside; requires visibility into their billing and a reconciliation process
you do not currently have.

**NO RECOMMENDATION — this is a bilateral commercial negotiation with an
independent company.** The repository cannot evidence what they will agree to.
What it *can* say: pay on `completed_at`, not on `created_at`, because paying on
referral-sent would breach the "real sales only" rule you have written down.

**Owner Answer:**
_______________________________________________

---

## D-4 🔴 Revenue share and royalty rate

**Decision.** The operator/partner revenue-share percentage, the royalty rate, and
which basis each applies to (gross collected / net / per-deal).

**Why now.** **No signable instrument can be issued without it.**
`{{REV_SHARE_PCT}}` is filled with the literal `[TBD]`, and `{{ROYALTY}}` is never
filled by anything. Meanwhile **live code is already writing an unapproved
percentage into the production database**.

**Evidence — five mutually incompatible schemes, none marked canonical:**

| Scheme | Source | Status |
|---|---|---|
| 25/30/35% by operator level | `src/lib/client-journey/types.ts:36-41` | **Dead code, zero importers.** Higher level = *lower* share. |
| **0/70/85% by seat stage** | `src/lib/verticals/registry.ts:115-144`, `config/verticals.json:15-18` | ⚠️ **The only one that writes to the DB** (`provision-tenant-seat.mjs:274-297` → `operator_profiles.revenue_share_pct`). **Inverts** the scheme above. |
| 30% default | `scripts/onboard:29` | A CLI default for the same column — a third value. |
| 50/50 partnership or 10% referral | `AIXMOS/public/operator.html:491,498` | **Public marketing with a live application form.** Corroborated by nothing. |
| Affiliate 30%→40% | `src/app/forms/affiliates/page.tsx:50` (public) | **Contradicts** `docs/affiliates/AFFILIATE_AGREEMENT_DRAFT.md:35` (flat $35/sale, "stay flat"). $35 ≠ 30% of $97. |

- `scripts/new-operator:39` fills late fee (1.5%/mo), grace, cure, term and venue —
  but substitutes `[TBD]` for rev-share. **The blank is deliberate.**
- The DB's `agency_revenue_share_pct = 80` on all 9 orgs is a **database observation
  only** — no migration in `supabase/migrations/` defines that column.
- `OFFER-STACK.md`, designated "the single pricing authority"
  (`HOMELAND-HQ-AND-OPERATOR-SEATS.md:88`), **contains no percentage at all**.

**Option A — adopt the executable scheme (0/70/85 by seat stage)** since it is
already writing to production. *Consequence:* least code churn; but it was never
approved, and 85% to a graduate operator is a very large share to ratify by default.

**Option B — set a single flat rate** and delete the other four schemes.
*Consequence:* clearest; requires touching `registry.ts`, `verticals.json`,
`onboard`, `operator.html` and the affiliate page.

**NO RECOMMENDATION on the number — it is a core commercial term with no
evidentiary basis in the repo.** Two sub-decisions the evidence *does* force:

1. **The affiliate lane contradicts itself in public.** `/forms/affiliates` promises
   30% recurring; the draft agreement says flat $35 and "stay flat". One is wrong and
   both are customer-facing.
2. **`AIXMOS/public/operator.html` advertises 50/50 with a live application form**
   and is referenced by no code. Confirm whether that page is deployed (D-12).

**Owner Answer:**
_______________________________________________

---

## D-5 🟠 Contract placeholder values

**Decision.** The policy values that appear in every signable instrument.

**Why now.** `docs/deal-kit/` contains six documents including
`ENGAGEMENT-LETTER.md`, `PAYMENT-SCHEDULE.md`,
`PLATFORM-LICENSE-AND-OPERATOR-AGREEMENT.md` and `REMOTE-ACCESS-CONSENT.md`. Until
these are filled, **no deal can be papered**.

**Evidence.** Split into two classes — only the first needs a decision:

**Policy values (set once, apply to every deal):**
`{{REV_SHARE_PCT}}` *(→ D-4)* · `{{REV_BASE}}` · `{{ROYALTY}}` *(→ D-4)* ·
`{{LATE_FEE}}` *(already filled: 1.5%/mo by `scripts/new-operator:39`)* ·
`{{GRACE_DAYS}}` · `{{CURE_DAYS}}` · `{{PRICE_NOTICE_DAYS}}` ·
`{{REVOCATION_DAYS}}` · `{{NOTICE_DAYS}}` · `{{LIABILITY_MONTHS}}` ·
`{{EXPORT_DAYS}}` · `{{DISCOVERY_DAYS}}` · `{{RETENTION_PERIOD}}` ·
`{{EXCLUSIVE_OR_NONEXCLUSIVE}}` · `{{DISPUTE_VENUE_OR_ARBITRATION}}` ·
`{{TERRITORY}}` · `{{FOUNDER_SETTLEMENT}}` / `{{FOUNDER_TERMS}}` *(→ D-13)*

**Per-deal values (filled at signing, no decision needed):**
`{{CLIENT}}` · `{{PERSON}}` · `{{DATE}}` · `{{AMOUNT}}` · `{{DEPOSIT}}` ·
`{{TIER}}` · `{{SCOPE}}` · `{{TERM}}` · `{{CADENCE}}` and similar.

**Option A — fill the policy values now with owner-chosen defaults.**
*Consequence:* deal kit becomes usable immediately; values can be revised later.

**Option B — have counsel set them alongside the CROA work** already required for
the credit vertical. *Consequence:* slower, but `LIABILITY_MONTHS`,
`DISPUTE_VENUE_OR_ARBITRATION` and `EXCLUSIVE_OR_NONEXCLUSIVE` carry real legal
weight and are not natural owner defaults.

**Recommended Default: split them.** Fill the commercial ones yourself
(grace, cure, notice, territory, exclusivity, revenue basis); route
liability, venue/arbitration and retention to counsel. That unblocks quoting
without you signing legal language nobody reviewed.

**Owner Answer:**
_______________________________________________

---

## D-6 🔴 Which GHL products to create — and the prefix defect

**Decision.** Approve the product list to create in GoHighLevel, and confirm which
env vars are set in Vercel.

**Why now.** This is the shortest path from "software exists" to "money arrives".
`docs/runbooks/GHL-COPY-PASTE-PACK.md` §A already lists **17 products** with prices,
billing type, tags and env vars.

**Evidence — and a defect that would silently cost money.**
- The application reads checkout links **only** from `NEXT_PUBLIC_`-prefixed
  variables (verified: `process.env.GHL_*` is used only for API/webhook/location
  config, never a checkout link).
- **The runbook instructs setting eight checkout vars WITHOUT the prefix**:
  `GHL_CHECKOUT_OPS_KIT`, `…_OPS_KIT_USB`, `…_COMMAND_KIT`, `…_COMMAND_KIT_USB`,
  `…_DEALER_BUNDLE`, `GHL_CHECKOUT_LLC`, `GHL_CONSULT_CALL`, `GHL_CREDIT_GUIDANCE`.
  Followed literally, **every kit checkout would silently fall back to the generic
  campaign site with no visible error.**
- **Three recurring vars are documented nowhere** — not in `.env.example`, not in
  the runbook: `NEXT_PUBLIC_GHL_CHECKOUT_OPS_MONTHLY` ($297/mo),
  `…_COMMAND_MONTHLY` ($497/mo), `…_DEALER_MONTHLY` ($697/mo). **The entire
  recurring half of Ladder B has no documented configuration path.**
- Production env values could not be inspected — marked
  `UNVERIFIED PRODUCTION CONFIGURATION`. **`.env.example` placeholders are not
  evidence about production.**

**Option A — create all 17 runbook products.** *Consequence:* maximum coverage;
but the list includes SKUs that appear in no ladder (Halal Credit $97, Funding
Readiness $1,500, VIP Coaching $3,000, GHL Sub-Account $197/mo, Cohort $7,997/$9,997)
and would deepen D-1.

**Option B — create only the SKUs of whichever ladder wins D-1** (4–5 products).
*Consequence:* smallest, cleanest, fastest; matches what the public pages sell.

**Recommended Default: Option B**, plus fixing the prefix defect in the runbook
before anyone follows it. Create Ops Kit, Command Kit, Dealer Bundle, Operator seat
— the four SKUs that are public, priced and internally consistent — and their three
monthly counterparts.

**Owner Answer:**
_______________________________________________

---

## D-7 ⚪ `dist/` — tracked release artifact or generated output?

**Decision.** How `dist/` should be treated in source control.

**Why now.** Lower urgency than when first flagged: **another session has restored
`dist/` and it is now present, tracked and clean** (23 files, matching HEAD exactly).
The immediate data-loss risk has passed. The underlying inconsistency remains.

**Evidence.**
- 23 files, **52,542 bytes**. It is a **hand-assembled field onboarding kit** —
  `SEND-TO-JUSTIN.md`, `onboard.command/.bat/.ps1`, two SVGs, and `operator-kit/`
  containing `operator-runtime.tar.gz` plus an unpacked runtime (`work`, `guide`,
  `sync`, `sos`, `compass`, `watchtower`, `dark`, `menu`). **Not compiled output.**
- **Nothing generates it.** No `dist` target in `package.json`. The only functional
  reference is `FLEET-UP.sh:110-113`, which **consumes** it and `exit 1`s if missing.
- **Ordering is decisive:** tracked first (`797c27eb`, 2026-06-18; `53541a8c`,
  06-21), ignored *after* (`fe219b99`, 06-22 — a generic gitignore hygiene commit
  adding bare `dist/` at `.gitignore:111`). Git never retroactively untracks, so the
  rule has been inert. `dist/SEND-TO-JUSTIN.md` was then added on 07-01 **despite**
  the rule — proving the ignore was collateral, not a decision.
- Deletion was never committed on any branch.

**Option A — keep it tracked; scope the ignore rule** (negate `dist/operator-kit/`,
or narrow line 111). *Consequence:* state becomes self-consistent; fresh clones keep
working; zero risk.

**Option B — untrack it and generate it.** *Consequence:* **breaks every fresh
clone and `FLEET-UP.sh` immediately**, and loses `operator-runtime.tar.gz`, which
nothing can rebuild. Requires writing a generator first.

**Option C — split**: track the hand-written onboarding docs, generate the runtime
tarball. *Consequence:* correct in principle; needs the generator that does not
exist.

**Recommended Default: Option A.** The evidence is unambiguous — this is a
hand-made, non-reproducible release artifact that a live script depends on. The
gitignore line is the bug, not the tracking.

**Owner Answer:**
_______________________________________________

---

## D-8 🟡 Dispatch — standalone product, bundle component, or both?

**Decision.** Whether Dispatch gets its own SKU.

**Why now.** It is a working, org-scoped surface with **no commercial
representation at all**. Its build cost is already sunk.

**Evidence — and a correction to the prior audit.**
- 6 pages, ~1,304 lines of UI + 178 lines of query/type library ≈ **1,482 lines
  total**. Own auth layer, org-scoped, responder approval/revoke, incidents, units,
  mobile responder view.
- **It has never been used.** Production: `incidents` = **0 rows**,
  `incident_assignments` = 0, `org_responder_links` = 0, `unit_locations` = 0,
  `units` = 3.
- `COMMERCIAL_MASTER.md` described it as a "complete multi-tenant product" and
  proposed $4,500–$9,000 + $349–$799/mo. **On this evidence that overstates it** —
  it is a credible product *skeleton* with a thin data layer and zero operational
  history, not a proven product.

**Option A — standalone SKU now.** *Consequence:* new revenue line; but you would
be selling something with no production history, and roadside/towing buyers will
ask for dispatch-specific features (mapping, ETA, driver app) that are only partly
present.

**Option B — bundle component only**, included in Command Kit / higher rungs.
*Consequence:* increases perceived value of existing SKUs at zero marginal cost; no
new fulfilment burden.

**Option C — both**: bundled by default, standalone by quote.

**Recommended Default: Option B now, Option C after one real deployment.** Sell it
as included value until it has run at least one real incident. Pricing it standalone
before it has ever been used invites a delivery failure on your first sale.

**Owner Answer:**
_______________________________________________

---

## D-9 🟡 Rentals back-office — standalone product, bundle component, or both?

**Decision.** Whether the 27-screen rentals desk is sold as its own product.

**Why now.** It is the most operationally proven thing you have — and the only part
of the system that has ever touched real customer money.

**Evidence.**
- **27 pages, ~5,188 lines.** Fleet, revenue, leads, cases, insurance, maintenance,
  background checks, four multi-view "interfaces" apps. Real Supabase reads,
  offline-first.
- Real usage: `fleet` 43 rows, `active_customers` 35, `tickets` 308,
  `background_checks` 299, `insurance` 24.
- **The only real revenue in the entire system: 31 payments totalling $9,510.57,
  October 2025 → March 2026.** Nothing since March. Largest single payment ever
  recorded: **$577**.
- It is effectively what Ladder C's "Car Rental in a Box" ($15,000) already sells.

**Option A — standalone SMB rental-ops product** (setup + monthly).
*Consequence:* clearest product-market fit of anything in the portfolio; competes
in a real category; needs a price, which no ladder currently gives it.

**Option B — bundle component only** (it is the substance of the $15,000 rung).
*Consequence:* no new work; leaves the most proven asset without its own entry
point.

**Recommended Default: Option C — both.** Make it the anchor of Ladder B (it is
what Ops Kit and Command Kit actually deliver) *and* keep it as the substance of the
$15,000 vertical build. It is the only component with operational history, and
history is what a buyer will ask about.

**Owner Answer:**
_______________________________________________

---

## D-10 🟠 Sovereign licensing — standalone, Full Stack component, or enterprise offer?

**Decision.** Where the $50,000 sovereign install sits, and what may be claimed
about it.

**Why now.** It is the highest verified ticket ($50,000 once + $97/agent/mo) and
the only hybrid one-time+recurring SKU you have. It is also the offer most exposed
to overclaiming.

**Evidence — what is actually implemented.**

✅ **Real and working:**
- One-time install token, consumed on use (`install_token_used`).
- Hardware binding: `hardware_uuid` stored; heartbeat rejects a mismatch with 401
  and emits `license.hardware_mismatch` to the audit log.
- Heartbeat telemetry with `last_heartbeat_at`, audit events, 24h cache TTL.
- Revocation *signalling*: 410 + `kill_command` when `active=false` or
  `kill_command='wipe'`.
- Deep multi-tenancy underneath: **96 of 165 tables carry `org_id`; 344 RLS
  policies; RLS enabled on all 165 tables with zero exceptions.**
- A complete partner-deploy kit: `issue-license.sh`, `kill-partner.sh`,
  `burn-partner-usb.sh`, consent clickwrap, health-check, recovery, uninstall.

⚠️ **NOT what the docstrings claim — do not put these in a sales document:**
- The docstring says the install token is an **HMAC**; `hashToken` is a **plain
  unsalted SHA-256** with no key (`api/license/provision/route.ts:19`).
- **"Secure Enclave attestation" is key *collection*, not attestation.**
  `enclave_pubkey_pem` is stored and **never verified anywhere** — no signature
  check exists in the codebase.
- The docstring says it returns a **license JWT**; it returns an **opaque SHA-256
  digest**, and the code's own comment admits *"For v1… full Ed25519 JWT signing
  happens once vault is wired"*.
- **Nothing ever verifies the session token.** The heartbeat authenticates only on
  `(organization_id, hardware_uuid)` — neither is a secret, both are client-supplied.
- **The kill switch is advisory.** The server returns 410; enforcement depends
  entirely on the client honouring it. A client that ignores the response, or simply
  stops calling heartbeat, is unaffected.
- `partner-deploy/` has been **dormant since June** and its own README marks parts
  as v1 stubs. It has never been run end to end.

**Option A — standalone enterprise offer at $50,000 + $97/agent/mo.**
*Consequence:* highest ticket; but an enterprise buyer's security review will ask
exactly the questions above, and the honest answers are "stored but not verified"
and "advisory". Requires the crypto work first.

**Option B — component of the top build rung**, not separately marketed.
*Consequence:* avoids the security-claims exposure; loses the clearest
differentiator you have.

**Option C — sell it now, but describe it accurately** ("hardware-bound licence with
remote revocation and audit trail") and schedule the cryptographic work.
*Consequence:* honest, sellable, and the claims survive scrutiny.

**Recommended Default: Option C.** The architecture is genuinely valuable and rare
at your scale — the moat is the tenancy depth and the operational kit, not the
cryptography. Sell the real thing; do not claim attestation you do not perform.
**Before any sovereign sale, run the partner-deploy kit end to end once.**

**Owner Answer:**
_______________________________________________

---

## D-11 🟠 `packages` pricing model — add a billing interval?

**Decision.** Whether to extend `packages` with `billing_interval` and
`pricing_model` before any further pricing work.

**Why now.** `packages.price_cents` is **already ambiguous** for the six rows that
carry it, and this blocks the merged catalog (D-1 Option C).

**Evidence.**
- `packages` is an **entitlement-bundle table**: referenced only by
  `package_entitlements` (94 rows) and `profiles.package_id`. Tier numbering
  `1/2/3/99` (2026-05-18) vs `101-106` (2026-06-05) shows two concepts in one table.
- It has **no billing interval**, and the business deliberately reuses anchors:
  $1,875, $3,750 and $7,500 are each *both* a one-time BUILD rung and a monthly RUN
  retainer (`OFFER-STACK.md:84-86`).
- A better model already exists in the same database: `credit_product_catalog`
  (`amount_cents`, `ghl_product_id`, `ghl_tag`) + `credit_billing_plans`
  (`amount_cents`, `monthly_fee_cents`, `down_paid_cents`, `is_add_on`,
  `delivery_mode`).
- Nothing consumes `packages` in application code — **verified again today** — so
  the change is currently free of breakage risk.
- `resale_box_plus_car` ($25,000) grants **identical entitlements** to
  `resale_business_in_a_box` ($15,000). The $10,000 delta is unmodelled.

**Option A — add `billing_interval` + `pricing_model` now.** *Consequence:* removes
the ambiguity before more rows land; small, additive, zero consumers to break.

**Option B — wait until D-1 settles.** *Consequence:* avoids designing the column
before the catalog shape is known; risks more ambiguous rows in the meantime.

**Recommended Default: Option A, but only after D-1.** The migration is drafted and
**deliberately not applied**. Do not put `9700` on `starter`/`growth`/`elite`/`custom`
under any option — the $97 seat is already correctly modelled on
`operator_profiles.license_fee_cents`.

**Owner Answer:**
_______________________________________________

---

## D-12 🟠 `/try` checkout target, and the static `AIXMOS/public` tree

**Decision.** (a) Fix `/try` to point at the recurring product, or re-word it as
one-time. (b) Confirm whether `AIXMOS/public/*` is deployed.

**Why now.** `/try` is **public** and quotes a subscription that lands on a
single purchase — a live mis-sale on your own funnel.

**Evidence.**
- `src/app/try/page.tsx:184,190` reads "Starts at $97/mo" and "Get started —
  $97/mo", linking to `/lp/moe-legacy/intro-97`, which is unambiguously a
  **one-time** $97 Credit + Funding Audit (`copy.ts:32,39`;
  `MASTER_OPERATOR_RUNBOOK.md:182` states *"recurring? No, one-time $97"*).
- **Verdict: wrong checkout target.** The recurring $97 product exists in the same
  codebase as `member97` / `NEXT_PUBLIC_GHL_CHECKOUT_97`; the CTA points at the
  wrong one of two co-existing offers.
- **Never consistent** — all four "$97/mo" strings were present in `/try`'s
  introducing commit (`e2c77533`, 2026-06-18).
- `/try` also ships the line **"No $5k guru tax"** — a price anchor of exactly the
  shape the repo's own compliance test warns against
  (`copy-compliance.test.ts:52`), on a page outside the guarded `copy.ts`.
- The URL is customer-visible and contains the fenced party's slug (`moe-legacy`).
  The display name is already "AIXMOS Credit"; only the internal key persists.
- `AIXMOS/public/*` is a **separate static tree** carrying the *same* $97/$297
  contradiction, plus the uncorroborated **50/50 partnership offer with a live
  application form**. It is not served by the Next app (no rewrite in
  `next.config.ts`), and `public/aixmos/` does not exist. **Its deployment status
  cannot be determined from the repo.**

**Option A — repoint `/try` at `member97` and keep the recurring copy.**
**Option B — reword `/try` to "one-time $97 audit"** and keep the link.

**Recommended Default: Option A**, plus rename the LP slug away from `moe-legacy`.
And check the Vercel dashboard for whether `AIXMOS/public` is deployed — if it is,
it is publishing a 50/50 revenue-share offer that no agreement backs.

**Owner Answer:**
_______________________________________________

---

## D-13 🟠 Founding-operator deferred terms naming a fenced party

**Decision.** What to do with the founding-operator terms recorded in the offer
stack.

**Why now.** `docs/OFFER-STACK.md:15-16` lists **Muhammad Umar as "owner,
MoeLegacy"** with "brain free until $50K is collected", alongside Ayyan Khan. Your
standing instruction is that this party is permanently fenced under any alias, and
that any document naming him as such is stale and must be flagged. **This document
records a money obligation, so I have not edited it.**

**Evidence.**
- `docs/OFFER-STACK.md:15-16`; the same threshold recurs in
  `deal-kit/PAYMENT-SCHEDULE.md:10-15`, `CLOSE-CHECKLIST.md:32`,
  `digitization/COMPENSATION-SCHEDULE.md:24`, `scripts/new-operator:26,41`.
- The DB holds an **inactive** licence row `seed-moe-legacy`
  (`bbbbbbbb-…`, `active: false`) with an **unused install-token hash**.
- The org display name is already "AIXMOS Credit"; `moe_legacy` survives only as a
  frozen internal data key (`handoffs/page.tsx:29` documents this deliberately).
- A public URL still carries the slug: `/lp/moe-legacy/intro-97` (→ D-12).

**Option A — strike the founding-operator row entirely.** *Consequence:* aligns
the document with the fence; removes any implied standing.

**Option B — keep the deferral structure, remove the named party.**
*Consequence:* preserves the commercial mechanism for Ayyan Khan without naming a
fenced party.

**Recommended Default: Option B for the terms; separately, revoke the unused
install token on the inactive licence row.** But **you decide** — this is a record
of a financial arrangement, not a config value, and it is not mine to rewrite.

**Owner Answer:**
_______________________________________________

---

## D-14 🔴 Implementation-vs-promise: the owner-approval gate

**Decision.** Implement the gate, or stop claiming it.

**Why now.** Your own documents state, in four places, that every payout, send,
sign and funding submission passes an owner-approval gate. **It is enforced
nowhere.**

**Evidence.**
- `shared/owner-approval-gate/approval.ts` is a persistence-free stub —
  `assertApproved` reads `.status` off an object handed to it; `createPendingAction`
  returns an object it never saves. Its own line-72 TODO admits persistence,
  notification and approve/reject are unbuilt. **Zero importers anywhere** — not
  src, apps, packages, scripts, or a test.
- `src/lib/owner-approval-enforcement.test.ts` is a **text lint, not a runtime
  gate** — and **passes vacuously**, because nothing in `src` matches either of its
  predicates.
- `requireGate()` (`shared/compliance-gates/gate.ts:40`) also has **zero callers**,
  despite WS2 promising it wraps every legally gated action.
- `public.approvals` exists (`workflow_engine.sql:238`) with **no code readers**.
- `GO.command:74-75` prints green on **file existence** — which is why this survived
  undetected.
- Promises: `CLAUDE.md:135,139`; WS3 `TASKS.md:20`; WS2 `TASKS.md:13,27`; WS1
  `CLAUDE.md:11`.

**⭐ Major mitigator:** `rg "\.(charges|paymentIntents|transfers|payouts|refunds|checkout)\."`
returns **no matches**. **No code in this repository moves money.** The
`pay_commission` promise is unenforced *and* unexercised. Severity is therefore
**future risk, not present loss**.

**Worst currently-reachable path:** `PUT /api/cube/application`
(`src/app/api/cube/application/route.ts:65-93`) — a service-role, RLS-bypassing
write to a credit/funding application containing DOB, income and
`client_consent_given`, reachable by any holder of a mailed deep-link token, with
no approval check and no CROA gate.

**Option A — implement the gate before any money-moving code is written.**
**Option B — delete the stub and remove the claim from all four documents.**

**Recommended Default: Option B now, Option A before the commission engine
ships.** Claiming a control you do not have is worse than not claiming it,
particularly in a credit-adjacent business where the claim may be read as a
compliance representation. Fix `GO.command` to stop reporting green on file
existence either way.

**Owner Answer:**
_______________________________________________

---

## D-15 🔴 Implementation-vs-promise: SMS compliance

**Decision.** Accept the current partial enforcement, or close the gaps before any
outbound campaign.

**Why now.** You hold DNC infrastructure and an A2P/CROA gate, and **neither is
enforced on the one live customer-messaging path**.

**Evidence.**
- `shared/compliance-gates/sms-gate.ts` is correct and well-tested. Its only
  in-repo caller, `src/lib/agent/twilio-send.ts`, **has exactly one importer: its
  own test.** Orphaned confirmed; the intended caller `apps/sales-agent/…` does not
  exist.
- `sendConversationMessage` (`src/lib/ghl/client.ts:266`) is **also orphaned** —
  real GHL sends are configured inside GoHighLevel, **outside this repository, where
  no code gate can reach them.**
- **The one live in-repo customer send is the TwiML `<Message>` reply**
  (`src/app/api/agent/sms/inbound/route.ts:139`). Twilio delivers it as a real SMS.
  It never touches the gate, and is invisible to the enforcement test.
- **DNC is checked nowhere.** Zero code references to `do_not_contact_numbers` or
  the remediation table, despite both existing in production.

✅ **Genuinely enforced:** opt-out (`compliance/opt-out.ts` → `process-inbound.ts:47`),
quiet hours (`:195` nulls the body), CFPB disclaimers, banned-phrase regeneration,
fail-closed Twilio signature verification.

❌ **Not enforced at runtime:** A2P 10DLC / CROA vertical gate; DNC.

**Verdict: partially enforced — do not mark SMS compliance PASS.** Worst path: an
LLM-composed SMS to a consumer with no vertical gate and no DNC check, triggerable
by any member of the public texting a provisioned number. **HIGH**, not critical,
because opt-out, quiet hours and signature verification do hold.

**Option A — wire the gate and a DNC check into the TwiML reply path** before any
outbound campaign.
**Option B — accept it for inbound-only replies** and gate only future outbound.

**Recommended Default: Option A for DNC at minimum.** DNC is the one with direct
statutory exposure, you already hold the list, and the check is small. Do not run
any outbound SMS campaign until it is in place.

**Owner Answer:**
_______________________________________________

---

## D-16 🟡 Asset preservation

**Decision.** Authorize version control and backup for three unversioned systems.

**Why now.** They are single-copy, and **the backup task that was supposed to
protect them is failing**.

**Evidence.**
- `C:\Users\taha1\.config\tmmt` — **400 files / 119 MB**, the entire local-army
  control plane. **No `.git`. No copy found anywhere.** CRITICAL.
- `C:\AIXMOS-MEDIA-VAULT` — **220 files / 1.5 GB**. No `.git`. `C:\Sync\rick\MEDIA-VAULT`
  holds only 38 files / 148 KB of scaffolding — **the media itself has no copy.**
  CRITICAL.
- `C:\Users\taha1\dev\JOB-RADAR` — 45 files / 945 KB. No `.git`.
  `C:\Sync\JOB-RADAR` is a stale partial mirror (21 files, Aug 30, mac variant) on
  a **sync** rail — which propagates deletes, so it is not a backup. HIGH.
- **`AIXMOS Flashdrive Backup` scheduled task: result 1, no next run.**
  `AIXMOS-VaultCycle`: disabled *and* last result `0xFFF8FE00` (failed, 08-31).

**Option A — `git init` all three plus a private remote.**
**Option B — restic/snapshot backup to the NAS, no version control.**

**Recommended Default: both, starting with `.config\tmmt`.** It is the smallest,
the most load-bearing, and the only one with no copy of any kind. Note the standing
lesson that a sync rail is not a backup — a propagated delete previously wiped a
restic repo on both machines.

**Owner Answer:**
_______________________________________________

---

## D-17 ⚪ Dependencies and automation health

**Decision.** Authorize (or defer) dependency upgrades and re-enable degraded
automation.

**Why now.** Both are low-severity but currently unattended.

**Evidence.**
- **2 open Dependabot alerts, both MEDIUM, zero high/critical** (verified via
  authenticated `gh`): `@humanfs/node` (symlink-following recursive copy) and `qs`
  (array-limit bypass). Both transitive in `package-lock.json`, opened 2026-09-03.
- **`TMMT-Autopilot-Pulse` is Disabled** — last run 2026-09-06 15:30, ~24h stale.
- `AIXMOS-VaultCycle` disabled *and* failing. `AIXMOS Flashdrive Backup` result 1,
  no next run (→ D-16).
- The core spine **is** healthy: `hermes.json`, `mesh.json`, `hq-pair.json`,
  `work-baton.json`, `orch-board.md` all written 2026-09-07 16:02; heartbeat/obey/
  watchdog on 5-minute cycles, result 0.

**Recommended Default: defer the dependency upgrades** (both medium, both
transitive, neither reachable from a request path) **and re-enable the Pulse and
backup tasks now** — the backup failure is the one with real consequences (D-16).
**No dependency was upgraded during this pass.**

**Owner Answer:**
_______________________________________________

---

## D-18 🔴 Agent production-write authority: standing grant vs owner gate

**Decision.** Which text governs whether an agent may change production without a
fresh owner instruction.

**Why now.** On 2026-09-07 a new operating script was installed from the owner's
`tmmt-claude-code-bundle` as `docs/CONTROL-PLANE-OPERATING-SCRIPT.md`. Its §3
records a standing grant — *"Fix and do any and all tasks. You have my
permission."* — and concludes that ready, rehearsed, reversible packages **may be
applied to production without re-asking**. Every other governing text says the
opposite. An agent reading only the newest document would widen its own
production authority; the agent that installed it did not, and logged the
conflict here instead.

**Evidence.**
- `docs/CONTROL-PLANE-OPERATING-SCRIPT.md` §3 — the standing grant, scope "all work
  in this repo and every connected system".
- `CLAUDE.md` NON-NEGOTIABLE RULES → OWNER APPROVAL GATE: production-bound paths
  terminate at an owner-approval step; enforcement hook
  `.claude/hooks/owner-approval-gate.py` (see D-14 for how much of that gate is
  real in runtime code).
- Owner's machine-wide rules (`~/.claude/CLAUDE.md`, `~/.claude/rules/*`): "Prod
  deploy / money / send / sign stay owner-gated" — repeated in four files over
  several months.
- `.githooks/pre-push` → `scripts/verify-gate.sh` (types / lint / compliance /
  secrets) — the only production-adjacent control that is actually automated.
- What happened under the conflict: PR #190 read production (`schema_migrations`,
  object existence, cron, row counts) and wrote nothing. Its description states
  "No database change. Nothing was applied."

**Option A — keep the owner gate; amend §3 of the operating script to say so.**
*Consequence:* no change in behaviour; one paragraph of documentation edited; the
contradiction disappears.

**Option B — adopt the standing grant for a named class of change** (e.g. additive,
rehearsed, rollback-shipped migrations only). *Consequence:* the owner must write
the class down explicitly, and the hook plus pre-push gate must be changed to
match. Until enforcement code changes, the text alone grants nothing.

**Recommended Default: Option A — OWNER GATE REMAINS IN FORCE.** A later or
lower-level document must not silently reduce production safeguards; documentation
hierarchy is not something an agent resolves in the direction of fewer controls.
"Continue", "looks good" and "try again" do not authorize a new class of action.

**Owner Answer:**
_______________________________________________

---

## D-19 🟠 S3-05 reason-code taxonomy — business policy, not engineering

**Decision.** Supply the reason codes that the decision contract is waiting for, or
confirm that free-text reasons remain acceptable for now.

**Why now.** Production migration `20260907035109_s3_03_decision_contract.sql`
created `public.reason_codes` **empty on purpose**. The eight `reason_categories`
(DOCUMENT_ADMIN … OTHER) are architectural and seeded; the codes inside them are
business policy. While the table is empty, `bg_check_decide` accepts a
`Not Eligible` decision without a reason and stamps `rule_version = 'pre-taxonomy'`.
The moment any active code exists, `Not Eligible` requires one. Two agents have
now declined to invent the codes; the boundary between filling an implementation
gap and inventing a business requirement runs exactly here.

**Evidence.**
- `supabase/migrations/20260907035109_s3_03_decision_contract.sql` §2 (table),
  `record_decision_event` (the enforcement switch).
- `docs/CONTROL-PLANE-OPERATING-SCRIPT.md` §3 (seeding business-policy values is
  always blocked without an explicit owner line), §6 row S3-05, §8 item 7.
- Downstream: S3-04 routing (reason → destination) and the S3-06 staff screen's
  reason picker both read this table; both stay generic until it is filled.

**What the owner supplies, per code:** `category` (one of the eight), `code`,
`label`, `remediable_by` (`customer` | `staff` | `time` | `none`),
`default_requal_days`, optional `policy_ref`. Delivery as a table in this file or
as a reviewed seed migration applied one-at-a-time under the gate in D-18.

**NO RECOMMENDATION on the codes themselves — this is business policy.** The
repository can only say what shape they must have. **Current default: BLOCKED —
BUSINESS POLICY REQUIRED**; free text continues to be accepted.

**Owner Answer:**
_______________________________________________

---

## D-20 🔴 The vehicle-inclusive offer — where does the car sit, and at what price?

**Decision.** Which rung includes a physical vehicle, and what that rung costs.

**Why now.** This is the only SKU in the catalog that obligates a **physical asset
with a real acquisition cost**, and two sources place it $10,000 apart. Quoting
from the wrong one either under-funds a car by $10,000 or promises one that was
never priced in. **Do not quote any vehicle-inclusive offer until this is settled.**

**Evidence.**

| Source | Price | Vehicle included? |
|---|---|---|
| DB `packages.resale_box_plus_car` | **$25,000** | Name is **"Resale: Box + Vehicle"** — implies yes |
| `docs/OFFER-STACK.md:33` ($25K rung) | $25,000 | **No car.** Reads "credit-repair + business-funding + **car-rental vertical**" — the software vertical for running a rental business |
| `docs/OFFER-STACK.md:34` ($35K rung) | $35,000 | **Yes** — "a **reliable economy car included** for the operator (provided by TMMT through their business) — **or no backend funding fee** if they don't want the car" |

**The entitlement evidence — stated precisely.** `resale_box_plus_car` grants a set
**byte-identical** to `resale_business_in_a_box` ($15,000) — the same six:
`resale_ai_sonnet`, `resale_airtable_automations`, `resale_integrations`,
`resale_priority_support`, `resale_tmmt_os_full`, `resale_whitelabel`.

What this proves is **narrower than "the row is wrong", and more useful**:

> **The entitlement model does not encode what consideration the additional
> $10,000 represents.**

It does **not** prove the database row is erroneous. The $10,000 could be any of:

- a physical vehicle,
- a service or implementation component,
- a legacy commercial distinction that predates the entitlement model,
- stale pricing,
- something else entirely.

Only owner/business evidence can say which. The two readings the *documents*
support are:

- If the delta *is* the car, the DB price sits **$10,000 below** where OFFER-STACK
  puts the car — and a real vehicle's acquisition cost lives in that gap.
- If the delta is the credit/funding vertical (OFFER-STACK's reading), then the row
  is **misnamed** and no car is owed at $25,000 — but that vertical is not recorded
  in entitlements either.

**A second, related ambiguity:** `resale_full_stack_max` spans **$35,000–$50,000**
in one row, collapsing OFFER-STACK's $35K rung (**car included**) and its $45–50K
rung (**no car mentioned**). Inside a single SKU, a car is owed at the bottom of
the range and not at the top.

**Also unpriced:** the $35K rung's alternative — "**no backend funding fee**" if
the operator declines the car — is **defined and priced nowhere in the repository**,
so the value of the alternative cannot be stated.

**Option A — UNBUNDLE.** Software/implementation at the software price; the vehicle
quoted separately at cost-plus or another owner-approved structure. *Consequence:*
vehicle economics stop contaminating software margin; the customer obligation
becomes explicit; no entitlement modelling required.

**Option B — VEHICLE-INCLUSIVE AT $35,000** (OFFER-STACK's reading). Rename the DB
row away from "Box + Vehicle" and treat $25,000 as the credit/funding vertical.
*Consequence:* the ladder becomes internally consistent — **but the physical
deliverable must still be defined in full (see below).**

**Option C — VEHICLE-INCLUSIVE AT $25,000** (the DB's reading). OFFER-STACK's $35K
rung must be re-described, and you must confirm $25,000 covers software delivery
**plus** a vehicle at your actual acquisition cost. *Consequence:* thinnest margin;
same obligation definition required.

**Option D — OTHER.** You specify a different commercial structure.

**Recommended Default (non-binding): Option A.** A used-vehicle price you do not
control should not sit inside a fixed software price, and the entitlement system
cannot represent physical property in any case. Unbundling also disposes of the
$35K rung's undefined "no backend funding fee" alternative. **This is a margin and
obligation decision, not a data-modelling one — it is yours.**

### ⛔ THE HOLD DOES NOT LIFT ON A PRICE ALONE

**Choosing $35,000 (or $25,000) does not clear this decision.** A dollar figure is
not a fulfilment obligation. If any vehicle-inclusive option is selected, the
authority must also state:

| # | Term | Why it must be explicit |
|---|---|---|
| 1 | Exact SKU the vehicle attaches to | Price alone must never imply a car |
| 2 | Exact price | — |
| 3 | Vehicle included: yes/no | Must be a field, not an inference |
| 4 | Specification / class | "Reliable economy car" is not a spec |
| 5 | Ownership and title treatment | Who holds title, and when it transfers |
| 6 | Taxes and registration | Who pays, in whose name |
| 7 | Delivery | Where, when, at whose cost |
| 8 | Substitutions | What you may supply instead |
| 9 | Geographic limits | Where you can actually source and deliver |
| 10 | Condition requirements | Mileage, age, inspection standard |
| 11 | Who bears acquisition cost | And what happens if the market moves |
| 12 | If the vehicle cannot be sourced | Refund, credit, delay, substitution |
| 13 | If the customer declines it | What credit or value they receive |

**Term 13 is already unresolved independently.** `OFFER-STACK.md:34` offers "**no
backend funding fee**" as the alternative to the car — and that concept is
**defined and priced nowhere in the repository**. Until you define the economic
equivalence, **do not represent vehicle value as equal to backend-funding-fee
value.** None of these terms have been invented here.

**Until all of the above are answered: VEHICLE-INCLUSIVE OFFER = HOLD.** No quote,
no invoice, no contract and no public copy naming a vehicle.

**Owner Answer:**
_______________________________________________

---

## SUMMARY — what blocks what

| Decision | Priority | Blocks |
|---|---|---|
| D-1 price authority | 🔴 | D-6, D-11, every quote, every contract |
| D-2 operator seat | 🔴 | a live public contradiction + an undeliverable offer |
| D-3 referral rate | 🔴 | monetizing 876 leads |
| D-4 rev-share / royalty | 🔴 | **every signable instrument** |
| D-6 GHL products | 🔴 | first dollar through checkout |
| D-14 approval gate | 🔴 | a compliance claim you cannot support |
| D-15 SMS / DNC | 🔴 | any outbound campaign |
| D-18 agent prod-write authority | 🔴 | any agent touching production; default: owner gate stays |
| D-5 contract values | 🟠 | papering a deal |
| D-10 sovereign | 🟠 | the highest-ticket offer |
| D-11 billing interval | 🟠 | the merged catalog |
| D-12 `/try` + static tree | 🟠 | a live mis-sale |
| D-13 founder terms | 🟠 | fence compliance |
| D-20 vehicle-inclusive offer | 🔴 | **any quote naming a car — HOLD until answered** |
| D-19 S3-05 reason codes | 🟠 | S3-04 routing, S3-06 reason picker; free text until supplied |
| D-16 preservation | 🟡 | irreversible loss |
| D-8 Dispatch · D-9 Rentals | 🟡 | new revenue lines |
| D-7 `dist/` · D-17 deps | ⚪ | hygiene |

**Ten of twenty decisions require no engineering at all** — D-1, D-3, D-4, D-5,
D-6, D-7, D-13, D-18, D-19, D-20. They are commercial, legal and policy choices
only you can make.
