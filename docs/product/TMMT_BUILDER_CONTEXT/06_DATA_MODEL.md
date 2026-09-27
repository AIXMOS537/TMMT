# 06 — Data model

Source: SPEC §9, §30 (+ E3 §1, E5 §C.3) · Prod catalog + aggregate counts 2026-09-21 · canon `4cca6835`

> **CURRENT** = every table, row count, duplicate, ghost table and column-drift entry (prod as read on 2026-09-21). **TARGET** = "Missing entities" (all NEW BUILD; none exists) and the direction column of "Duplicate concepts" (PM-02 owner decisions). The migration rules are binding now.

> **Ledger drift warning.** The repo **cannot rebuild prod**. Prod `schema_migrations` has **279** rows; the repo has **89** migration files (+12 `_staged`, +4 `_parked`). About 190 prod-only migrations have no repo file. **No repo migration contains `CREATE TABLE`** for `bookings`, `payments`, `rental_ledger`, `vehicles`, `fleet`, `active_customers`, `customer_payments`, `contract_instances`, `lto_agreements`, `rental_pricing_rules`, `crm_sync_records`, `client_journey`, `documents`, `contracts` or `vehicle_handover`. Only `supabase/schema/live-ledger-2026-09-07.tsv` records them. 6 of 7 deployed edge functions have no repo source.
> **Therefore: prod is the schema truth.** Never infer a column from repo SQL, and never invent one. Check the prod catalog (read-only) or the PM-01 snapshot once it exists. Row counts drift daily.

RLS is on for all 178 public tables.

## Rental core (as-is)

| Entity | Table | Rows | Status |
|---|---|---:|---|
| Booking | `bookings` | 0 | EXISTING/PARTIAL. `status` CHECK `hold\|confirmed\|active\|completed\|cancelled\|no_show`; only `hold` is written; `bookings_no_overlap` EXCLUDE (gist, statuses hold/confirmed/active) is live |
| Vehicle (booking FK target) | `vehicles` | 27 (all `active=false`) | EXISTING/PARTIAL |
| Vehicle (operational) | `fleet` | 43 | LEGACY (Airtable-shaped, free-text `vehicle_status`, still read as live) |
| Rental (de facto) | `active_customers` | 35 (all 'Removed') | LEGACY / EXISTING/BROKEN (trigger writer) |
| Former rental | `former_customers` | 1 | LEGACY |
| Journey | `client_journey` | 35 | EXISTING/PARTIAL (derived; nothing to derive from) |
| Contract (legacy) | `contracts` | 2 (0 PDFs) | LEGACY |
| Contract (typed) | `contract_instances` | 0 | ORPHANED (enum: rental_agreement, lto_purchase_agreement, vehicle_turnover, vehicle_exchange, operator_license) |
| LTO | `lto_agreements` | 0 | PLACEHOLDER |
| Documents | `documents` | 0 | ORPHANED |
| Handover | `vehicle_handover` | 1 | EXISTING/PARTIAL (anon insert) |
| Vehicle events | `vehicle_events` | 0 | ORPHANED (enum turnover\|exchange\|return_inspection\|lto_start\|lto_complete) |
| Damage | `vehicle_damage_reports` | 0 | ORPHANED |
| Vehicle media | `vehicle_media` | 0 | ORPHANED |
| Maintenance | `maintenance_appointments` | 4 | LEGACY |
| Inspection | `fleet_car_inspections` 18 / `vehicle_onboarding_inspections` 0 / `customer_inspection_photos` 1 | | LEGACY / ORPHANED |
| Insurance | `insurance` 24 / `rental_insurance_products` 6 / `rental_insurance_selections` 0 | | LEGACY / PLACEHOLDER |
| Pricing | `rental_pricing_rules` | 10 | EXISTING/WORKING |
| Tolls, extensions, returns, deposits (collected) | – | – | **MISSING** |

## People, money, tenancy

- **There is no `customers` table.** Identity is split across `incoming_leads` 892, `ghl_contacts` 1,656, `people` 1,210 (a stale GHL snapshot), `active_customers`, `former_customers`, `background_checks` 299, `profiles` (3), `client_journey.customer_email`, `bookings.customer_email`, `rental_ledger.customer_email`, `parties` 0, `portal_clients` 0 and `dispute_clients` 0. Joins are by lower-cased email text.
- `incoming_leads`: `agent_status='NEW'` on all 892; `status` null on 759; `stripe_payment_intent_id` null on 892.
- **Money:** `customer_payments` 31 (Overdue 25, Paid 1, Written Off 1, null 4; the typo column is `amout_past_due`), `payment_obligation_reconciliation` 31 (all `unverified`; its CHECK requires `verified_by` + `evidence_ref`), `payments` 0 (orphaned; `external_id` **not unique**), `rental_ledger` 3 (entry types deposit/deposit_return/payment/deduction/expense/refund/insurance_premium; investor may INSERT/UPDATE), `deal_payments` 0, `credit_payment_schedule` 0.
- **Tenancy:** `organizations` 9 (Stripe/Twilio/Cal columns null on 9/9). Most tables use `org_id`. `incoming_leads` has **both** `org_id` and `organization_id`. `rental_ledger`, `parties`, `deals` and `journey_checkpoints` use `organization_id`. 119/178 tables carry a tenant column.
- **Work queue:** `exec_va_tasks` 19,097; `tasks` 0; `clickup_tasks` 0.
- **Audit:** `audit_events` 3,895; `change_log` 2 (authenticated ALL `true`).
- **Outbox:** `automation_outbox` 35 queued / 0 sent; `do_not_contact_numbers` 78.

