# AIOMS CATALOG

> **REPOSITIONING REQUIRED (2026-09-08).** The product model is now confirmed as
> **shared multi-tenant white-label SaaS** — customer organisations operate their
> own rental business, their own staff, their own branding. This document is
> written from a **managed-services** hypothesis ($12,500 setup + $2,500/mo) that
> the owner has since ruled out. Its market research remains valid; its
> positioning does not. The $199-$499/mo figure discussed in conversation is a
> **conversational suggestion, not validated pricing** — subscription tiers should
> be designed against the actual tenant surface (fleet size, locations, users,
> transaction volume, premium capabilities, onboarding, support, screening and
> payment costs, infrastructure) once that surface is known. See `docs/saas/`.



**The sales catalog. Readable without opening the repository.**

Audit date: 2026-09-07 · Companions: `COMMERCIAL_MASTER.md`,
`REVENUE_READINESS.md`, `PRICE_RECONCILIATION.md`, `OWNER_DECISIONS.md`

Every price below is tagged with where it comes from:
**[DB]** live `packages`/`operator_profiles` row · **[DOC]** written in
`OFFER-STACK.md` · **[PROPOSED]** not yet anywhere authoritative.

Readiness: 🟢 sell now · 🟡 owner decision or config first · 🟠 needs limited
engineering · 🔴 material product/legal gap.

---

## THE GROUND TRUTH, FIRST

Independently verified against the production database on 2026-09-07:

| | |
|---|---|
| Total revenue ever recorded | **$9,510.57** across **31 payments** |
| Period | 2025-10-13 → 2026-03-23 · **nothing since March** |
| Largest single payment ever | **$577** |
| Software / SaaS revenue ever | **$0** |
| `payments`, `deal_payments`, `revenue_splits`, `partner_referrals`, `signup_invites`, `profile_entitlement_grants` | **0 rows each** |
| `operator_profiles` | 19 rows — **5 at $97/mo, 14 at $0, none at $297** |
| `packages` | 10 rows — 6 priced, 4 unpriced |

**Read this before quoting anything above $577.** Every price in this catalog is
an *asking* price with no demand evidence behind it. That does not make them
wrong; it makes them untested. The fastest way to learn the real number is to
quote one and watch what happens.

**Fulfilment is manual end-to-end and has never been run once.** Package →
entitlement is unwired (`profile_entitlement_grants` = 0). Invites are issued by
hand. Provisioning is an 11-step runbook. Price accordingly: these are
**services**, not self-serve software, whatever the checkout page implies.

---

## 1. 🟢 SELL THIS WEEK

### 1.1 Rentals back-office — done-for-you build

| | |
|---|---|
| **Buyer** | Small independent car-rental / fleet operator, 5–50 vehicles, running on spreadsheets and text messages |
| **Problem** | No system of record. Bookings, payments and vehicle status live in someone's head |
| **Outcome** | One back office that tracks the fleet, the customers, the money and who owes what |
| **What they get** | The rentals workflow surface, customer + payment records, operator accounts, hosted and supported |
| **Setup** | **$15,000** **[DB]** — `Resale: Business in a Box` · 50% deposit to start |
| **Recurring** | **$3,750/mo** **[DOC]** "Mid — Fleet Management" |
| **Delivery** | Done-for-you build + managed run. Days to stand up |
| **Evidence** | **Most operationally proven asset you own.** The only money this business ever collected — all 31 payments — came through rental operations |
| **Readiness** | 🟢 — nothing technical blocks it. Positioning is the open question |
| **Upsell** | Credit/funding vertical once legal gates open; additional operator seats |

### 1.2 Implementation & consulting on the encoded method

| | |
|---|---|
| **Buyer** | An operator or agency that wants the system stood up and does not care what it is built from |
| **Problem** | They cannot assemble this themselves and do not want to |
| **Outcome** | A working stack, configured for their business, by the person who built it |
| **What they get** | Discovery, build, integration, handover, training |
| **Setup** | **Quote** — anchor to the ladder rung that matches scope |
| **Recurring** | Retainer, sized to the work |
| **Delivery** | Services. The 11-step runbook and deal-kit already encode the method |
| **Readiness** | 🟢 — this is the mode where manual fulfilment is expected and priced in |
| **Why it is first** | It converts the *engineering* you already did into cash without needing checkout, entitlements or a price-book decision |

