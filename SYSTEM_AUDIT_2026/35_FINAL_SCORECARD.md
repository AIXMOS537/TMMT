# 35 · FINAL SCORECARD

Scored 0–10 on **evidence**, not intent. A high score means "this works in production today."

| # | Dimension | Score | Reasoning |
|---|---|:--:|---|
| 1 | **Architecture** | **7** | Modern, coherent, well-layered (Next 16 / React 19 / Supabase / RLS). Loses points for 12 route groups serving one business, two middleware files, three public-path allowlists, and a tenancy layer that is actively breaking intake. |
| 2 | **Database** | **6** | 168 tables, RLS everywhere, thoughtful hardening migrations. Undermined by 7 duplicate model pairs and 91 of 168 tables empty. |
| 3 | **Data integrity** | **3** | Money is free text on 32/35 rows. Revenue-per-vehicle joins on a **name string**. Six competing person models. Org ids disagree between code and schema — and that disagreement is losing leads. |
| 4 | **Security** | **7** | **0 ERROR lints. RLS on 100% of tables.** Genuine, repeated hardening; DNC deliberately fails closed. Held back by 50 definer functions callable over REST, 12 by `anon` including business mutators. |
| 5 | **Authentication** | **8** | Supabase Auth, SSR-correct, tier-based routing, reset flows, invite gating. Refresh-token churn and unlogged login failures (`auth failed: {}`) are the only blemishes. |
| 6 | **Authorization** | **7** | Layered edge + server + RLS, fails closed by design. Over-broad: ~12 roles for 3 profiles; unverified guards on privileged RPCs. |
| 7 | **Rental operations** | **2** | **No reservation, no availability, no double-booking prevention.** Lifecycle frozen since 2026-04-22. The business the app is named for is the least-implemented thing in it. |
| 8 | **Fleet management** | **3** | `fleet` works as a table; a dead twin (`vehicles`) sits beside it. No photos, no damage records, no utilisation. All 43 vehicles sold or returned. |
| 9 | **Customer management** | **5** | 1,209 people, 1,642 contacts, good intake structure — spread over six overlapping models, and 759 leads have no status at all. |
| 10 | **Owner/partner management** | **2** | Excellent RLS protecting **zero rows**. No onboarding, agreements, or payouts. |
| 11 | **Vendor management** | **2** | Portal + RLS + routes; `vendor_jobs` = 0. |
| 12 | **Frontend** | **7** | Real component system, good error/empty states, offline PWA, compliance-tested copy. But ~29% of routes render against never-populated tables, and 3 of 4 Interfaces screens shipped silently broken. |
| 13 | **Mobile** | **4** | PWA + offline cache + responsive Tailwind + a phone-first route group. **No camera capture** — fatal for a business whose real mobile use is inspections at the car. Not device-verified. |
| 14 | **GoHighLevel integration** | **8** | Best integration in the system: authenticated, idempotent, tested, bidirectional, per-tenant. Kept lead flow alive through the entire outage. |
| 15 | **AI automation** | **4** | Outstanding compliance engineering (quiet hours, DNC, opt-out, PII redaction, all tested) attached to an agent that has **never held a conversation**. 17,806 unconsumed tasks. Capability without activation. |
| 16 | **Testing** | **5** | 472 passing tests, 57 files, fast, meaningful — and **not one covers rentals, bookings, availability, or payments.** Honest mirror of where effort went. |
| 17 | **Monitoring** | **2** | Sentry and Mixpanel are wired, yet a **13-day, 2,197-error outage** went unnoticed. Instrumentation without alerting is not monitoring. |
| 18 | **Documentation** | **6** | 362 files. `SCHEMA-DRIFT.md` and the BRS v3 are genuinely excellent. But the flagship docs are 3 months stale and the BRS's current-state section is now wrong. |
| 19 | **Deployment** | **3** | Strong CI (`verify.yml` gates lint + 472 tests + build). Wrecked by **20/20 BLOCKED deployments**, a wrong project link, unmanaged prod env vars, and no staging. |
| 20 | **Scalability** | **7** | Nothing is scale-limited — 22k rows on PG17 is trivial. Serverless throughout. Untested at load because there is no load. |
| 21 | **Multi-tenant readiness** | **5** | ~70% built and the hard part (DB isolation) is done. Scored down because org identity is broken, `moe_legacy` lingers, and **zero dealers have applied**. |
| 22 | **Business readiness** | **2** | No vehicles, no partners, no enrolments, 11 leads in August, intake broken. |
| 23 | **Code quality** | **8** | 3 TODOs in 459 files. Comments that explain *why* (`queries.ts:6-22` is exemplary). Consistent idiom, real tests. **The best thing about this project.** |
| 24 | **Overall production readiness** | **3** | As a platform: not ready — the revenue path is broken and undetected. As a codebase: closer than the score suggests. The gap is operational, not technical. |

## Weighted read
**Craft: 7.5/10** (architecture, code, auth, security, GHL).
**Business delivery: 2.5/10** (rental ops, owners, vendors, readiness).

> **This is a strong engineering team building the wrong thing very well.**

The scores that should be highest for a car-rental operating system — rental operations (2), fleet (3), data integrity (3) — are the lowest. The scores that are highest — code quality (8), GHL (8), auth (8) — belong to a CRM-integrated platform. **The scorecard is the diagnosis: the software and the business stopped describing the same company on 2026-04-22.**
