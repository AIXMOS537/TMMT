# 03 — Customer journey

Source: SPEC §7 (+ E3 §2–§4, E4 §3) · Snapshot 2026-09-21 · canon `4cca6835`

> **CURRENT** = "Stage traceability", "Transition status today" and "Hazards" (master + prod). **TARGET** = the stage list, the TARGET MILESTONE column and "What each transition needs" (PM-05…PM-13, PM-16, GHL M7–M11, credit S4/S5). J5–J8 do not exist in any form on master.

## Stages (target)

DISCOVER → INQUIRE → SCREEN → APPROVED → VEHICLE SELECTED → QUOTE / HOLD → AGREEMENT READY → SIGNED → DEPOSIT PAID → READY FOR HANDOFF → ACTIVE RENTAL (↔ EXTEND / MAINTENANCE / INCIDENT) → RETURN INITIATED → RETURNED + INSPECTED → CLOSED (deposit settled, vehicle reconditioned) → FINANCIAL READINESS (credit / drive-to-own).

## Stage traceability (mirrors SPEC §7.0; the SPEC is authoritative)

**No stage is complete because one route, one table or one trigger exists.** Labels: CURRENT = works on master + prod · PARTIAL = real code, incomplete path · BROKEN = fails or unreachable · DESIGN ONLY = direction only, no code.

