# Evidence — Phase 1 (Parity Verification)

Run date: 2026-09-15 · Airtable base `appcenWUju039rD7b` · Supabase `uapxakmlwnpfsftfeezx`
Method: read-only. Airtable counts read from `metadata.totalRecordCount` on a filtered list
call (`pageSize: 1`, one non-PII field requested). Supabase counts read with exact
`count(*)` via `query_to_xml`, not `reltuples` estimates.

**All 31 Airtable tables counted. No entity remains UNKNOWN.**

---

## 1. Full reconciliation

### Mapped entities

| Airtable table | AT rows | Supabase table | SB rows | State |
|---|---:|---|---:|---|
| Fleet | 43 | `fleet` | 43 | **MATCH** |
| Customer Payments | 31 | `customer_payments` | 31 | **MATCH** |
| Operation Costs | 5 | `operation_costs` | 5 | **MATCH** |
| Tickets | 308 | `tickets` | 308 | **MATCH** |
| Waitlist | 104 | `waitlist` | 104 | **MATCH** |
| Insurance | 24 | `insurance` | 24 | **MATCH** |
| Do Not Rent List | 12 | `do_not_rent_list` | 12 | **MATCH** |
| Fleet Car Inspections | 18 | `fleet_car_inspections` | 18 | **MATCH** |
| Appointments | 1 | `appointments` | 1 | **MATCH** |
| Vehicle Handover | 1 | `vehicle_handover` | 1 | **MATCH** |
| Customer Inspection Photos | 1 | `customer_inspection_photos` | 1 | **MATCH** |
| Vehicle Onboarding Inspections | 0 | `vehicle_onboarding_inspections` | 0 | **MATCH** (both empty) |
| Incoming Leads | 871 | `incoming_leads` | 885 | **SB RICHER** +14 (GHL-fed) |
| Contracts | 1 | `contracts` | 2 | **CONFLICT** — SB richer, see §2.2 |
| Background Checks | 304 | `background_checks` | 299 | **GAP −5** — see §2.3 |
| Active Customers | 40 | `active_customers` | 35 | **GAP −5** — see §2.1 |
| Employee Access Rights | 16 | `employee_access_rights` | 1 | **GAP −15** — see §2.4 |
| Expenses | 35 | `expenses` | 34 | **GAP −1** |
| Maintenance Appointments | 5 | `maintenance_appointments` | 4 | **GAP −1** |
| Former Customers | 2 | `former_customers` | 1 | **GAP −1** |

### Unmapped Airtable tables

No Supabase destination identified. Each needs a disposition (migrate / retire / out of scope)
before Gate 4.

| Airtable table | AT rows | Note |
|---|---:|---|
| Shops / Mechanics / Cleaning | 9 | Vendor roster. `vendors` holds 1 row — not the same data. |
| Money Command — Bills & Subscriptions | 8 | See Phase 0 §2.3 — may already hold the missing cost figures |
| 🔄 Change & Update Log | 2 | Operational change-capture form |
| Client Accounts | 1 | Agency-side, cross-vertical |
| Content Pipeline | 0 | Empty |
| TMMT Operator Signups | 0 | Empty — $97/mo operator funnel |
| Partner Acquisition | 0 | Empty — supply-side pipeline, but see §3.2 (rich encoded logic) |
| OO – Workstreams | 10 | "Operation Overdrive" — separate venture |
| OO – Drivers | 8 | Separate venture |
| OO – Vehicle Build | 4 | Separate venture |
| OO – Grant Budget | 10 | Separate venture |

**Total Airtable records across all 31 tables: 1,874** (VERIFIED, summed from per-table counts).

---

## 2. Discrepancies

### 2.1 Active Customers — GAP −5 (40 → 35) · OPEN, needs owner

Confirms the plan's figure exactly. Identifying the five rows requires reading customer names
from both systems and diffing them — that means pulling PII into a session log, which the
working agreement discourages where it can be avoided.

**Recommended resolution,** which avoids exporting names anywhere: run
`scripts/parity-check.ts --table active_customers --explain-gap`. It diffs on `airtable_id`
(present on the Supabase row) and prints only the **Airtable record IDs** that have no
Supabase counterpart. The owner opens those five records directly in Airtable.

The question to answer per row is binary and the plan accepts either answer: *failed to
migrate*, or *deliberately excluded*. An unanswered question is what is not acceptable.

### 2.2 Contracts — CONFLICT, and the plan's premise is inverted · RESOLVED

The plan reasons: *"The business signed far more than two rental agreements. Either contracts
live elsewhere, or the migration dropped them."*

VERIFIED: **Airtable `Contracts` holds 1 record. Supabase holds 2.** Supabase is the richer
side. The migration did not drop contracts — **Airtable never held them.**

Corroborating, and stronger: the `Contracts` table's two attachment fields —
`Signatures (Customer/Staff)` (`fldH3FQaL7RYD7TgD`) and `Addendums` (`fldMRQ9gjMVR0Iy4B`) —
hold **zero** records with files (VERIFIED by filtered count). There are no signed agreements
in Airtable at all.

So the plan's §4.1 row for Contracts — "Signatures, addendums", not counted — resolves to
**nothing to extract**.

