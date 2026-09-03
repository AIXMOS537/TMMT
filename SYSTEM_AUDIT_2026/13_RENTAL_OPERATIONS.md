# 13 · CAR RENTAL OPERATIONS

## Verdict: the rental lifecycle is **not implemented end-to-end**, and the business it models is not currently running.

Last rental started **2026-02-06**. Last payment **2026-03-23**. Last ticket **2026-03-27**. Last inspection **2026-02-23**. Last expense **2026-01-21**.

## Lifecycle coverage
| Stage | Support | Evidence |
|---|---|---|
| Lead | 🔴 **broken** | `incoming_leads` 876; webhook 500s |
| Customer | 🟠 frozen | `active_customers` 35 |
| Application | 🟡 | `customer_intake_forms` 5 |
| Background check | 🟠 | 299 rows, 69 stuck "Need Manager's Review" |
| Approval | 🟠 | **81 approved, never placed** |
| **Reservation** | 🔴 **absent** | `bookings` = 0, zero code references |
| **Availability check** | 🔴 **does not exist** | no availability logic anywhere in `src/` |
| **Double-booking prevention** | 🔴 **does not exist** | no constraint, no check, no test |
| Payment / deposit | 🔴 | `payments` 0; `customer_payments` free-text; **no deposit policy exists** |
| Rental / pickup | 🟡 | `vehicle_handover` 1, `/forms/handover` |
| Inspection (pre) | 🟡 | `fleet_car_inspections` 18 |
| Mileage / fuel | 🔵 | fields exist, no workflow |
| Damage | 🔵 | `vehicle_damage_reports` 0 |
| Extension / late return | 🔵 | none |
| Return | 🟡 | `former_customers` 1 |
| Inspection (post) | 🟡 | shares the inspection form |
| Maintenance | 🟡 | `maintenance_appointments` 4, `shops_mechanics_cleaning` 10 |
| Closure / refund | 🔵 | none |
| Reporting | 🟠 | dashboards exist; **money is unqueryable** |

## State machines — as built vs as needed
**Vehicle** (`fleet.vehicle_status`, from the UI's own option list):
`Available → Rented → Under Maintenance → Needs Repair → Retired → Coming Soon`
Free-text status on a kanban. **No transition rules, no guards, no history table.** Any status can jump to any other; nothing records who changed it or when.

**Reservation:** *does not exist.* There is no `REQUESTED → APPROVED → CONFIRMED → ACTIVE → COMPLETED` machine anywhere.

## 🔴 The double-booking finding
There is **no mechanism of any kind** preventing two customers being assigned the same vehicle for overlapping dates:
- no exclusion constraint or unique index on (vehicle, date-range);
- no availability query in application code;
- no test (472 tests, none touch booking);
- `bookings` — the table that would hold date ranges — has never held a row.

Today this is harmless: there are no vehicles and no bookings. **The moment rental operations restart, this is the first thing that will cause a real-world failure** — two customers at the counter for one car. It must be built before the first reservation, not after.

## Why it failed (already established, confirmed)
Of 31 payment records: **26 Overdue, 1 Paid** — roughly **$6,869 past due** against **$9,510** billed. **The business failed on collection, not on demand or price.** The `PAYMENT_ISSUE` state and 3-day-grace/$25-per-day rules in the business spec exist to fix exactly this and are **not implemented**.

## What a real rental OS needs before restart
1. `bookings` wired to the UI with a **date-range exclusion constraint** (`tstzrange` + `EXCLUDE USING gist`).
2. Numeric money — `amount_cents integer`, migrating the 32 free-text rows.
3. A vehicle state machine with a transition table and history.
4. Automated arrears: grace period, late fee, `PAYMENT_ISSUE` trigger.
5. Tests for every one of the above.

**Estimated: 2–3 focused weeks.** But it should not start until there are vehicles — see `31_BUILD_NEXT.md`.