| Stage | CURRENT IMPLEMENTATION | SYSTEM OF RECORD (today → intended) | SCREEN / API | AUTOMATION | GAPS | TARGET MILESTONE |
|---|---|---|---|---|---|---|
| Lead | PARTIAL: 2 of 27 surfaces carry traffic | `incoming_leads` | `/forms/*`, `/lp/*`, `/leads` | 8 triggers; off-repo poller | 8 unsafe writers; laptop feed; ghost audit table | GHL M1, M7–M11; PM-17 |
| Application | PARTIAL: bg-check form + licence token; no customer view | `background_checks` + Airtable PII → Storage | `/background-checks` | none | documents in Airtable ⚖️ | PM-19, PM-16a, PM-07 |
| Identity / eligibility | PARTIAL: decision RPC; identity by email text across 9+ tables | `background_checks` → person spine (MISSING) | `/background-checks` | prequal lane | no spine; no qualification record | GHL M5; PM-02 |
| Vehicle selection | PARTIAL: staff only; 0 active vehicles | `vehicles` vs `fleet` → one (OWNER DECISION) | `/bookings` | none | two tables; 21 'Rented' | PM-02 ADR-001; PM-05 |
| Availability | PARTIAL: `checkAvailability` + live EXCLUDE | `bookings` + derived vehicle state (DESIGN ONLY) | `/api/rental/quote` | EXCLUDE | free-text status; no hold expiry | PM-05 RENT-004/005 |
| Reservation | BROKEN/DESIGN ONLY: only `hold` written; GHL is the only setter of `booked` | `bookings.status` → transition function | `placeHold` | none | no state machine, no event log | PM-05 RENT-001/002/003 |
| Approval | PARTIAL: = bg-check decision; `lead_to_active_customer_trg` (enabled on prod) fabricates "Active" | `background_checks` → qualification record | `/background-checks` | the trigger | trigger is not a lifecycle | PM-00 00-g; PM-05 |
| Agreement | DESIGN ONLY: no template/renderer | `contract_instances` + `documents` (0 rows) | `/interfaces/contracts` | none | J5 MISSING | PM-07 |
| Documents / signatures | DESIGN ONLY: typed-name "signature" only; real signatures in Airtable | Airtable → Storage + `documents` | `/forms/handover` | none | no e-sign; cross-org signed URLs | PM-07; PM-02 DATA-005 |
| Deposit / payment | DESIGN ONLY for proof: manual kanban; Stripe writes no money; GHL path = CODE CAPABILITY, never fired | `customer_payments` → processor truth (OWNER DECISION) | `/interfaces/payments`; Stripe receiver | date-only overdue sweep | no verified proof; deposits never collected | PM-00 SEC-002; PM-06 |
| Vehicle assignment | PARTIAL: `vehicle_id` at hold | `bookings` | `/bookings` | none | not tied to handoff gate | PM-05, PM-08 |
| Handoff | BROKEN: anon `WITH CHECK (true)` insert; verification flags never set | `vehicle_handover` → `bookings` transition | `/forms/handover` | none | no four-precondition gate | PM-08 HAND-001 (+ GHL M1) |
| Inspection / photos / mileage | LEGACY/PARTIAL: Airtable inspections; media tables ~0 rows; PR #251 open | `fleet_car_inspections` → `vehicle_events` + `vehicle_media` | `/inspections` | none | no writer tied to a rental | PM-08, PM-13 |
| Active rental | BROKEN: four disagreeing sources + date RPC | `active_customers` → `bookings` + events | `/customers`, `/bookings` | trigger; nightly recompute ×2 | no single source | PM-05 RENT-007; PM-09 |
| Maintenance | LEGACY: 4 rows, text links | `maintenance_appointments` | `/maintenance`, `/cases`, vendors | duplicate `cases` trigger | does not block availability; two vendor tables | PM-10 |
| Extension | DESIGN ONLY: GHL-only `extended` | none → segment | none | none | J8 MISSING | PM-11 |
| Recurring payment | PLACEHOLDER: text frequency; notices queued, never drained | `customer_payments` → ledger | `/interfaces/payments` | 13:05 sweep → outbox | queued ≠ delivered | PM-06; PM-18 COMM-004 |
| Communications | BROKEN for customers: nothing ever delivered by TMMT code; 35 queued / 0 sent | `automation_outbox` + DNC → gateway (GHL M8 design) | `/command/outbox` (orphaned) | enqueue only | no drainer; DNC bypass; DND unread | PM-00 SEC-003; PM-18 |
| Tolls / violations | DESIGN ONLY: free text | none → `vehicle_violations` | none | none | MISSING | PM-12 |
| Return | PARTIAL, unlinked: handover 'Return'; lead text | text → transition + `return_inspection` | `/forms/handover` | none | no writer | PM-13 |
| Damage | DESIGN ONLY: typed table, no writer | `vehicle_damage_reports` | none | none | no flow | PM-12 |
| Closeout | DESIGN ONLY: no deposit return/reconditioning/CLOSED | `rental_ledger` | none | none | MISSING | PM-13; PM-06 |
| Financing readiness | PARTIAL: education panel on a walled page; credit engine owner-only | credit tables → credit S-series | `/status/[token]`, credit desk | none | no customer face; ⚖️ never price a rental with it | PM-19; PM-16a; Credit C1 → S4/S5 |

## Transition status today

