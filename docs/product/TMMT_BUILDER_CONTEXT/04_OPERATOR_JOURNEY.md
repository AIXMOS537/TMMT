# 04 — Operator journey

Source: SPEC §8, §23.2, §23.4 (+ E2 §1.3, §3) · Snapshot 2026-09-21 · canon `4cca6835`

> **CURRENT** = "A day at the desk (today)", the "Real routes today" column, and "Known desk facts". **TARGET** = "Target loop", the "Change" column, the Dealer nav group (archive port, PM-16) and every widget tagged NEW BUILD.

## A day at the desk (today)

| Step | Where in TMMT | Status | Where they leave TMMT |
|---|---|---|---|
| Sign in | `/login` → `/desk` (staff) | WORKING; operators loop (R2) | – |
| See the day | `/desk` KPIs; nav "Dashboard" goes to marketing `/` (R4) | PARTIAL | – |
| Work new leads | `/leads`, `/waitlist` | WORKING | **GHL** for conversation (by design) and pipeline stage moves |
| Screen applicants | `/background-checks` | WORKING | **Airtable** holds licences/paystubs (810 cells) |
| Quote and hold a car | `/bookings`, `/api/rental/quote` | PARTIAL (0 active vehicles) | – |
| Contract | `/interfaces/contracts` (upload a finished PDF) | LEGACY | **Airtable / paper** (the only real signatures) |
| Take payment | `/interfaces/payments` (manual kanban) | PARTIAL | **GHL checkout links, Stripe dashboard, Zelle** |
| Hand over car | public `/forms/handover` | PARTIAL | **paper / phone photos** |
| Fleet status | `/interfaces/vehicles`, `/inspections`, `/insurance` | LEGACY data | **Airtable**, insurer portals |
| Maintenance | `/maintenance`, `/cases`, `/vendors`, `/tickets` | WORKING code, LEGACY data | **ClickUp** |
| Message customers | none (outbox stages only) | – | **GHL conversations** |
| VA task approvals | `/va-queue`, `/command/outbox` (orphaned, owner) | PARTIAL | – |
| Owner command | `/command/desk` (ghost table), `/command/handoffs` | BROKEN / WORKING | Telegram / iMessage relays |
| Reporting | `/revenue`, `/scorecard`, `/money` | WORKING (on unverified money) | spreadsheets |

## Target loop (direction)

Lead in → screened → approved → quote/hold → agreement signed in TMMT → deposit verified by processor → handoff checklist → active rental board with due payments → extension/maintenance/incident from the rental record → return + inspection → deposit settlement → vehicle back to AVAILABLE. Operators leave TMMT only for GHL conversations (by design) and for the processor's dashboard for disputes.

## Operator Console nav (target, SPEC §23.2)

| Group | Real routes today | Change |
|---|---|---|
| Today | `/desk` | make it the home and the "Dashboard" link (fix R4) |
| Leads | `/leads`, `/waitlist`, `/background-checks`, `/credit-funding`, `/operator/leads` | one leads screen; operator pool rebuilt on real tables |
| Rentals | `/bookings`, `/customers` (LEGACY), `/former-customers` (LEGACY), `/do-not-rent` | rentals board on `bookings` |
| Fleet | `/interfaces/vehicles`, `/inspections`, `/insurance`, `/maintenance` | one vehicle list |
| Money | `/interfaces/payments`, `/revenue`, `/affiliates`, `/expenses`, `/operation-costs`, `/money` (owner) | verified vs unverified split |
| Documents | `/interfaces/contracts`, `/interfaces/appointments` | agreements (PM-07) |
| Work | `/tasks`, `/va-queue`, `/tickets`, `/cases`, `/vendors`, `/workflow-vendors` | one vendor list, one task queue |
| Dealer | none in canon | port archive `internal/dealer/*` (10) |
| Team | `/timesheets`, `/scorecard`, `/clock` | keep |

## Dashboard widgets → data source (SPEC §23.4)

| Widget | Source | Tag |
|---|---|---|
| New leads today / by source | `incoming_leads` | EXISTING FOUNDATION |
| Leads awaiting first contact (SLA) | `leadnet-sla-sweep` clock | EXISTING FOUNDATION |
| Applicants to screen | `bg_check_queue` RPC | EXISTING FOUNDATION |
| Approved, not yet placed | `background_checks.eligibility_status` × no booking | EXISTING FOUNDATION (query) |
| Holds expiring | `bookings` hold + expiry | NEW BUILD (expiry) |
| Agreements waiting for signature | `contract_instances` | NEW BUILD (writer) |
| Deposits pending verification | `payments` / `payment_obligation_reconciliation` | NEW BUILD (PM-06) |
| Vehicles by state | derived vehicle state | NEW BUILD |
| Payments due / overdue (verified) | verified ledger | NEW BUILD (today's date sweep is not trustworthy) |
| Returns due this week | `bookings.ends_at` | EXISTING FOUNDATION (0 rows) |
| Open incidents / damage | `vehicle_damage_reports`, `cases` | EXISTING FOUNDATION |
| Messages awaiting approval | `automation_outbox` / `exec_va_tasks` | EXISTING FOUNDATION |
| Utilization % | booking history | NEW BUILD |
| Automation health | `cron.job_run_details`, `ghl_contacts.synced_at`, `ghl_webhook_events` | NEW BUILD screen on existing data |

## Known desk facts a builder must respect

- The `(admin)` desk pages are `"use client"`. They read through the browser anon client (`src/lib/queries.ts` → `src/lib/supabase.ts`), so **RLS is the only row gate**. Writes go through `adminUpsert` (`src/app/(admin)/admin-actions.ts:10-58`: 22-table allow-list, `isStaffUser`, SSR user client).
- `adminUpsert` can set **any string** on `fleet.vehicle_status`, `active_customers.status` and `customer_payments.payment_status` (there is no CHECK).
- Two command/task queues exist: `ops_messages` (a ghost table) and `exec_va_tasks` → `automation_outbox`. Which one survives is an OWNER DECISION (PM-02).
- Two vendor tables exist: `vendors` (`/workflow-vendors`) and `shops_mechanics_cleaning` (`/vendors`). PM-10.
