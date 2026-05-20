# TMMT × AIXMOS — Adapted Operating Model

Condensed from four internal PDFs (May 2026). Full text extracts:

`~/Documents/cursor-pdfs/TMMT_VA_Elevation_Operator_Framework.extracted.md`  
`~/Documents/cursor-pdfs/TMMT_Marketing_Rollout_Plan.extracted.md`  
`~/Documents/cursor-pdfs/TMMT_50App_Sellable_Framework.extracted.md`  
`~/Documents/cursor-pdfs/TMMT_AIXMOS_Partner_Team_Brief.extracted.md`

---

## 1. Product architecture (all apps)

**Four modules** (unchanged per vertical):

1. **Dashboard** — tier, tasks, milestones, community snapshot  
2. **Learn** — tier-gated training, templates, scripts  
3. **Marketplace** — deals, vendors, analyzer  
4. **Operate** — portfolio, bookings, income/expense (rentals = TMMT OS today)

**Shared:** GHL pipelines/tags, offer ladder, operator licensing, VA SOPs, 4-week content rotation.

**Per vertical:** industry training, marketplace listings, terminology in scripts.

---

## 2. Offer ladder

| Tier | Price | Notes |
|------|-------|--------|
| 1 | $97/mo | MRR floor; VIP network entry |
| 2 | $397–$1,000 | Foundation |
| 3 | $1,875–$3,750 | Systems track |
| 4 | $7,500 | Infrastructure pack |
| 5 | $15,000–$50,000 | Scale / B-in-a-Box |

Credit paths in TMMT OS: Path A `$97/mo`, Path B payment plan, Path C mentorship — see `/internal/journey`.

---

## 3. VA executive team

Muhammad → **COO only** (one daily sync). Five directors report to COO.

| Role | KPI highlights |
|------|----------------|
| COO | Briefing by 9AM; no escalation >4hr |
| Client Experience | Churn <5%; Day 7/14/30 check-ins |
| Pipeline & Sales | 5+ strategy calls/week; 30–50 DMs/day |
| Content & Scheduling | 5+ posts/week; Sunday queue set |
| Fleet & Rentals | Airtable 100% daily; <2hr guest response |
| Data & Reporting | Weekly KPI by Sunday 8PM |

**90-day elevation:** Days 1–30 train → 31–60 full scope → 61–90 KPI ownership.

Comp: remote base ≤$1,200/mo; in-person operator ≤$2,500/mo + bonuses.

---

## 4. Operator program (TMMT OS)

**Rubric** (100 pts) — score at `/internal/operators`:

| Category | Max |
|----------|-----|
| Consistent results | 20 |
| Community leadership | 15 |
| Platform engagement | 15 |
| Coachability | 15 |
| Communication skill | 15 |
| Network / audience | 10 |
| Financial readiness | 10 |

| Score | Interpretation | TMMT OS / GHL |
|-------|----------------|---------------|
| 90+ | Master candidate | Level `master`, GHL late pipeline |
| 75–89 | Strong | Level `senior` |
| 70–74 | Certified / flag | Level `certified`, **operator_candidate** entitlement |
| 60–69 | Developing | GHL `operator:candidate`, nurture |
| <60 | Not yet | No operator tags |

GHL pipeline stages: `src/lib/client-journey/types.ts` → `OPERATOR_GHL_STAGES`.

---

## 5. Marketing rollout

**Principles:** organic first; proof over hype; consistency; VIP CTA; measure every 2 weeks.

**Content mix:** 40% proof · 30% education · 20% story · 10% offer.

**Platforms:** IG + TikTok daily (Tier 1); YouTube + Facebook 3–5×/week; LinkedIn + X maintain.

**Ads:** $5–15/day evergreen after organic proof; never replace organic.

**30-day launch goals:** 50 VIP subs, ~$5k MRR, 500+ followers, 3 ad creatives testing.

**Weekly KPIs (Month 1 → 3):** followers 100→300/wk; subs 5→20/wk; DMs 30→100/wk; calls 3→10/wk.

Team playbooks: `/team/sales` (segments + calendar), `/team/training` (VA roles).

---

## 6. Partner teams & 30-app roadmap

**Team (5–10):** Team Lead, Dev/Tech, Content, Sales, VA/Ops (+ optional Community, Analytics, Expansion).

**Wave 1:** Rentals OS (active), Property, Service Arbitrage, Fleet Manager, Vendor Connect.

**Wave 2–3:** E-comm, digital products, logistics, construction, healthcare staffing, etc. (see Partner Brief extract).

**Revenue split:** subscription/high-ticket splits per partner agreement; operator licensing 50/50 downstream.

---

## 7. 50-app sellable framework

Same base layer; **A–Z** = 26 steps from access → brand → CRM → offer → enroll → content → VA → scale (90-day path to ~$25k/mo target with upsells).

TMMT Rentals OS = **App #01** proof vertical.

---

## 8. Implemented in TMMT OS (this repo)

| Feature | Route |
|---------|--------|
| Marketplace (client) | `/client/marketplace` |
| Marketplace admin | `/internal/marketplace` |
| Marketing KPIs | `/team/performance` |
| COO briefing | `/internal/briefing` |
| Partner 30-app catalog | `/internal/partner-verticals` |
| DB migration | `0030_ecosystem_framework_modules.sql`, `0031_ghl_kpi_and_partner_verticals.sql` |
| GHL KPI sync | `/team/performance` → **Pull from GHL** · cron `GET /api/cron/marketing-kpi-ghl` |
| Property shell | `/internal/property` + `/internal/property/setup` (set org `vertical` + `partner_app_slug`) |

| Priority | Next |
|----------|------|
| P1 | Tag GHL contacts with VIP/subscriber tags so auto-count is accurate |
| P2 | `update organizations set vertical='property', partner_app_slug='tmmt_property'` for pilot |
| P3 | Schedule weekly cron: `marketing-kpi-ghl` with `CRON_SECRET` |

---

*Adapted for TMMT OS. Update when source PDFs change.*