### 1.3 The 876-lead referral relationship

| | |
|---|---|
| **Buyer** | Khan Strategies (or an equivalent funding/credit partner) |
| **Outcome** | Monetise leads you already hold and are not working |
| **Blocker** | **The rate. Nothing else.** `partner_referrals` is built with consent capture and lifecycle — and has **0 rows** |
| **Readiness** | 🟢 the day the percentage is agreed. No checkout, no code, no product |
| **Note** | This is the only asset that can produce revenue with zero engineering and zero configuration |

---

## 2. 🟡 SELLABLE AFTER A DECISION OR CONFIG (1–3 DAYS)

### 2.1 The BUILD ladder

Live in the database, priced, active — but the checkout products do not exist and
two rungs contradict the written offer stack.

| Rung | Price **[DB]** | DB name | Written as **[DOC]** |
|---|---|---|---|
| 1 | **$1,875** | Resale: Airtable Starter | 8 GB laptop, "a taste", GHL basic |
| 2 | **$3,750** | Resale: Airtable Pro | 16/24 GB, helper + automations |
| 3 | **$7,500** | Resale: Airtable + Automations | 32 GB, runs everything |
| 4 | **$15,000** | Resale: Business in a Box | front-end + rentals vertical |
| 5 | **$25,000** | **Resale: Box + Vehicle** | credit + funding + rentals *(no car)* |
| 6 | **$35,000–$50,000** | Resale: Full Stack | everything + **a car** |

> ⚠️ **Two contradictions that will cost real money if not resolved.**
> **(a) The vehicle.** The database includes a car at **$25,000**; the offer stack
> includes it at **$35,000**. That is a $10,000 gap on a deliverable with genuine
> acquisition cost. Sell rung 5 from the wrong sheet and you owe a car you did not
> price.
> **(b) The ladder is named for a platform you are leaving.** Five of six rungs
> are `Resale: Airtable *`, while the standing strategy is to move off Airtable to
> GHL + Supabase. Either rename the ladder or decide Airtable stays.

**Readiness** 🟡 — blocked by **D-1** (which price list governs) and **D-6**
(create the GHL products). Both are decisions/config, not engineering.

> **Config trap, verified:** the runbook tells you to set the eight checkout
> variables *without* the `NEXT_PUBLIC_` prefix the code requires. Follow it
> literally and every checkout silently falls back to the generic campaign site,
> with no error anywhere. **Fix the runbook before creating the products.**

### 2.2 The Kits

| Offer | Setup **[DOC]** | Recurring **[DOC]** | Readiness |
|---|---|---|---|
| Ops Kit | $997 | $297/mo | 🟡 |
| Command Kit | $2,997 | $497/mo | 🟡 |
| Dealer Bundle | $3,497 | $697/mo | 🟡 |

Same blocker as the ladder: GHL products + the prefix defect. No code needed.

### 2.3 Full Ecosystem

**$50,000** **[DB/DOC]** — consult-only by design, no checkout required.
Blocked by **D-5** (contract policy values are unset) rather than by product.

---

## 3. 🟠 NEEDS LIMITED ENGINEERING

### 3.1 Operator Seat — **$97/mo**

| | |
|---|---|
| **Buyer** | An operator working under a AIOMS/AIXMOS org |
| **What it buys** | Their own subaccount + a one-shot on their devices — work at the office or on the move |
| **Price** | **$97/mo [DB]** — carried by 5 live operator rows |
| **Readiness** | 🟠 — manual invite issuance; no automatic entitlement grant |

> **D-2 resolves on evidence, not preference.** `$97` is the implemented price and
> is in the database. `$297` appears only in copy, is carried by **zero** operator
> rows, and the token ledger can grant **only 500 tokens, only on tag `member-97`**
> — nothing in the system can deliver the 2,000 tokens $297 advertises.
> **Recommendation: $97 is the seat. Remove $297 from public surfaces.** Selling
> $297 today is selling something you cannot fulfil.

### 3.2 Dispatch

