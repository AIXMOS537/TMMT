# Dealer Onboarding Checklist — Day 0 through Go-Live

**Use after payment clears.** One checklist per dealer. Tag in GHL: `dealer-prospect` → `kit-ordered-dealer-bundle` → `kit-provisioning` → `kit-live`.

---

## Pre-flight (before you take money)

- [ ] Qualified on [`MOM-AND-POP-OFFER.md`](MOM-AND-POP-OFFER.md) bouncer (3 of 5)
- [ ] Package confirmed: **Ops Kit** or **Dealer Bundle**
- [ ] Decision-maker on contract (Owner or GM)
- [ ] Dedicated instance confirmed — **never** shared TMMT database for independent dealers
- [ ] GHL checkout URL live (not `#checkout-pending`)

---

## Day 0 — Order received

| Step | Action | Owner |
|------|--------|-------|
| 0.1 | Payment confirmed in GHL / Stripe | Auto webhook |
| 0.2 | Tag contact: `kit-ordered-dealer-bundle` (or `kit-ordered-ops`) | Auto or Rick |
| 0.3 | Create dealer folder: `~/Documents/Business/dealers/<slug>/` | Rick |
| 0.4 | Send welcome email: "We're provisioning your instance — 48–72 hours" | Draft → approve |
| 0.5 | Schedule 30-min kickoff call (Day 3–5) | Front desk draft |

**Capture in dealer folder:**
- Dealership legal name
- Primary contact + role
- City / state (city exclusivity note if applicable)
- Package SKU (OPS-001 or DLR-BND)
- GHL contact ID

---

## Day 1–2 — Provision dedicated instance

| Step | Action | Reference |
|------|--------|-----------|
| 1.1 | Create new Supabase project (`<slug>-tmmt`) | Supabase dashboard |
| 1.2 | Run migrations: `supabase db push` | TMMT repo |
| 1.3 | Create Vercel projects: `<slug>-ops`, `<slug>-command` (if bundle) | [`DEPLOY.md`](../../DEPLOY.md) |
| 1.4 | Copy env template from `.env.example` → dealer `.env` | Never commit secrets |
| 1.5 | Set `NEXT_PUBLIC_OWNER_HUB_HOST` to dealer subdomain or vercel.app | DNS optional Day 1 |
| 1.6 | Deploy: `npm run build` → push → verify smoke | `npm run smoke:prod` |
| 1.7 | Create admin user in Supabase Auth | Service role script |
| 1.8 | Tag: `kit-provisioning` | GHL |

**Optional — USB kit:**
- [ ] Run `bash scripts/build-retail-usb.sh ops /Volumes/...`
- [ ] Print envelope + quick-start from `docs/flash-drive-kits/`
- [ ] Ship + tag `kit-shipped`

---

## Day 3 — Kickoff call (30 min)

**Agenda:**
1. Confirm goals (fleet desk? customer intake? owner visibility?)
2. Walk through admin login + dashboard
3. Show public forms: `/forms/lead-intake`, `/forms/dealer-apply`
4. Confirm staff roles needed (how many logins?)
5. Set go-live date (Day 7–14)

**Deliverables after call:**
- [ ] Admin credentials sent (secure channel — not email plaintext if possible)
- [ ] `OPERATOR-START-HERE.md` (or dealer-specific START_HERE)
- [ ] Link to `/kits` on **their** instance for reference

---

## Day 4–7 — Configure their stack

| Step | Action |
|------|--------|
| 4.1 | Add staff users (floor manager, F&I, owner) |
| 4.2 | Import existing customers/vehicles if CSV available |
| 4.3 | Wire GHL webhook → their `/api/webhooks/ghl` |
| 4.4 | Create GHL tags: `tmmt-customer`, `dealer-prospect`, etc. |
| 4.5 | Test lead-intake end-to-end (form → Supabase → GHL if bridged) |
| 4.6 | Customize public form branding if requested |

---

## Day 8–14 — Go-live + handoff

| Step | Action |
|------|--------|
| 8.1 | Staff training (45 min): forms, tickets, payments, daily workflow |
| 8.2 | Owner training (30 min): Command Center, KPIs, exports |
| 8.3 | Run 3 test transactions / lead flows with dealer staff watching |
| 8.4 | Tag: `kit-live` |
| 8.5 | Schedule Day 30 check-in |
| 8.6 | Request testimonial / case study permission |

---

## Post go-live — Day 30 check-in

- [ ] Usage review: logins, forms submitted, tickets opened
- [ ] Any blockers? (training gaps, missing features)
- [ ] Upsell conversation: AIXMOS Growth $97/mo (only if L1–L10 signed)
- [ ] NPS: "Would you recommend this to another dealer?"

---

## Escalation

| Issue | Route |
|-------|-------|
| Payment / billing | GHL + bookkeeping draft |
| Legal / compliance language | Legal-ops draft |
| Technical outage | Rick → smoke + redeploy |
| Credit/funding upsell | Blocked until L1–L10 signed |

---

## Scripts & tools

```bash
# Provision partner org (shared platform path — future)
bash scripts/provision-partner.sh <slug> "<Display Name>" full_os

# Build USB
bash scripts/build-retail-usb.sh ops /Volumes/TMMT-OPS

# Verify production
SMOKE_BASE_URL=https://<slug>-ops.vercel.app bash scripts/smoke-prod.sh
```

---

## Related

- [`MOM-AND-POP-OFFER.md`](MOM-AND-POP-OFFER.md)
- [`DEALER-CLOSER-PLAYBOOK.md`](DEALER-CLOSER-PLAYBOOK.md)
- [`DEALER-KIT-ONE-PAGER.md`](DEALER-KIT-ONE-PAGER.md)
- [`../runbooks/ACTIVATE-GHL-MONEY-COLLECTION.md`](../runbooks/ACTIVATE-GHL-MONEY-COLLECTION.md)