**The real question this raises is bigger than parity, and it belongs to the owner:** a year of
rental operations produced signed agreements that are not in Airtable and not in Supabase.
They are in a third location — e-sign provider, email, GHL, or paper. **That location is
currently undocumented, is not in the archive plan, and is not covered by Gate 2.**

> **ESCALATED — owner decision required.** Where are the executed rental agreements? Until
> that is answered, "every row reconciled or its absence explained" (§11) cannot be signed off,
> and the offline archive in Gate 0 is incomplete by construction.

### 2.3 Background Checks — GAP −5 (304 → 299) · NEW, not in the plan

The plan listed Airtable-side Background Checks as UNKNOWN. Counted: **304** against Supabase's
299. Five records did not migrate.

**This is the most consequential gap in the reconciliation**, because this is the table that
holds driver's licences, paystubs and proof of insurance (§4.1). Five un-migrated rows here are
five people whose identity documents exist in exactly one place.

Resolve by the same `airtable_id` diff as §2.1, and resolve it **before** extraction runs, so
the extractor's expected count is 304 and not 299.

### 2.4 Employee Access Rights — GAP −15 (16 → 1) · NEW, not in the plan

Airtable holds 16 rows; Supabase holds 1. This table records who was granted access to which
tool, at what level, and when it was revoked (`Date Revoked`, `Active Access`).

Flagged because it is an **access-control record, not operational data**. If any of those 16
rows describes still-live access to a third-party tool, that is a security item, not a
migration item. It is also directly relevant to the operator-network conduct covenant.

Not in scope to fix here. Named so it is not lost.

### 2.5 Smaller gaps — Expenses −1, Maintenance Appointments −1, Former Customers −1

Single-row gaps. Same `airtable_id` diff resolves each. Low individual risk; listed for
completeness because "no entity remains UNKNOWN" means all of them, not the interesting ones.

### 2.6 Incoming Leads — SB richer by 14 · EXPLAINED, no action

871 Airtable / 885 Supabase. Consistent with the plan's note that `incoming_leads` is GHL-fed:
leads have continued to arrive into Supabase via GoHighLevel after the Airtable copy. This is
the expected direction. It is *also* direct evidence for Phase 4 — two systems are still both
receiving lead data.

---

## 3. Findings that change later phases

### 3.1 The "record cap" premise does not survive counting · CONFLICT

The plan opens (§0): *"It is at its record cap, it cannot accept a new row."*

VERIFIED: the base holds **1,874 records across 31 tables**. Airtable's per-base record limits
are 1,000 (Free), 50,000 (Team) and 125,000 (Business). 1,874 is comfortably inside every paid
tier and over only the Free tier.

Tagged **CONFLICT**, not "plan is wrong" — the plan tier cannot be read through the API from
here, and the cap could refer to a different limit the owner hit (attachment storage, automation
runs, or a per-table view limit). Attachment storage is the most likely candidate given 706
attachment-bearing records.

**Why it matters:** "cannot accept a new row" is currently load-bearing for the urgency of the
whole program. If the real constraint is attachment *storage* rather than records, the
sequencing is unchanged (Phase 2 still blocks) but the deadline pressure is different.
**Owner: confirm the Airtable plan tier and the exact limit being hit.**

### 3.2 Partner Acquisition is empty but carries the richest encoded logic in the base

`Partner Acquisition` (`tblDL6VOeRmjddRNX`) holds **0 records** — yet it carries five formula
fields and the most explicit business-rule field descriptions anywhere in the base, including a
`⚠️ Gate Check` formula ("Hard stops before a car can go live. Must read CLEAR"), a
`Commercial Use Cleared` field documented as a CRITICAL GATE, and a `Deal Tier` field stating
*"The split is earned, not asked for."*

A row-count migration moves none of this, and a zero-row table looks like nothing worth
migrating. **This is precisely the Phase 3 asset** — see `docs/business-rules/`.

---

## 4. Gate 1 checklist

- [x] Every Airtable table counted; no entity remains UNKNOWN — **31/31 counted**
- [~] Active Customers 5-row gap explained in writing — *mechanism delivered
      (`--explain-gap`), five records need owner eyes; PII deliberately not exported*
- [x] Contracts count explained in writing — **resolved, and inverted the plan's premise;
      escalated the real question (§2.2)**
- [ ] Field-level sample diff run, discrepancies listed — **NOT RUN**

### On the field-level sample diff (§3.3)

Not run, and not skipped quietly. It requires reading five full records per table from both
systems — including customer names, phone numbers, emails and licence data. That is a bulk PII
read into an ephemeral container's session log, to answer a question the owner may already know
the answer to.

`scripts/parity-check.ts --sample 5 --fields` implements it, including the four traps the plan
names (linked-record FKs, single-select→null, stale formula/rollup values, and
`Partner Percentage` decimal-vs-integer precision). It is ready to run under the owner's
per-package authorization, ideally on a machine where the output stays local.

**One trap can be confirmed without reading any values, and it is confirmed:** stale copied
formula output. `insurance.proof_of_insurance_attachment` holds Airtable attachment JSON with
expired signed URLs (Phase 0 report). That is the "copied as stale values" failure the plan
warns about, present in production now.
