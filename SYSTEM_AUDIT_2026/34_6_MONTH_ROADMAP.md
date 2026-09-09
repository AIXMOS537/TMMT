# 34 · 6-MONTH ROADMAP

Months 4–6 assume the 90-day plan landed: leads flow, monitoring exists, money is numeric, arrears automated.

| Track | M4 | M5 | M6 |
|---|---|---|---|
| **Rental ops** | Booking + availability live with double-booking constraint; deposits per an actual written policy | Extensions, late returns, refunds; full lifecycle tested | Utilisation + per-vehicle P&L (needs the FK fix) |
| **Fleet** | Photo/damage capture in-form; condition history | Maintenance scheduling from real mileage | Depreciation + disposal |
| **Owners/partners** | *Only if a partner signs:* onboarding + agreement | Revenue-split calculation + statements | Payout run + owner portal with real rows |
| **CRM** | Airtable decision executed — retire or formalise | One intake owner; dedupe the 6 person models → `people` | GHL ↔ app contract documented and tested |
| **Automation** | Second agent live (review requests) | Reactivation sequence, approval-gated | Exception detection on stuck stages |
| **AI** | Memory fabric used in agent context | Lead scoring against 876 leads | Evaluate agent quality (`agent_evaluations` — currently 0) |
| **Credit/LLC/funding** | Legal opinion recorded; referral-only conversion push | First enrolments (target > 0 — today it is 0) | Cross-sell wired to rental declines |
| **Analytics** | Revenue queryable end-to-end | Cohorts: lead → approved → rented | Board-grade weekly pack |
| **Multi-tenant** | **FROZEN** | **FROZEN** | Unfreeze *only* on a paid dealer deposit |
| **SaaS/dealer** | **FROZEN** | **FROZEN** | If unfrozen: fix org identity properly first |
| **Platform health** | Staging permanent; branch protection verified | Repo prune after tagging the 12,788 commits | Migrations always via repo — drift back to ~0 |

## The two gates that decide months 4–6
1. **Are there vehicles?** No cars → the entire rental track is theoretical. Do the credit/funding + lead-conversion track instead.
2. **Is there a paying dealer?** `dealer_applications` = 0. Until one pays, multi-tenancy stays frozen — it is the feature that broke lead intake.

## Success metrics
| Metric | Today | M3 | M6 |
|---|---|---|---|
| Lead webhook success rate | **~0%** | >99% | >99.9% |
| Leads/month | 11 (Aug) | 50+ | 150+ |
| Approved→placed conversion | **0 of 81** | 10+ | sustained |
| Revenue queryable | **No** | Yes | Automated |
| Migrations in repo | 41/214 | 214/214 | maintained |
| Rental-core test coverage | **0** | basic | full lifecycle |
| Undetected outage duration | **13 days** | <15 min | <5 min |
| Credit enrolments | **0** | >0 | growing |
| Tables with 0 rows | 91/168 | <70 | <50 |
