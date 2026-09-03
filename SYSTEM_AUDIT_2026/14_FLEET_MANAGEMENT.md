# 14 · FLEET MANAGEMENT

## Canonical source of truth: `fleet` (43 rows) — CONFIRMED
`fleet` is written by `adminUpsert("fleet", …)` (`src/app/(admin)/interfaces/vehicles/page.tsx:129,135`) and read via `getFleet()` → `getVehicleStats()` (`src/lib/queries.ts:411`).

**`vehicles` (2 rows) is a competing model with zero application references.** `git grep from("vehicles")` → no results. It was created by `20260518033625_vehicles_and_booking_vehicle_id` alongside `bookings`, RLS'd by `vehicle_hub_ops_rls`, and never wired up.

> **All 43 fleet vehicles are sold or returned** (owner statement, 2026-09-01). Fleet management currently manages nothing.

## Coverage
| Capability | Status | Evidence |
|---|---|---|
| Vehicle inventory | 🟠 | `fleet` 43, frozen 2026-04-22 |
| VIN / plate | 🟢 | `20260513_partner_fleet_plate_vin` |
| Registration / title / insurance | 🟡 | `insurance` 24; **no policy document exists in Drive** |
| Mileage | 🟡 | field only |
| Location | 🟡 | `ops_locations` via Airtable roster |
| Keys | 🔵 | none |
| Condition | 🟡 | `fleet_car_inspections` 18 |
| Maintenance | 🟡 | `maintenance_appointments` 4, `shops_mechanics_cleaning` 10 |
| Damage | 🔵 | `vehicle_damage_reports` **0** |
| Photos / media | 🔵 | `vehicle_media` **0**, `customer_inspection_photos` 1 — the onboarding form itself says *"Photos should be taken separately and uploaded to the vehicle's record"* |
| Availability | 🔴 | **not implemented** |
| Pricing | 🟡 | `rental_pricing_rules` 10 — **seed data, not the real rate card** (real: sedans $300+, SUVs $450+) |
| Utilisation | 🔵 | none |
| Revenue per vehicle | 🟠 | `getVehicleStats` computes it by **string-matching a vehicle name** in `customer_payments` — no FK |
| Expenses | 🟡 | `expenses` 34, `operation_costs` 5 |
| Depreciation | 🔵 | none |
| Owner assignment | 🔵 | `partner_fleet_access` **0** |
| Status | 🟠 | free text, no transition rules |

## 🟠 The revenue-per-vehicle join is a string match
`src/lib/queries.ts:411` builds `revenuePerVehicle` by grouping `customer_payments` on `p.vehicle ?? p.vehicle_name` — a **name string**, with no foreign key to `fleet`. A renamed or misspelled vehicle silently splits or loses its revenue. Combined with free-text `payment_amount`, **per-vehicle profitability is not trustworthy.**

## Gaps that matter before restart
1. Availability + booking (see `13_RENTAL_OPERATIONS.md`).
2. **Real FK** from payments/rentals to `fleet.id`.
3. Photo/damage capture — a rental business without photographic condition evidence carries direct financial exposure on every return.
4. Decide `fleet` vs `vehicles` and delete the loser.