Complete, multi-tenant, not TMMT-specific — and **`incidents` has 0 rows, ever**.
~1,482 lines. No operational history at any customer. **Unpriced.**
🟠 1–2 weeks to productize. Treat pricing as a hypothesis until one operator runs it.

### 3.3 GHL Voice AI ("Bella")

401-line handler + 327 lines of tests + an idempotent provisioner. No SKU.
**Best attached to the Kit tiers as an add-on, not sold standalone.** Needs A2P
registration per location. 🟠

### 3.4 Sovereign / partner install

**$50,000 + $97/agent/mo** **[DOC]**. The partner-deploy kit is real — issue,
burn USB, health-check, audit readout, revoke, recover, clickwrap, tenancy SQL.
It has been **dormant since June and never run end-to-end**. 🟠 1–2 weeks plus a
dry run. **See the security warning in §5 before writing any claim about it.**

---

## 4. 🔴 DO NOT SELL YET

| Offer | Why |
|---|---|
| **Credit vertical, done-for-you** | All seven legal gates are **closed**. No attorney-approved CROA suite, no VDACS registration, no surety bond. This is months and external, not engineering. **Selling this before the gates open is the single largest legal exposure in the business.** |
| **Any outbound SMS campaign** | **DNC is checked nowhere in code**, while `do_not_contact_numbers` exists in production. Statutory exposure per message. |
| **$297 operator seat** | Cannot be fulfilled — see §3.1. |
| **"Every payout is owner-approved"** as a stated control | The gate is a stub with **zero importers**; its test passes vacuously. *Mitigator: no code in the repo moves money, so it is unenforced and also unexercised.* Do not put it in a contract. |

---

## 5. CLAIMS YOU MUST NOT MAKE

Verified against implementation. Making these in writing creates liability that
the underlying capability does not support:

- ❌ "Cryptographic licensing" → it is an **expiring random install token**
  (`openssl rand -hex 32`, 7-day expiry). Real, useful, *not* cryptographic
  enforcement.
- ❌ "HMAC-signed" → it is **plain unsalted SHA-256**.
- ❌ "Secure Enclave attestation" → it **stores a key it never verifies**.
- ❌ "License JWT" → an **opaque digest**; the code's own comment says full
  Ed25519 signing "happens once vault is wired".
- ❌ "Remote kill switch" → **advisory**, not enforced.
- ❌ "Enterprise authentication" → the control plane is a **single-ID allowlist**.

**What you CAN say, truthfully:** a partner deployment lifecycle covering
issuance, physical delivery, health checking, compliance readout, revocation and
recovery — with tenant isolation enforced by **165/165 tables under RLS and 344
policies**, which is genuinely strong and independently verified.

---

## 6. HOW TO QUOTE — one sentence per asset

| I sell… | to… | for… | readiness |
|---|---|---|---|
| Rentals back-office build | independent fleet operators | **$15,000** + $3,750/mo | 🟢 |
| Implementation & consulting | operators/agencies wanting it done | **quote** + retainer | 🟢 |
| Lead referral | a funding/credit partner | **% of closed** — rate TBD | 🟢 on the rate |
| BUILD ladder rungs 1–6 | owner-operators climbing | **$1,875 → $50,000** | 🟡 D-1 + D-6 |
| Kits | small operators | **$997–$3,497** + $297–$697/mo | 🟡 D-6 |
| Operator seat | each person in an org | **$97/mo** | 🟠 |
| Dispatch | dispatch/field-ops businesses | unpriced hypothesis | 🟠 |
| Voice AI | attach to a Kit | add-on | 🟠 |
| Sovereign install | agencies / MSPs / white-label partners | **$50,000** + $97/agent/mo | 🟠 |
| Credit vertical | credit-repair operators | — | 🔴 legal |

---

## 7. THE HONEST SUMMARY

You have **one asset with revenue history** (rentals, $9,510.57), **one asset
that needs only a phone call** (the 876 leads), and **one mode that is always
sellable** (implementation services). Everything else is a decision or a
configuration away — and almost none of it is blocked by engineering.

The most valuable thing in this catalog is not a product. It is that **seven of
the top blockers are decisions you can make in an afternoon**, and they gate more
revenue than every remaining line of code.
