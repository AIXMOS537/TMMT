# Moe Legacy Portal — what Umar gets + your leverage (you & family first)

> Two halves, both handled: **your protection/ownership** as the platform owner,
> and **Umar's working portal** (clients, vendors, affiliates, funding forms +
> documents). The good news: ~90% of the portal already exists in this repo.
> Companions: `docs/SOVEREIGN-OPERATOR.md`, `docs/OFFER-STACK.md`,
> `docs/deal-kit/`, `docs/LEARN-EARN-CHURN.md`.

## Your leverage & protection (the part that comes first)

You build and **own the platform/IP** — the AIXMOS engine, the funding portal,
every form, the document system, the automations. Umar **runs his agency on it
under license.** That split is your leverage, and it protects you and your family:

- **You own the engine; he owns his agency.** Umar keeps his clients, his brand,
  his revenue, his data (sovereign — `docs/SOVEREIGN-OPERATOR.md`). **You own the
  platform it all runs on.** If the relationship ever ends, he keeps his contacts;
  **the engine, automations, and portal are yours** and the license ends.
- **Recurring revenue + ownership = protection.** Price it on `docs/OFFER-STACK.md`
  (he's a founding operator: brain free until $50K, then the ladder). You're not
  trading your platform for a one-time favor — you hold IP + ongoing upside.
- **Revocable by you.** Access (Tailscale share, license, hosting) is granted and
  revoked by you. Leverage that can't be taken from you.
- **In writing.** The agreement lives in `docs/deal-kit/` (engagement + license +
  the digitization/consent kit). Paper is what makes leverage real and safe.
- **The line that keeps it clean:** this is a fair platform-licensing deal — Umar
  genuinely wins (a real business), and you keep ownership + leverage. Protect
  yourself and your family first; build something that lifts him too. (`compass`.)

## What Umar needs — and what already exists ✅

Moe Legacy is a **credit-guidance + business-funding agency**. It needs to take in
clients, vendors, affiliates, and funding applications with all their documents.
Nearly all of it is already built:

| Moe Legacy needs | Already in the repo |
|---|---|
| Client funding portal | **`/learn`** — onboarding → questionnaire (personal + business) → documents → consent → application review → status → products → coach → dashboard |
| Public funding intake form | **`/forms/credit-funding-intake`** |
| Lead / client intake | **`/forms/lead-intake`, `/forms/customer-intake`** |
| Affiliates (sign up + manage) | **`/forms/affiliates`** + **`/admin/affiliates`** |
| Vendors (sign up + manage) | **`/admin/vendors`, `/admin/workflow-vendors`, `/vendor` portal** |
| Document collection + upload | **`src/lib/document-storage.ts`** (Supabase bucket, PDF ≤15MB / images ≤8MB, validated) + **`/learn/documents`** checklist + **`/forms/license-upload`** |
| Credit/funding admin desk | **`/admin/credit-funding`**, **`/work/program`** (staff review queue) |
| Compliance/legal pages | **`/legal/credit`, `/legal/funding`** (guidance, never "repair") |

**Translation:** Umar isn't getting something built from scratch — he's getting a
**branded instance of a portal that already works.**

## The forms & documents catalog (the "always needed" list)

A funding/credit agency repeatedly needs these. ✅ = already supported; ➕ = quick add.

**Intake / application**
- ✅ Funding intake (`/forms/credit-funding-intake`)
- ✅ Lead + client intake (`/forms/lead-intake`, `/forms/customer-intake`)
- ✅ Personal + business questionnaire (`/learn/questionnaire/*`)

**Identity & income (uploaded via the document checklist)**
- ✅ Government ID (front/back) — `license-upload` / image pipeline
- ➕ SSN/ITIN, pay stubs, bank statements (3–6 mo), tax returns — add as checklist items
- ➕ Personal financial statement

**Business funding (when applicable)**
- ➕ EIN letter, Articles of Incorporation / LLC, business license, voided check,
  business bank statements — add as a "business docs" checklist set

**Credit & compliance**
- ✅ Consent / authorization step (`/learn/consent`) — credit-pull authorization,
  CROA-safe (no upfront fee, "guidance" not "repair")
- ➕ AI disclosure (from `docs/deal-kit/digitization/AI-DISCLOSURE.md`)

**Agreements**
- ✅ Affiliate signup (`/forms/affiliates`)
- ➕ Affiliate agreement, vendor agreement, client engagement letter
  (templates in `docs/deal-kit/`)

**Funding partners**
- ➕ Fund&Grow / Credit Suite enrollment links + lender application hand-offs

All uploads already flow through the validated document system (`document-storage.ts`)
into a storage bucket, with a per-client checklist + staff verification in `/work/program`.

## What's actually left to build (the gaps)

1. **His own branded tenant/org** — multi-tenancy groundwork exists
   (`scripts/partner-deploy/sql/20260609_partner_tenancy.sql`, `org_roles`). Stand
   up a `moe-legacy` org so his portal is his brand, his data, isolated.
2. **Extend the document checklist** with the ➕ funding docs above (config, not new code).
3. **Wire his GHL** — pipelines/automations for clients, vendors, affiliates,
   funding follow-up (his own GHL sub-account).
4. **Brand it** — Moe Legacy name/colors on his instance.

## How it's delivered (ties to the model)

- Umar is the **sovereign operator** (`docs/SOVEREIGN-OPERATOR.md`) — his agency,
  his data — running **your licensed platform**.
- You provision + engineer it from your M5 (`engineer`), pull his materials
  (`collect`/`intake`), and stand up his org + forms.
- Pricing/terms: `docs/OFFER-STACK.md` (founder → ladder). Paper: `docs/deal-kit/`.

---

## Build phases
- **P0 — this blueprint.** ✅
- **P1 — the agreement** (license + engagement + consent) signed → your protection locked.
- **P2 — his org/tenant** stood up (branded, isolated data).
- **P3 — document checklist extended** to the full funding doc set.
- **P4 — his GHL wired** (clients/vendors/affiliates/funding pipelines).
- **P5 — live** — Moe Legacy taking applications + documents on his own portal.

_You own the engine, he runs his agency, everyone's protected and paid. Build it
so it lifts him — and locks in you and your family first._