| # | Transition | Status | Key fact |
|---|---|---|---|
| J1 | DISCOVER → INQUIRE | EXISTING/PARTIAL | 2 of 27 intake surfaces carry traffic (off-repo GHL poller → `promote_ghl_contact`; `web-lead-intake` `forms/actions.ts:103`); 8 unsafe public writers |
| J2 | INQUIRE → SCREEN | EXISTING/PARTIAL | background-check queue works (`bg_check_queue`); licence upload via single-use token; no customer upload path beyond that |
| J3 | SCREEN → APPROVED / DECLINED | EXISTING/PARTIAL | decision RPC (7-arg per memory, not re-verified); declined → AIXMOS prequal lane (rules, consent before handoff); denial-reason routing (D4) not wired |
| J4 | APPROVED → VEHICLE SELECTED → HOLD | EXISTING/PARTIAL | staff-only `placeHold`; `createBooking` writes `hold` only; 0 bookings; 0 active vehicles |
| J5 | HOLD → AGREEMENT READY → SIGNED | **MISSING** | no e-sign; `contract_instances` 0 rows, no writer |
| J6 | SIGNED → DEPOSIT PAID | **MISSING** | no processor-verified deposit; money is taken outside TMMT (GHL links, Zelle) |
| J7 | DEPOSIT PAID → READY FOR HANDOFF → ACTIVE | **MISSING** (pieces ORPHANED) | public handover form with a typed-name "signature"; `insurance_verified` / `lot_release_approved` always false |
| J8 | ACTIVE → EXTEND | **MISSING** | GHL-only stage `extended` |
| J9 | ACTIVE → MAINTENANCE / INCIDENT | LEGACY / ORPHANED | free-text `fleet.vehicle_status`; `vehicle_damage_reports` 0 rows; no tolls entity |
| J10 | ACTIVE → RETURN → INSPECTED → CLOSED | EXISTING/PARTIAL, unlinked | handover 'Return'; `vehicle_events.return_inspection` 0; no deposit return; no reconditioning |
| J11 | Any → FINANCIAL READINESS | EXISTING/PARTIAL | `FinancingReadinessPanel` on `/status/[token]` (education only), but customers cannot open that page (R3) |

## What each transition needs (direction, not schema)

| Transition | Target | Milestone |
|---|---|---|
| J1 | one intake contract + router; E.164 normalisation; every failure visible; an `audit_events` row per intake | **GHL track M7–M11** (do not duplicate) |
| J2 | upload into the Customer Portal; documents in Supabase Storage; ⚖️ FCRA review before migrating Airtable PII | PM-16, PM-07 |
| J3 | qualification decision record; reason required; reviewer ≠ applicant; ⚖️ adverse-action notice if credit/background data used | PM-02 / later |
| J4 | customer picks a vehicle in the portal; hold expiry; transition event | PM-05, PM-16 |
| J5 | template → rendered doc with hash → authenticated signature → countersign → versioned storage | PM-07 (provider = OWNER DECISION ⚖️) |
| J6 | processor-verified webhook writes the ledger; amount = quoted deposit; unique processor event id | PM-06 (processor = OWNER DECISION) |
| J7 | state function requires signed + deposit + insurance + lot release; staff-authenticated handover with photos | PM-08 |
| J8 | extension = new priced booking segment on the same rental; no interest or fee-as-revenue | PM-11 |
| J9 | incident + damage + toll records against booking and vehicle; merciful recovery ⚖️ | PM-10, PM-12 |
| J10 | return event → inspection → deposit settlement (`rental_ledger` `deposit_return` / `deduction`) → reconditioning → AVAILABLE | PM-13 |
| J11 | Customer Portal credit page after credit S4/S5; ⚖️ using readiness to decline or price a rental = FCRA adverse action | PM-16 + credit track |

## Hazards on this journey (fix before building on it)

- `lead_to_active_customer_trg` **exists and is enabled in production**: when lead `status` becomes `'Contracting'` it inserts an `active_customers` row with `status='Active'`, with no booking, vehicle, contract or payment (KD-07). It is not a rental lifecycle. PM-00 00-g.
- GHL stage auto-verifies rental/case state (V1, KD-06; default on via `GHL_AUTO_OPS !== "false"`). PM-00 env kill switch (and the V4 payload-precedence fix, TMMT-SEC-007).
- GHL tag/event **can** create "Paid" payment rows plus commission/tokens (V2/V2b, KD-05) — CODE CAPABILITY on master; PRODUCTION OBSERVATION: never fired (0 `[GHL]` rows). PM-00.
- `vehicle_handover` anon INSERT `WITH CHECK (true)` (KD-31). PM-08, coordinated with GHL M1.
- `sweep_overdue_payments` marks Overdue by date only (KD-20; 25/31 rows). PM-06.

All these paths are **latent** (none has fired on prod: `ghl_webhook_events` = 0, `[GHL]` payment rows = 0). That is why they are cheap to contain now.
