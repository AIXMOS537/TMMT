# 07 · DATABASE FORENSICS

**Project** `uapxakmlwnpfsftfeezx` · us-west-2 · PostgreSQL 17.6.1 · created **2026-04-22** · ACTIVE_HEALTHY
**168 tables · 214 applied migrations · RLS enabled on 100% of public tables**

## 1. Reproducibility — 🔴 P0
| | |
|---|---:|
| Migrations applied in production | **214** |
| Migration files in repo | **41** (+3 parked) |
| **Unreproducible** | **~173** |

Already documented in `docs/SCHEMA-DRIFT.md` (which measured 220/39 on 09-01) and re-confirmed here. The remedy already exists in-repo: `scripts/migrations-pull.mjs --dry-run`.

**Additional defect found by this audit:** two migration files share the timestamp `20260827000000` — `acting_org_id_matches_is_org_member.sql` and `org_ghl_connections.sql`. Their apply order is undefined. One touches org-identity semantics, which is the P0-1 blast radius.

## 2. Source-of-truth conflicts — the central database finding

| Concept | Model A (LIVE) | Model B (DEAD) | Verdict |
|---|---|---|---|
| **Vehicle** | `fleet` — 43 rows, written by `adminUpsert("fleet")`, read by `getVehicleStats()` | `vehicles` — 2 rows, **zero code references** | A is truth; **B is dead weight** |
| **Rental** | `active_customers` (35) + `customer_payments` (31) + `rental_ledger` (3) | `bookings` (0) + `payments` (0) | A is truth; **B never wired** |
| **Damage** | `fleet_car_inspections` (18) | `vehicle_damage_reports` (0) | A |
| **Documents** | `document_uploads` / storage | `documents` (0) | A |
| **Tasks** | `exec_va_tasks` (17,806) | `tasks` (0), `clickup_tasks` (0) | A — but see §4 |
| **Contract** | `contracts` (2) | `contract_instances` (0), `lto_agreements` (0) | A |
| **Person** | `people` (1,209) · `ghl_contacts` (1,642) · `incoming_leads` (876) · `active_customers` (35) · `parties` (0) · `portal_clients` (0) | — | 🔴 **6 competing person models** |

**`vehicles`, `bookings` and `payments` are the schema a rental OS *should* have.** They were designed, migrated and RLS'd, then never connected to the UI. Meanwhile the Airtable-shaped legacy tables carry the real data. Any future rental work must consciously choose one — continuing to maintain both is how the Interfaces screens broke.

## 3. Canonical source of truth per entity
| Entity | Truth lives in | Confidence |
|---|---|---|
| Lead | `incoming_leads` (+ GHL upstream, + Airtable for verification) | 🟠 three-way |
| Contact/CRM | **GoHighLevel** (mirrored to `ghl_contacts`) | 🟢 |
| Person | `people` | 🟡 overlaps 5 others |
| Vehicle | `fleet` | 🟢 |
| Rental | `active_customers` | 🟠 free-text money |
| Payment | `customer_payments` | 🔴 unqueryable |
| Organization | `organizations` | 🟠 **id shape unverified — see P0-1** |
| Operator | `operator_profiles` | 🟢 |
| Communication | GHL + `comm_channels` | 🟡 |
| Task | `exec_va_tasks` | 🟠 |
| Audit | `audit_events` (124) | 🟢 |

## 4. Data integrity issues
- 🔴 **Money is not numeric.** `active_customers.payment_amount` is free text on 32 of 35 rows (`"$69.99/daily ($489.93/weekly)"`, `"$165/3 days"`). No revenue total, arrears calculation or automated billing is possible without a human reading each row. *(Previously identified; confirmed.)*
- 🟠 **`exec_va_tasks` = 17,806 rows, +614 in two days.** `generate_va_tasks()` runs daily and nothing consumes the output. Unbounded growth.
- 🟠 **Snapshot table left in production:** `customer_payments_snapshot_20260706` (31 rows, RLS on, **no policy**).
- 🟠 **Frozen timestamps:** 10 operational tables all carry `created_at = 2026-04-22`.
- 🟡 **`appointments` has 1 row** but `ghl_appointments` has 0 — the appointment path is unproven.
- 🟡 91 of 168 tables (54%) hold **zero rows**.

## 5. Security posture — better than expected
| Advisor level | Count |
|---|---:|
| ERROR | **0** |
| WARN | 56 |
| INFO | 4 |

RLS is enabled on **every** public table. The repeated hardening migrations (`revoke_anon_execute_*`, `harden_*`, `lock_*`, `is_staff_fail_closed`, `dnc_readable_so_gate_fails_closed`) show genuine, competent security work — including the excellent insight that a DNC gate with no SELECT policy **fails open** by returning zero rows.

Remaining exposure, all WARN: **50 `SECURITY DEFINER` functions callable over REST** (12 by `anon`, 38 by `authenticated`) — detailed in `12_SECURITY_AUDIT.md`.

**4 tables: RLS enabled, no policy** — `customer_payments_snapshot_20260706`, `outreach_touches`, `signup_invites`, +1. `signup_invites` is intentional (service-role only, documented in its comment). **`outreach_touches` is not** — it fails closed, which is why the outreach engine has 0 touches.

## 6. Extensions & config
- `pg_net` and `vector` installed in `public` (should be a dedicated schema).
- Supabase Auth **leaked-password protection is disabled** — one-click fix in the dashboard.
- 3 functions with mutable `search_path`: `claim_agent_job`, `finish_agent_job`, `fail_agent_job`.
