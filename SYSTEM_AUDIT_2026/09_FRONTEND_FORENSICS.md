# 09 · FRONTEND FORENSICS

**105 page routes · 15 layouts · 12 route groups.** Rendering ≠ working; status below reflects whether the underlying data or action actually exists.

## Route groups
| Group | Routes | Backing data | Status |
|---|---:|---|---|
| `(admin)` | 27 | mixed; mostly frozen tables | 🟠 |
| `(auth)` | 3 | Supabase Auth | 🟢 |
| `(command)` | 11 | operators 19, dispute 0 | 🟡 |
| `(executive)` | 1 | derived | 🟡 |
| `(investor)` | 1 | derived | 🔵 |
| `(learn)` | 11 | credit tables all 0 | 🔵 |
| `(operator)` | 4 | operator_profiles 19, progress 120 | 🟢 |
| `(partner)` | 1 | `partner_fleet_access` **0** | 🔵 |
| `(pocket)` | 7 | mixed | 🟡 |
| `(program)` | 4 | `program_applications` **0** | 🔵 |
| `(vendor)` | 1 | `vendor_jobs` **0** | 🔵 |
| public | 34 | forms/legal/lp/kits/build | 🟢 |

## The four Interfaces screens — 🔴 the documented silent failure
`/(admin)/interfaces/{vehicles,contracts,payments,appointments}` were built as Airtable-Interfaces replacements with dashboard/table/kanban views.

**Three of four shipped reading a `status` column that does not exist.** Real columns are `vehicle_status`, `appointment_status`, `contract_status`. With no generated DB types, the read returned `undefined` → rendered as an empty kanban → **no error, for months**. `queries.ts:414` now carries the corrective comment: *"fleet.vehicle_status, not .status — see the note on getAppointmentStats."*

This is the canonical example of "looks like it works". It is why this audit judged every screen by data, not by render.

## Public funnel — 🟢 the healthiest surface
17 `/forms/*` routes, 6 `/legal/*`, `/kits`, `/build`, `/dealers`, `/lp/[org]/[sku]`, `/join`, `/try`, `/upgrade`. All return 200. Well-built, compliance-reviewed (`copy-compliance.test.ts`), tested.

> 🔴 **And that is the trap.** The forms return **200 and a success message** while `/api/leads/webhook` returns 500 behind them. The funnel *looks* perfectly healthy from outside. A visitor submits, sees "thank you", and is discarded.

## Dead / placeholder actions
| Route | Issue |
|---|---|
| `/(partner)/partner` | Renders "No vehicles assigned yet" — `partner_fleet_access` has 0 rows, always |
| `/(vendor)/vendor` | `vendor_jobs` = 0 |
| `/(program)/work/*` (4 routes) | `program_applications` = 0 |
| `/(command)/command/credit-dispute/*` (3 routes) | **9 backing tables absent from production** |
| `/(command)/dispatch/*` (5 routes) | `incidents` = 0 since May |
| `/(learn)/*` (11 routes) | all credit enrolment tables = 0 |
| `/(investor)/investor` | no `investor_updates` rows |

**~30 of 105 routes (29%) render against tables that have never held a row.**

## Loading / empty / error states
Good. `PageHeader`, `StatCard`, `DataTable`, `FilterBar`, `ErrorBanner`, `StatusBadge`, `DetailPanel`, `KanbanBoard`, `ViewSwitcher`, `ExportButton` are a real shared component system, and 36 of 38 files consuming `queries.ts` have a `.catch` (the other two are server components covered by route error boundaries).

## Verification note
Route status was determined **statically** (code + live row counts). The app was **not** run against production, per the audit's read-only constraint. Rendered behaviour under a real session is **UNKNOWN** for authenticated routes.