## Duplicate concepts (owner decisions in PM-02)

| Concept | Competing tables |
|---|---|
| Vehicle | `fleet` ↔ `vehicles` (bridge `fleet_vehicle_id`, **no FK**) ↔ `customer_vehicles` ↔ `units`. SoR names `fleet`; the booking FK targets `vehicles` |
| Person | 9+ tables → person spine keyed on E.164 (coordinate with GHL M5) |
| Rental | `active_customers` ↔ `bookings` ↔ `client_journey` ↔ `crm_sync_records.canonical_stage` ↔ `cases` |
| Payment | `customer_payments` ↔ `payments` ↔ `rental_ledger` ↔ `deal_payments` ↔ `credit_payment_schedule` |
| Contract | `contracts` ↔ `contract_instances` ↔ `lto_agreements` ↔ `documents` |
| Booking status vocabulary | `bookings.status` CHECK vs the unused enum `booking_status` vs `canonical_renter_stage` (13 values) vs `agent_status` vs free text |
| Vendors | `vendors` vs `shops_mechanics_cleaning` |
| Command/task queue | `ops_messages` (ghost) vs `exec_va_tasks` → `automation_outbox` |

## Ghost tables (code queries tables that do not exist in prod) — 14

| Ghost table | Queried from | Effect |
|---|---|---|
| `ops_messages`, `ops_threads` | `src/app/ops-actions.ts`, `src/lib/queries.ts` | `/command/desk`, `/executive`, `/operator` feed fail |
| `ops_locations` | `src/lib/routing/*`, `api/webhooks/airtable/locations` | routing fails |
| `dispatch_loads` | `src/lib/routing/execute.ts` | routing fails |
| `lead_pool`, `lead_routes` | `src/lib/lead-pool.ts` | operator lead pool fails |
| `pocket_referral_codes`, `pocket_referral_earnings` | `src/lib/referrals.ts` | `/pocket/earn` fails |
| `activity_logs` | `src/lib/intake/unified.ts`, `src/lib/ops-command/execute.ts` | intake audit silently dropped (FS-04) |
| `investor_updates` | investor portal | `/investor` fails |
| `engagement_change_requests`, `client_engagements` | `src/lib/engagement.ts` (a staged migration exists) | `/pocket/build` fails |
| `company_policies` | policy lookup | fails |
| `do_not_contact_emails` | `src/lib/email/outbound-email-gate.ts` (staged) | email gate behaviour UNKNOWN (should fail closed) |

**Column drift:** `active_customers.email` (the real column is `contact_email`) at `api/webhooks/ghl/route.ts:211`; `customer_payments.amount_past_due` (the real column is `amout_past_due`) in `ghl-payment-sync.ts`; `vin_number` form fields (the real column is `vin`) in `customers/page.tsx:126`, `former-customers/page.tsx:70`, `partner/page.tsx:20`.

## Missing entities (NEW BUILD)

`person` spine · `status_event` / rental transition log · qualification decision · `vehicle_owners` · `owner_agreements` · deposit (collected) · extension · return · tolls/violations · reconditioning · late-fee disposition (charity) · message delivery log.

## Migration rules (SPEC §30)

0. **Reconcile ledger drift before any schema work** (PM-01).
1. Every new migration must be idempotent. It must `REVOKE` the default grants from anon/authenticated, because the default ACL for `supabase_admin`-owned new tables re-grants TRUNCATE + ALL (SEC-16). RLS must be on with explicit policies. The org column is `NOT NULL`, with a server-derived value. A PGlite rehearsal must be wired into CI. Apply only with the prod write baton and a pre-apply snapshot, and record the postcondition queries.
2. Put new SQL in `supabase/migrations/_staged/*_STAGED.sql` until the owner approves an apply.
3. Rescued migrations are **never applied as written** (Fast Track `applications`, `0033_dealer_instance_inventory`, `applications_funding`).
4. Data migrations (vehicle owners, the 99 leads with unresolved org, Airtable documents) need human reconciliation.
5. The landmine `_staged/20260904010000_generate_va_tasks_idempotent_STAGED.sql` is **never applied**.
6. GHL M2 codifies the intake/GHL tables. PM-01 covers the rest; split the table list with that track first.
