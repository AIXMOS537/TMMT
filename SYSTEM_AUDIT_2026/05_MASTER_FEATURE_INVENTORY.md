# 05 · MASTER FEATURE INVENTORY

**Legend** — 🟢 functional · 🟡 partial · 🟠 works but risky · 🔴 broken · ⚫ abandoned/dead · 🔵 planned only

Status is assigned by **evidence of use** (live row counts + code references), not by whether a screen renders.

| Feature | Domain | DB evidence | Code evidence | Status |
|---|---|---|---|---|
| Lead intake (public webhook) | Growth | `incoming_leads` 876 | `/api/leads/webhook` | 🔴 **500s since 8-19; 2 root causes** |
| Lead intake (GHL) | Growth | `ghl_contacts` 1,642 | `/api/webhooks/ghl/*` (5 routes) | 🟢 |
| Intake events / routing engine | Growth | `intake_events` 880 | `lib/routing`, 9 migrations | 🟢 |
| People spine | Core | `people` 1,209 | `lib/people` | 🟢 |
| Waitlist | Rental | `waitlist` 104 | `/(admin)/waitlist` | 🟠 frozen data, no workflow |
| Background checks | Rental | `background_checks` 299 | `/(admin)/background-checks` | 🟠 69 stuck in review |
| Tickets | Ops | `tickets` 308 | `/(admin)/tickets` | 🟠 frozen since March |
| Fleet (vehicles, live) | Fleet | `fleet` 43 | `adminUpsert("fleet")`, `getVehicleStats` | 🟠 all sold/returned |
| **Vehicles (parallel model)** | Fleet | `vehicles` 2 | **zero `from("vehicles")`** | ⚫ **dead schema** |
| **Bookings / Payments (parallel)** | Rental | `bookings` 0, `payments` 0 | **zero references** | ⚫ **dead schema** |
| Rental ledger | Rental | `rental_ledger` 3 | `lib/client-rental` | 🟡 |
| Customer payments (live) | Money | `customer_payments` 31 | `lib/queries` | 🟠 free-text amounts |
| Double-booking prevention | Rental | — | **none found anywhere** | 🔵 **does not exist** |
| Vehicle damage / media | Fleet | both 0 | minimal | 🔵 |
| Inspections | Fleet | `fleet_car_inspections` 18 | `/(admin)/inspections`, `/forms/inspection` | 🟡 |
| Contracts | Legal | `contracts` 2, `contract_instances` 0 | `/(admin)/interfaces/contracts` | 🟡 |
| Insurance | Rental | `insurance` 24, `rental_insurance_products` 6 | — | 🟡 seed data, no policy in Drive |
| Do-not-rent / DNC | Compliance | `do_not_rent_list` 12, `do_not_contact_numbers` 10 | gate fails closed | 🟢 |
| Auth + roles | Platform | `profiles` 3, `org_roles` 1 | `middleware.ts`, `lib/auth-roles` | 🟢 |
| Multi-tenancy | Platform | `organizations` 9, `organization_domains` 2 | `lib/platform/*` | 🟠 **cause of P0-1** |
| Licensing / installations | Platform | `organization_licenses` 4, `installations` 2, `hailmary_licenses` 2 | `/api/license/*` | 🟡 |
| Token ledger | Platform | `tmmt_token_ledger` 4, balances 7 | `lib/token-ledger` + tests | 🟢 |
| GHL sync (bidirectional) | CRM | `crm_sync_records` 6, `sync_events` 33 | `lib/ghl` 21 files | 🟢 |
| Airtable sync | CRM | `sync_events` | `lib/crm-sync/airtable.ts` | 🟠 **never retired** |
| ClickUp tasks | Ops | `clickup_tasks` 0 | `lib/clickup` | ⚫ |
| AI agent (SMS/voice "Bella") | AI | `agent_conversations` 0, `agent_messages` 0 | `lib/agent` 29 files + tests | 🔵 **built, never run** |
| Agent spine (jobs) | AI | `agent_jobs` 25, `agent_definitions` 2 | `lib/agents/run-on-case` | 🟡 |
| Exec VA task queue | AI | **`exec_va_tasks` 17,806** | `generate_va_tasks()` | 🟠 **generator, no consumer** |
| Outreach engine | Growth | `outreach_touches` **0** | round-robin migrations | 🔴 RLS no-policy → fails closed |
| Memory fabric | AI | entities 4 / events 11 / facts 57 | `recall_memory_*` RPCs | 🟡 |
| Counselor layer | AI | all 6 tables **0** | 1 migration | 🔵 |
| Credit enrollments / billing | Credit | all 0; `credit_product_catalog` 3 | `/(learn)/*`, `lib/credit-dispute` | 🔵 |
| Dispute engine | Credit | **9 tables absent from production** | `/(command)/command/credit-dispute` | 🔵 UI without schema |
| Operator network | Network | `operator_profiles` 19, training progress 120 | `/(operator)/*`, `/(command)/operators` | 🟢 most-used non-lead feature |
| Affiliates | Growth | `affiliate_links` 20 | `lib/affiliates` + tests | 🟢 |
| Dispatch / rescue | Ops | `incidents` 0, `units` 3 | `/(command)/dispatch/*` (5 routes) | ⚫ dormant since May |
| Vendors | Ops | `vendors` 1, `vendor_jobs` 0 | `/(admin)/vendors`, `/(vendor)` | 🔵 |
| Marketplace / deals | Platform | `marketplace_listings` 4, `deals` 0 | — | 🔵 |
| Money meter | Money | `money_meter_accounts` 1, events 0 | `lib/money-meter` + tests | 🟡 |
| COO briefings | Ops | `coo_briefings` **57** | mission/cron | 🟢 actively generating |
| Mission control (Telegram) | Ops | `mission_items` 0 | `/api/mission/generate`, CI cron | 🟡 |
| Time clock | HR | `time_clock_entries` 1 | `/clock` | 🟡 |
| Offline/PWA cache | Platform | — | `lib/offline`, `/offline` | 🟢 well built |
| Public funnels (kits/build/lp) | Sales | `packages` 10, `entitlements` 53 | `/kits`, `/build`, `/lp/[org]/[sku]` | 🟢 |
| Garage builds | Product | builds 3, mods 16, gates 15 | — | 🟡 |
| Dealer applications | Sales | `dealer_applications` **0** | `/dealers`, `/forms/dealer-apply` | 🔵 |

## Counts
🟢 **12** · 🟡 **12** · 🟠 **8** · 🔴 **2** · ⚫ **5** · 🔵 **9**

**The distribution is the finding.** Only 12 of 48 features are unambiguously working, and 14 (⚫+🔵) are schema or UI with no counterpart — built ahead of demand. The two 🔴 items are both on the revenue path.
