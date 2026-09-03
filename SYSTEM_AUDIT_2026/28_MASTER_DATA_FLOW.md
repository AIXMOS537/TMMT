# 28 · MASTER DATA FLOW

## Live system map (✅ works · 🔴 broken · ⚪ built but never used)

```
   ADS / CONTENT / REFERRAL / AFFILIATE(20)
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
  8 LANDING PAGES ✅        GOHIGHLEVEL ✅
  17 /forms routes ✅       (1,642 contacts)
        │                        │
        ▼                        ▼
  /api/leads/webhook 🔴    /api/webhooks/ghl ✅
  ┌──────────────────┐     (6 routes, idempotent,
  │ 2,197 env errors │      secret-verified)
  │ + 184 OrgRowShape│           │
  │  ✱ forms still   │           │
  │    return 200 ✱  │           │
  └──────────────────┘           │
        ╳                        ▼
                      incoming_leads(876) ─▶ intake_events(880)
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              people(1209)  routing engine  memory_facts(57)
                    │            │
                    │            ▼
                    │      round-robin ─▶ operator_profiles(19) ✅
                    ▼
           background_checks(299) ─▶ 69 stuck ─▶ APPROVED(81) 🔴 never served
                    │
                    ▼
        ┌───── RENTAL CORE (frozen 2026-04-22) ─────┐
        │  active_customers(35)                      │
        │  customer_payments(31: 26 overdue) 🔴      │
        │  fleet(43, all sold/returned)              │
        │  tickets(308) waitlist(104) insurance(24)  │
        │  ⚪ bookings(0) payments(0) vehicles(2)    │
        │  ⚪ NO availability · NO double-book guard │
        └────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────────┐
        ▼           ▼               ▼
  ⚪ OWNER      ⚪ CREDIT/LLC/    ⚪ DEALER/
  partner_      FUNDING          WHITE-LABEL
  fleet_access  enrollments(0)   dealer_apps(0)
  (0)           dispute engine   organizations(9)
  revenue_      (schema absent)  licenses(4)
  splits(0)
```

## Parallel: automation & AI
```
generate_va_tasks() daily ─▶ exec_va_tasks(17,806, +614/2d) ─▶ ✖ no consumer
Twilio/Bella agent ─▶ agent_conversations(0) ⚪ (comms hold — deliberate)
agent_jobs(25) ─▶ agent_definitions(2) ─▶ automation_outbox(7) 🟡
cron journey-recompute (04:00) ─▶ client_journey(2) 🟡
cron marketing-kpi-ghl (Mon) ─▶ marketing_kpi_weeks(1) ✅
mission digest (13:00, GH Actions) ─▶ Telegram ✅
coo_briefings(57) ✅
```

## Parallel: Airtable (never retired)
```
Airtable Leads ──"Verified" checkbox──▶ /api/webhooks/airtable
Airtable Ops Locations ──roster change──▶ /api/webhooks/airtable/locations
   app ──fetchAirtableRecord()──▶ Airtable API (live reads)
```

## Where the data actually stops
| Stops at | Volume | Why |
|---|---:|---|
| Landing-page webhook | unknown, unrecoverable | 🔴 500s — **P0-1** |
| Background-check review | 69 | manual step, nobody reviewing |
| **Approved → vehicle** | **81** | no vehicles existed |
| Verification form stages | 377 + 286 | old pipeline, abandoned |
| Waitlist | 104 | never contacted |
| VA task queue | 17,806 | no consumer |
| Outreach touches | 0 | RLS no-policy → fails closed |

**Everything downstream of "approved" is dark.** The pipeline collects people extremely well and converts none of them.
