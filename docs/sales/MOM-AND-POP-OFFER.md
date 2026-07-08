# Mom & Pop Dealership Offer — unified package (Phase 1)

**Sell this first.** Software-only. No credit recovery promise until L1–L10 legal gates are signed.

---

## The one offer for independent dealers

| | **Dealer Bundle** (recommended) | **Ops Kit** (floor-only) |
|---|--------------------------------|--------------------------|
| **For** | Owner + ops team | Single-location floor desk |
| **Setup** | **$3,497** (save $497 vs separate) | **$997** |
| **Monthly** | **$697/mo** | **$297/mo per location** |
| **Includes** | TMMT Ops + Command Center | TMMT Ops only |
| **Deployment** | Dedicated instance (your Supabase + Vercel) | Same |
| **Checkout** | `NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE` | `NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT` |

**Phase 2 upsell (after legal gates):** AIXMOS Growth $97/mo — credit guidance, not credit repair.

**Phase 3 upsell (after case study):** Declined-buyer recovery ($25K–$100K) — see `DEALERSHIP-OUTREACH-KIT.md`.

---

## 30-second pitch (memorize)

> "You get your **own** TMMT stack — fleet desk, customer intake, payments, and an owner command center. We deploy it, train your team, and you run it. Your customer list never sits next to another dealer's. Not a shared login."

---

## What they get (Day 1)

- Dedicated TMMT Ops + Command Center on **their** Supabase project
- Public intake forms → their pipeline (`/forms/lead-intake`, `/forms/dealer-apply`)
- Staff logins scoped to **their** data only
- GHL checkout + webhook wired to **their** CRM sync
- USB kit optional (digital access is instant after checkout)
- 14-day launch hand-hold (adjust in contract)

## What they do NOT get (say this upfront)

- ❌ Login on shared `tmmt-command-center.vercel.app` with other dealers' data
- ❌ Credit repair or "guaranteed approval" language
- ❌ Declined-buyer recovery engine (Phase 3 — separate contract)
- ❌ Multi-location on one shared database (Phase 2 migration)

---

## Qualification (mom & pop bouncer)

Move forward if **3 of 5**:

- [ ] Independent owner or GM is on the call
- [ ] **25+ units/month** (enough volume to justify ops software)
- [ ] Has a floor manager or F&I person who feels daily ops pain
- [ ] Willing to pay setup + monthly (not looking for free trial forever)
- [ ] Not a franchise corporate account requiring OEM approval (those are Phase 3)

Pass politely if: no decision-maker, under 15 units/mo, wants credit recovery only, or expects shared login.

---

## Close flow (software kit)

1. **Demo:** `https://tmmt-ops.vercel.app/kits` + live lead-intake form
2. **Apply:** `/forms/dealer-apply` or GHL checkout link
3. **Tag in GHL:** `dealer-prospect` → `kit-ordered-dealer-bundle` → `kit-shipped`
4. **Provision:** See [`DEALER-ONBOARDING-CHECKLIST.md`](DEALER-ONBOARDING-CHECKLIST.md)
5. **Handoff:** OPERATOR-START-HERE.md + one admin login + 30-min training call

---

## ROI napkin (software tier — not recovery tier)

| Pain | TMMT fix | Value |
|------|----------|-------|
| Leads lost in texts/spreadsheets | Public intake → pipeline | 2–3 extra deals/mo |
| Owner blind to floor numbers | Command Center dashboard | Hours saved weekly |
| No customer follow-up system | Automated reminders + tickets | Fewer no-shows |
| Staff turnover = lost knowledge | SOPs + forms in one system | Faster onboarding |

Frame: *"If this helps you close ONE extra deal a month, it pays for itself."*

---

## Objection handlers (software only)

| Objection | Response |
|-----------|----------|
| "Can we just log into your system?" | Not for independent stores — your data stays yours on a dedicated instance. |
| "What about credit repair for declined buyers?" | Separate product after you're live on ops. We start with running your floor clean. |
| "Too expensive for a small lot." | Ops Kit is $997 + $297/mo — less than one lost deal. |
| "We already have a DMS." | TMMT isn't a DMS — it's rental/fleet ops + owner command. Stacks alongside what you have. |
| "Let me think about it." | Fair. I'll hold your city slot 7 days. After that, first qualified dealer gets it. |

---

## Related docs

- [`DEALER-KIT-ONE-PAGER.md`](DEALER-KIT-ONE-PAGER.md) — internal sales sheet
- [`DEALER-ONBOARDING-CHECKLIST.md`](DEALER-ONBOARDING-CHECKLIST.md) — Day 0–14 delivery
- [`DEALER-CLOSER-PLAYBOOK.md`](DEALER-CLOSER-PLAYBOOK.md) — 15-min demo + close scripts
- [`../FLASH-DRIVE-PRODUCT-LINE.md`](../FLASH-DRIVE-PRODUCT-LINE.md) — SKUs + print pack
- [`../../Sync/rick/STRATEGY/DEALERSHIP-OUTREACH-KIT.md`](../../../../Sync/rick/STRATEGY/DEALERSHIP-OUTREACH-KIT.md) — Phase 3 recovery pitch
