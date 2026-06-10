# Independent dealership — your own instance (sales 1-pager)

**Use this tomorrow.** Do not onboard independent dealers onto the shared TMMT database until org-level isolation is live.

---

## The offer (30-second pitch)

> You get your **own** TMMT + AIXMOS stack — your customers, your fleet, your data. We deploy it, train your team, and you run it. Not a shared login where someone else might see your books.

---

## Two packages

| | **Ops Kit** | **Dealer Bundle** |
|---|-------------|-------------------|
| **For** | Single-location floor / fleet desk | Owner + ops (full stack) |
| **Setup** | $997 | $3,497 (save $497 vs separate) |
| **Monthly** | $297/location | $697/mo |
| **Includes** | TMMT Ops Kit (USB + digital) | Ops + Command kits |
| **Checkout env** | `NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT` | `NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE` |

Details: [`FLASH-DRIVE-PRODUCT-LINE.md`](../FLASH-DRIVE-PRODUCT-LINE.md), [`SALES-CHANNELS.md`](../SALES-CHANNELS.md).

---

## What they get

- Dedicated deployment (Vercel + Supabase project **you** control)
- Public intake forms → their pipeline
- Staff logins scoped to **their** data only
- GHL checkout + webhook wired to **their** CRM sync
- Launch playbook + 14-day hand-hold window (adjust in contract)

## What they do **not** get on shared TMMT

- ❌ Login on `tmmt-command-center.vercel.app` with other dealers’ data visible
- ❌ “Multi-tenant” on one database (coming later — real `org_id` RLS migration)

---

## Why separate instance (say this if they ask)

> “We can host multiple dealers on one platform later. Right now we ship you **your own house** so your customer list and financials never sit next to another dealer’s. Same product, your keys, your backup.”

---

## Close flow

1. Demo: `/kits` + sample `/forms/lead-intake` on **your** marketing site
2. Send GHL checkout link (Dealer Bundle or Ops Kit)
3. Tag in GHL: `dealer-prospect` → `kit-ordered-dealer-bundle` → `kit-shipped`
4. Provision: clone repo, new Supabase project, env pull, deploy (see [`DEPLOY.md`](../../DEPLOY.md))
5. Hand them **OPERATOR-START-HERE.md** + one admin login

---

## Objection handlers

| Objection | Response |
|-----------|----------|
| “Can’t we just log into your system?” | Not for independent stores — your data stays yours on a dedicated instance. |
| “What about multi-location?” | One instance per brand; add locations inside TMMT once deployed. |
| “We need credit repair too.” | AIXMOS Growth Kit ($97/mo) stacks on top — separate SKU. |

---

## Internal only — do not send to prospect

Shared-DB multi-tenancy (`org_id` + per-org RLS) unlocks bigger TAM but is a **migration**, not same-day. Track as Phase 2 after operator funnel + kit revenue are flowing.
