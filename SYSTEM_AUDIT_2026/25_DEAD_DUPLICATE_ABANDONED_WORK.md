# 25 · DEAD / DUPLICATED / ABANDONED WORK

**Nothing was deleted. Nothing is recommended for deletion without an owner decision.** Classification: KEEP / CONSOLIDATE / ARCHIVE / REMOVE / UNKNOWN.

## 🔴 Duplicate data models — the expensive ones
| Live | Dead twin | Evidence | Action |
|---|---|---|---|
| `fleet` (43) | `vehicles` (2) | zero `from("vehicles")` in `src/` | **CONSOLIDATE** — pick one, document it |
| `active_customers` (35) + `customer_payments` (31) | `bookings` (0) + `payments` (0) | zero references | **CONSOLIDATE** |
| `fleet_car_inspections` (18) | `vehicle_damage_reports` (0) | — | CONSOLIDATE |
| `document_uploads` | `documents` (0) | — | CONSOLIDATE |
| `exec_va_tasks` (17,806) | `tasks` (0), `clickup_tasks` (0) | — | CONSOLIDATE |
| `contracts` (2) | `contract_instances` (0), `lto_agreements` (0) | — | CONSOLIDATE |
| 6 person models | `people`/`ghl_contacts`/`incoming_leads`/`active_customers`/`parties`(0)/`portal_clients`(0) | — | CONSOLIDATE |

**`bookings` + `vehicles` + `payments` are the *better* schema.** They are normalised, RLS'd and FK'd — and unused. The legacy Airtable-shaped tables hold the data. This is the single most important architectural decision left open.

## 🟠 Duplicate code
| Item | Detail | Action |
|---|---|---|
| **Two middleware files** | `middleware.ts` (root, 16 edits) **and** `src/middleware.ts` (272 lines, 12 edits). Next.js uses one. | **CONSOLIDATE** — verify which is live |
| `src/lib/agent/` (29 files) vs `src/lib/agents/` (1 file) | Near-identical names, different purposes | RENAME |
| 3 public-path allowlists | `isFunnelPublicPath` / `isPublicPath` / `isPitchPublicPath` | CONSOLIDATE |
| Outreach drainer | Already reverted as duplicate — `354ec2a84` | ✅ done |
| Two CLI entrypoints | `scripts/tmmt` (58 edits) + `scripts/go` (27) | UNKNOWN |

## ⚫ Abandoned features (built, zero rows, no recent commits)
| Feature | Evidence | Action |
|---|---|---|
| **Rescue dispatch** | 5 routes, Leaflet maps, RLS, smoke test; `incidents` **0** since May | ARCHIVE |
| **ClickUp integration** | full lib + 2 migrations; `clickup_tasks` **0** | REMOVE |
| **Counselor layer** | 6 tables, all **0** | ARCHIVE |
| **SMS/voice agent** | 29 files, 8 test files; `agent_conversations` **0** | KEEP (deliberate hold) |
| **Vendor portal** | routes + RLS; `vendor_jobs` **0** | ARCHIVE |
| **Program/work** | 4 routes; `program_applications` **0** | ARCHIVE |
| **Marketplace/deals** | `deals` **0**, `parties` **0** | ARCHIVE |
| **Dispute engine** | **schema absent from production**, UI exists | HOLD — legal gate |
| `lead_pool` | 3 parked migrations; **code still calls it** | **REMOVE the calls** |

## 🟠 Production artifacts that should not be there
- `customer_payments_snapshot_20260706` — ad-hoc snapshot, 31 rows of payment data, RLS with no policy. **ARCHIVE out of `public`.**
- Duplicate migration timestamp `20260827000000` (two files). **RENAME one.**
- `moe_legacy` tenant in `tenant-map.generated.ts:60` + brand assets + `portal_clients`/`partners` tables. **OWNER DECISION** — terminated partnership still present in code.

## 🟠 Repository hygiene
- **404 branches**, 12,788 commits unreachable from `master`. Tag anything of value **before** any `git gc`.
- `apps/` = 498 MB, 31 tracked files. `aria/` = 312 MB, 13 tracked files. **~800 MB of mostly-untracked payload in the repo.**
- `dist/` (23 files) is tracked — build output in version control.

## UNKNOWN — requires the owner
`~/HAILMARY` is a full sibling tree (`src`, `supabase`, `apps`, `packages`, `e2e`, `docs`) whose subdirectories are **permission-locked (0700) and could not be read.** It may be a duplicate app, a fork, or a secured variant. **Not classified.** One `ls` by the owner resolves it.
