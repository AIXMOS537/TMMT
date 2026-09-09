# 06 · AIRTABLE PARITY MATRIX

## Verdict: **NOT REPLACED — Airtable is still an upstream system of record.**

The migration copied **data** on 2026-04-22. It did not migrate **workflow**, and it never retired the source.

### Proof that Airtable is still live
| Evidence | Location |
|---|---|
| Inbound webhook from Airtable automations | `src/app/api/webhooks/airtable/route.ts` |
| Second Airtable webhook (locations roster) | `src/app/api/webhooks/airtable/locations/route.ts` |
| **Live API reads** from Airtable | `fetchAirtableRecord()` — `src/lib/crm-sync/airtable.ts` (27 refs) |
| Automations *ported*, not retired | migration `20260826_port_live_airtable_automations` |
| Operators exported **from** Airtable | `npm run export-operators` |
| People synced **from** Airtable | `npm run sync:aixmos-people` |
| Env vars still required | `AIRTABLE_LEADS_TABLE`, `AIRTABLE_OPS_LOCATIONS_TABLE` |

Airtable still owns the **Leads verification** step: an Airtable "Verified" checkbox fires an automation that promotes a sync record and creates a case in Supabase.

## Parity matrix
| Airtable capability | Original function | Current replacement | Status | Missing |
|---|---|---|---|---|
| Tables | ~18 operational | 168 Supabase tables | **Improved** | — |
| Records | Rental ops | Copied 2026-04-22 | **Reproduced, then frozen** | Nothing written since |
| Linked records | Native | FK constraints | Reproduced | Several tables lack FKs |
| Lookups | Native | Manual joins in `queries.ts` | **Partially** | Recomputed per page |
| Rollups | Native | Hand-written aggregation (`getVehicleStats`) | **Partially** | No generalised rollup |
| Formulas | Native | TypeScript in `lib/` | **Replaced** | Logic now scattered |
| Views | Per-table saved views | `ViewSwitcher` (dashboard/table/kanban) | **Partially** | Not user-definable |
| Filters / sorting | Native, per-user | `FilterBar` + client-side | **Partially** | Not persisted |
| Grouping | Native | Kanban only | **Partially** | — |
| Interfaces | Airtable Interfaces | `/(admin)/interfaces/*` — 4 screens | 🔴 **Broken for months** | **3 of 4 read a `status` column that does not exist** (real: `vehicle_status`/`appointment_status`/`contract_status`) — empty kanbans, no error |
| Forms | Airtable Forms | **17 routes under `/forms`** | **Improved** | — |
| Automations | Airtable Automations | Ported, **not retired** | 🟠 **Split-brain** | Both systems can act |
| Permissions | Collaborator roles | RLS on all 168 tables + role tiers | **Improved** | — |
| External/vendor pages | Shared views | `/(vendor)`, `/(partner)`, `/(investor)` | **Improved** | `vendor_jobs` = 0 rows |
| Mobile | Airtable app | Responsive web + PWA offline cache | **Partially** | No camera/photo workflow |
| Attachments | Native | Supabase Storage + `document_uploads` | **Partially** | `documents` = 0 rows |
| Activity / history | Native revision history | `audit_events` 124, `memory_events` 11 | **Partially** | Not per-record UI |
| Search | Global | Per-page client filter only | **Missing** | No global search |
| Reporting | Native | `recharts` dashboards | **Partially** | Money not queryable (free-text amounts) |

## The structural problem
The `IF NOT EXISTS` trap (already identified in `docs/SCHEMA-DRIFT.md`) means **a table appearing in the repo does not mean the repo describes production.** Combined with **no generated `Database` types** and no `createClient<Database>`, a wrong column name is not a compile error — it is `undefined` at runtime, which renders as an empty cell. That is precisely how three Interfaces screens shipped broken and stayed broken.

## Recommendation
Pick one, deliberately, and write it down:
1. **Finish the migration** — port the Leads verification automation into the app, retire the Airtable base. Cost: moderate. Removes split-brain.
2. **Formalise Airtable as system-of-record** for Leads + Ops Locations, and delete the half-built parallel paths.

Doing neither — the current state — means two systems can both write the same business fact.
