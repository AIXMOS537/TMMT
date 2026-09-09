# 26 · BUSINESS PROCESS RECONSTRUCTION

How the business **actually** operates through software today — reconstructed from live data, not from intent.

## Flow A — Marketing → Rental (🔴 severed in two places)
```
Ads / content / landing pages
        │  8 public landing pages, all HTTP 200 ✅
        ▼
  /forms/* submission ──▶ visitor sees "Thank you" ✅
        │
        ▼
  /api/leads/webhook ──────────────────── 🔴 SEVERED
        │   2,197 env failures (8-19 → 9-01)
        │   + 184 OrgRowShapeError (9-01)
        │   forms return 200 regardless → losses invisible
        ▼
  incoming_leads (876) ──▶ intake_events (880) ──▶ people (1,209)
        │
        │  (GoHighLevel path still works — 1,642 contacts) ✅
        ▼
  routing engine ──▶ round-robin ──▶ operator
        │
        ▼
  background_checks (299) ──▶ 69 stuck "Need Manager's Review"
        │
        ▼
  APPROVED (81) ─────────────────────── 🔴 SEVERED
        │   81 approved people never received a vehicle
        ▼
  reservation ──▶ ✖ does not exist (bookings = 0)
        ▼
  active_customers (35, frozen 2026-04-22)
        ▼
  customer_payments (31: 26 overdue, 1 paid) ──▶ 🔴 collections failure
        ▼
  return ──▶ former_customers (1)
```

## Flow B — Vehicle → Owner → Payout (🔵 never ran)
```
vehicle ──▶ owner onboarding ✖ ──▶ verification ✖ ──▶ agreement ✖
       ──▶ partner_fleet_access (0) ──▶ revenue_splits (0) ──▶ payout ✖
```
Every stage is either absent or empty. The RLS to protect it is complete.

## Flow C — Failed rental → Credit/LLC/Funding (🔵 built, unused)
```
cannot qualify ──▶ credit_crosssell_004 ──▶ /(learn) onboarding (11 routes)
              ──▶ credit_enrollments (0) ──▶ funding ✖ ──▶ future eligibility ✖
```
**Zero enrolments.** The plumbing (`funding_attribution_wire`, `credit_intake_affiliate_ref`) exists.

## Flow D — Operator network (🟢 the one that works)
```
/forms/operator-apply ──▶ operator_profiles (19)
   ──▶ operator_training_modules (15) ──▶ progress (120) ──▶ self-certify
   ──▶ pipeline_tracker (4) ──▶ affiliate_links (20)
```

## Flow E — Internal ops (🟡 generating, not acting)
```
generate_va_tasks() (daily) ──▶ exec_va_tasks (17,806, +614/2 days)
   ──▶ CHUMMO (SMS) ✖ never sends   ──▶ VISION (internal) ✖   ──▶ HUMAN ✖
coo_briefings (57) ✅   mission digest → Telegram ✅
```

## The three gaps that cost money
1. **Lead intake → database.** Broken 13+ days. Every landing-page lead lost, unrecoverably, while looking successful.
2. **Approved → vehicle.** 81 people cleared and never served. No software gap — there were no cars. **But they are still reachable.**
3. **Billed → collected.** 26 of 31 payments overdue, ~$6,869. No automated arrears, and money is free text so it cannot be automated without a data fix first.

**Gaps 1 and 3 are software problems. Gap 2 is a phone-call problem — and it is the one with revenue attached today.**
