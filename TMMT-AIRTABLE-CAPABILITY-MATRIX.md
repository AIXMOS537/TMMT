# TMMT ↔ Airtable Capability Matrix

**First deliverable of the native-replacement program.** Establishes the capability map before
any implementation sprint.

Evidence basis: live read-only inspection of Airtable base `appcenWUju039rD7b`, Supabase
project `uapxakmlwnpfsftfeezx`, and this repository, on **2026-09-15/16**. Every count below
was read, not recalled.

> **This document answers one question:** *what does Airtable actually do for TMMT today, and
> have we rebuilt it yet?*
>
> It is deliberately **not** a list of Airtable's product features. The target is
> **capability parity where TMMT needs it**, built so that broader Airtable replacement stays
> reachable. Capabilities not currently required are **deferred, not excluded** (§7).

---

## 1. Two workstreams — do not conflate them

| | Workstream A — Airtable Exit | Workstream B — TMMT Native Capability |
|---|---|---|
| Goal | Safely account for data, attachments, credentials, automations, rules, provenance | Build the capabilities that make Airtable unnecessary |
| Status | Gates 0–4, none passed; see `evidence/README.md` | This document |
| Blocked by | Owner + counsel decisions | Nothing — but must not force an unsafe migration |

**A migration blocker does not stop product development. A product feature does not authorize
an unsafe migration.** Where B needs a schema change that A also needs, A's change request
governs (see `CHANGE_REQUEST_001.md`).

---

## 2. What Airtable is actually used for — VERIFIED

| Dimension | Measured |
|---|---|
| Tables | **31** |
| Records | **1,874** total |
| Distinct field types in use | **23** |
| Attachment-bearing records | **706** (file count UNKNOWN — see §8) |
| Interfaces | **8**, containing **16 pages** |
| Forms | **11** (6 standalone, 3 embedded, 2 in-interface) |
| Views | Sparse — Fleet, the most-used table, has only **2 grid views** |
| Automations | **51 total, 8 deployed** |
| Dashboard element types | `bigNumber`, `chart` (donut/bar/pie/line), `list`, `pivotTable` |
| Aggregations in use | `rowCount`, `sum`, `count`, `average`, `countUnique`, `percentFilled` |
| **Automations containing `customScript`** | **8, holding 15 script bodies** (1 automation deployed) — bodies not API-readable, see §7.2 |
| Automations containing `aiGenerate` | 2 (both undeployed) — prompts **are** API-readable and are preserved |

**The shape of the dependency:** Airtable is used overwhelmingly as **forms-in, dashboards-out**,
over a relational core with heavy linked records. It is *not* used as a spreadsheet — view usage
is minimal. That materially narrows what has to be rebuilt.

### Field types actually in use

`singleLineText` · `multilineText` · `phoneNumber` · `email` · `url` · `number` · `currency` ·
`percent` · `date` · `dateTime` · `checkbox` · `singleSelect` · `multipleSelects` ·
`multipleAttachments` · `multipleRecordLinks` · `multipleLookupValues` · `rollup` · `formula` ·
`autoNumber` · `barcode` · `createdBy` · `lastModifiedTime` · `aiText`

---

## 3. What TMMT already has — VERIFIED

Inspect before building (Prime Directive 6).

| Asset | Measured |
|---|---|
| App pages | **117** (`page.tsx`) |
| API routes | **28** |
| Form pages | **19** under `/forms` |
| Route groups | admin (28), command (15), pocket (7), operator (4), program (4), executive/partner/vendor/investor (1 each) |
| Supabase tables | **168** |
| RLS enabled | **168 / 168** |
| RLS **with** policies | **161** |
| RLS on, **zero policies** | **7** — see §9.2 |
| Existing view components | `ViewSwitcher.tsx`, `KanbanBoard.tsx`, `CalendarView.tsx` |
| Audit trail | `audit_events` (3,894 rows; `ts`/`action`/`payload`/`organization_id`/`hardware_uuid`/`ip`) |
| Queue / automation scaffolding | `automation_outbox` (28), `agent_jobs`, `exec_va_tasks` (19,097), `rate_limit_buckets` (11) |
| Tenancy | `organizations` (9), `org_roles` (1), `organization_licenses` (4), `installations` (2) |
| Form capture | `form_submissions` (3), `customer_intake_forms` (5) |

**Correction to a prior repo document.** `SYSTEM_AUDIT_2026/06_AIRTABLE_PARITY.md` states that
3 of 4 Interfaces screens are "🔴 Broken for months — read a `status` column that does not
exist." **That is now stale.** Verified 2026-09-16: all four screens
(`interfaces/{payments,contracts,appointments,vehicles}`) read the correct columns —
`payment_status`, `contract_status`, `appointment_status`, `vehicle_status`. The bug was fixed.
Do not re-raise it.

---

## 4. The capability matrix

**Used?** = is TMMT actually relying on it (evidence-based, not theoretical).
**TMMT?** = ✅ exists · 🟡 partial · ❌ absent.
**Owner?** = requires a business decision before it can be built correctly.

### 4.1 Data model

| Capability | Used? | TMMT? | Gap | Priority | Owner? | Acceptance test |
|---|---|---|---|---|---|---|
| Tables / records | Yes — 31 / 1,874 | ✅ 168 tables | — | — | — | Parity report |
| Field types | Yes — 23 types | 🟡 | Typed columns exist; no *declarative field registry* | P2 | — | Each of the 23 types round-trips |
| Primary/display field | Yes | 🟡 | No convention for record display name | P3 | — | Every entity renders a label |
| Validation / required / defaults | Partial | 🟡 | Enforced ad-hoc in forms, not in schema | **P1** | — | Invalid write rejected at DB, not just UI |
| Unique constraints | Weak in Airtable | 🟡 | Airtable cannot enforce; Postgres can | P2 | — | Duplicate insert rejected |
| Linked records | **Heavy** | 🟡 | FKs exist on some tables; several lack them | **P1** | — | FK integrity test per relationship |
| Reciprocal relationships | Yes | ❌ | No reverse-relation convention | P2 | — | Reverse panel renders |
| Lookups | Yes (`multipleLookupValues`) | 🟡 | Hand-written joins in `queries.ts` | P2 | — | Lookup matches source |
| Rollups / counts | Yes (Tickets balance) | 🟡 | `getVehicleStats` only; no general rollup | **P1** | — | Rollup recomputes, never stale |
| Formula fields | **Yes — business-critical** | 🟡 **engine landed** `src/lib/rules/` | Partner economics ported + tested; 5 of 7 rule domains blocked on owner policy. See §5 | **P0** | **Yes** | Each documented rule reproduced |
| Attachments | Yes — 706 records | ❌ | `documents`/`vehicle_media` = **0 rows**, no provenance columns | **P0** | **Yes** | CR-001 + Gate 2 |
| `aiText` fields | Yes — 4 tables | 🟡 | AI summary fields; FCRA-sensitive on Background Checks | P3 | **Yes** | Counsel review before reuse |

### 4.2 Views

Airtable view usage is **sparse** (Fleet = 2 grid views). Do not build a full view engine first.

| Capability | Used? | TMMT? | Gap | Priority | Owner? |
|---|---|---|---|---|---|
| Grid / table view | Yes | ✅ `ViewSwitcher` | — | — | — |
| Kanban / calendar | Minor | ✅ `KanbanBoard`, `CalendarView` | — | — | — |
| Filter / sort / group | Yes | 🟡 client-side `FilterBar`, not persisted | P2 | — |
| **Saved view configurations** | Light | ❌ | No `saved_views` table | P3 | — |
| Personal vs shared views | No evidence | ❌ | **Deferred** — see §7.3 | P4 | — |
| Field ordering / hidden fields / widths | Light | ❌ | Presentation metadata | P4 | — |
| Pagination / bulk actions | Yes | 🟡 | See §4.8 | P2 | — |

> **A view is a query over authoritative records. It must never duplicate data.**

### 4.3 Interfaces / application screens

The single most-used Airtable capability. **8 interfaces / 16 pages**, dominated by dashboards.

| Airtable interface | Page type | TMMT equivalent | Gap |
|---|---|---|---|
| TMMT → Business Overview Dashboard (18 elements) | dashboard | 🟡 `(command)` 15 pages | Element-level parity unproven |
| TMMT → Vehicle Recovery Dashboard | dashboard | ❌ | Recovery/repossession view absent |
| Payment Management → Payment Tracking | dashboard | 🟡 `interfaces/payments` | Outstanding-balance rollup |
| Payment Management → Payment Calendar | list | ✅ `CalendarView` | — |
| Waitlist Management | dashboard + **pivotTable** | 🟡 `/waitlist` | **No pivot capability** |
| Appointment Management (6 elements + pivot) | dashboard | 🟡 `interfaces/appointments` | Conversion funnel, pivot |
| Contract Management → Closer Dashboard | dashboard | 🟡 `interfaces/contracts` | — |
| Vehicle Management → Onboarding Dashboard | dashboard | ❌ | Readiness gates absent |
| Vehicle/Available Vehicles Gallery | list | 🟡 | Gallery layout |
| Fleet Car Inspections Entry · All Monthly Expenses · Initial Vehicle Entry | list | 🟡 | — |

**Required primitives, ranked by observed usage:** `bigNumber` (rowCount + column summary) →
`chart` (donut/bar/pie/line with date bucketing) → `list` → `pivotTable`.

`pivotTable` appears twice and has **no TMMT equivalent** — the largest single interface gap.

### 4.4 Forms — 11 in use

| Form | Source table | TMMT equivalent |
|---|---|---|
| New Lead Intake | Incoming Leads | ✅ `/forms/lead-intake` |
| Ticket Submission + Tickets/Tolls/Violations | Tickets | ✅ `/forms/ticket` |
| Customer Inspection Form (×2) | Customer Inspection Photos | ✅ `/forms/inspection` |
| Customer Payment Form | Customer Payments | ❌ **absent** |
| New Vehicle Intake / Inspection | Fleet | 🟡 `/forms/onboarding-inspection` |
| Car Inspection Form | Fleet Car Inspections | 🟡 |
| Expense Form | Expenses | ❌ **absent** |
| Log a Change or Update | 🔄 Change & Update Log | ❌ **absent** |

**19 TMMT form pages already exist** — the gap is narrow and specific: payments, expenses,
change-log. All must write to Supabase, never Airtable.

### 4.5 Automations — 51 defined, 8 deployed

| Capability | Used? | TMMT? | Gap | Priority |
|---|---|---|---|---|
| record-created / updated / field-change triggers | Yes | ❌ | No native trigger engine | **P1** |
| condition-based triggers | Yes | ❌ | — | **P1** |
| scheduled / cron triggers | Yes (3 cron) | 🟡 agent_jobs | — | P2 |
| webhook triggers | Yes (3 deployed) | ✅ API routes | — | — |
| form-submission triggers | Yes | 🟡 | — | P2 |
| email action | **Yes — customer-facing** | 🟡 `sendSms` gate exists | **Must fail closed on DNC** | **P0** |
| record create/update actions | Yes | 🟡 | — | P1 |
| branching / delays / retries | Yes | 🟡 `automation_outbox` | — | P2 |
| **custom script actions** | **Yes — 8 automations / 15 bodies, one automation deployed** | ❌ | **Logic opaque; exit-preservation gate — `evidence/automation-logic-capture.md`** | **P1** |
| AI generation actions | Yes — 2 (undeployed) | 🟡 brain-router | — | P3 |
| **execution history** | Airtable-internal | 🟡 `audit_events` | **No per-automation run log** | **P1** |
| enable/disable + dry-run + test mode | Airtable UI | ❌ | **Safety-critical** — §9.1 | **P0** |

> **43 undeployed automations encode the collections ladder** that was built and never switched
> on. Read them before rebuilding Phase 6 — they are the intended design.

### 4.6 Attachments / documents

| Capability | TMMT? | Gap |
|---|---|---|
| Upload / download / preview | 🟡 buckets exist (3, all private) | The 6 buckets Gate 2 needs do not exist |
| Metadata: type, size, filename | ❌ | No columns |
| **Provenance: source table/record/field, sha256** | ❌ | **CR-001 — blocks Gate 2** |
| Record association | 🟡 | `documents.case_id` is a `cases` FK; cannot express real parents |
| Access control / retention state / disposition | ❌ | Retention rule pending counsel |

> **Never treat a populated JSON attachment column as proof a file exists.**
> `public.insurance.proof_of_insurance_attachment` (6 rows) and
> `commercial_insurance_policy_number` (7 rows) hold Airtable-shaped JSON with **expired signed
> URLs** copied at the 2026-04-22 migration. A populated column here means **missing file**, not
> migrated file. A native attachment system must distinguish *reference* from *preserved file*.

### 4.7 Permissions, tenancy, audit

| Capability | TMMT? | Evidence |
|---|---|---|
| Organizations / tenancy | ✅ | `organizations` 9, `ventures` 1 |
| Roles | 🟡 | `org_roles` = **1 row** — effectively unused |
| Row-level access | ✅ enabled everywhere | 168/168 RLS |
| **RLS correctness** | 🟡 | **161 with policies, 7 without** — §9.2 |
| Field-level restrictions | ❌ | Not modelled |
| Audit history | 🟡 | `audit_events` records `action`+`payload`, **not before/after values** |
| Per-record change history | ❌ | Airtable has it natively; TMMT does not |

**Audit gap is the notable one.** For customer records, financial records, partner economics,
access rights and identity documents, "what changed from what to what" is not currently
recoverable.

### 4.8 Import/export, search, bulk, API, mobile

| Capability | Used? | TMMT? | Priority |
|---|---|---|---|
| CSV import/export | Yes (provisioning path) | 🟡 | P2 |
| Bulk edit / archive / restore | Yes | ❌ | P2 |
| Global search | Airtable native | ❌ per-page filter only | P2 |
| REST API over records | Yes — how integrations reach it | 🟡 28 routes | P2 |
| Webhooks in/out | Yes | ✅ | — |
| Mobile / tablet | Yes — operators used the Airtable app | 🟡 responsive + PWA | **P1** |

---

## 5. The formula/rules engine — P0

Formula fields are where the business logic lives, which is why
`docs/business-rules/01–07` are **requirements**, not documentation.

Operators observed in live formulas: arithmetic (`*`, `-`), comparison (`=`, `!=`), boolean
(`AND`, `OR`, `NOT`), `IF`, `CONCATENATE`, null-handling (`IF({x}, …, 0)`), and a
weeks-per-month constant (`4.33`).

Worked example — the Partner Acquisition onboarding gate, which the native engine must
reproduce exactly:

```
IF(AND({Commercial Use Cleared} = "Yes – Verified",
       {Title in Owner's Name},
       {Finance Status} != "Leased",
       {Finance Status} != "Unknown"),
   "CLEAR",
   CONCATENATE(... "INSURANCE " ... "TITLE " ... "FINANCE " ...))
```

**Where the legacy encoded a rule, preserve the documented behavior.** Where it never encoded
one, the rule documents already mark `BUSINESS POLICY REQUIRED` — those stay marked until the
owner decides. Do not infer a rule from historical data.

---

## 6. Suggested sequencing

Not a commitment — a proposal for the owner to correct.

**Tier 0 — unblocks everything else**
1. Attachment provenance + storage (CR-001) — also unblocks Gate 2
2. Rules/formula engine core, driven by `docs/business-rules/` — **STARTED.** `src/lib/rules/`
   ports partner economics + the onboarding gate with 28 tests; reuses the existing
   `bg-check-decisions` contract. Remaining domains need owner policy, not engineering.
3. Automation safety envelope (enabled/disabled, dry-run, execution log, DNC fail-closed)

**Tier 1 — restores daily operations**
4. Dashboard element primitives: `bigNumber`, `chart`, `list`
5. Linked-record integrity + rollups
6. Schema-level validation
7. Mobile operational workflows
8. The 3 missing forms (payments, expenses, change log)

**Tier 2 — parity completion**
9. `pivotTable`; saved views; persisted filters; global search; bulk operations; CSV import/export; per-record change history

**Tier 3 — defer until demanded**
10. Personal vs shared views; field ordering/widths; comments and collaboration

---

## 7. DEFERRED / NOT CURRENTLY REQUIRED

**Classification rule.** *Not currently required by the observed TMMT/Airtable dependency
surface* is **not** the same claim as *permanently excluded*. The product objective is to make
TMMT capable of replacing Airtable **broadly**, while avoiding premature construction of generic
platform infrastructure nothing currently needs.

Everything below is therefore **DEFERRED**. Nothing here is excluded on principle. A capability
would only move to genuinely out-of-scope if evidence showed it **fundamentally incompatible**
with TMMT's architecture — and **no capability currently meets that bar.**

**Do not build these yet.** The build order is §6: rules engine, attachment provenance,
automation safety envelope.

**The obligation this creates:** deferral must not foreclose. Each entry records the
architectural decision needed *now* to keep the door open later — these are cheap today and
expensive to retrofit.

---

### 7.1 Generic user-defined tables / fields

| | |
|---|---|
| **In current dependency surface?** | **No.** All 31 tables are fixed-schema; no runtime field creation observed. |
| **Why not required now** | TMMT's entities are known and stable. Per-tenant schema divergence is not yet a product requirement. |
| **Architectural implications** | An unbounded "everything is JSON" store would contradict §20 and forfeit relational integrity, constraints and typed queries. |
| **Becomes a requirement when** | A tenant needs fields TMMT does not model, or the product sells "configure your own tracker". |
| **Preserve a future path?** | **Yes.** Reserve a **typed custom-field registry** — a `field_definitions` table (entity, key, type, validation, org-scoped) plus a per-entity `custom_values` JSONB column. Core business columns stay real columns; tenant extensions live in the registry. This is additive later **only if** the entity tables are not meanwhile littered with ad-hoc JSON. |

### 7.2 Scripting / extension actions — **CORRECTION: this IS in the dependency surface**

| | |
|---|---|
| **In current dependency surface?** | **YES — and my prior classification was wrong.** VERIFIED: **8 automations contain 15 `customScript` bodies, and one automation is deployed** — `New Lead Notification and Status Update` (`wfl6aEZPBOZkd1KE7`) runs two scripts on every new lead. A second (`wfl1oG2fiJvGVbtrX`) has a script as its **only** node. Two further automations use `aiGenerate`, whose prompts **are** API-readable and are preserved. |
| **Why not required now** | Not deferrable as a *capability*. What is deferrable is a **general user-facing scripting facility**; what is **required** is a replacement for the specific logic these eight scripts encode. |
| **Architectural implications** | **The script bodies are not retrievable through the API** — `get_automation` returns `inputs: {}` for every `customScript` node. They are readable only in the Airtable UI. Airtable's base export does **not** include automation definitions, so the Gate 0 offline archive **does not capture them**. |
| **Becomes a requirement when** | Already is, for the porting work. A general sandboxed scripting facility becomes a requirement if operators need per-tenant custom logic. |
| **Preserve a future path?** | **Yes** — but never as unsandboxed evaluation. Model automation actions as a **typed, registered action catalogue**; a future scripting action becomes one more registered type with an explicit permission and resource budget. |

> **Workstream A consequence — this is an exit-preservation gate, not a documentation task.**
> Fifteen pieces of undocumented logic sit in Airtable, invisible to both the API and the base
> export. They must be captured from the live UI with full execution context before cancellation.
> Register and 14-field capture schema: `evidence/automation-logic-capture.md`.
> **No cancellation gate may pass while unrecoverable automation logic remains uncaptured.**

### 7.3 Personal vs shared views

| | |
|---|---|
| **In current dependency surface?** | **No.** View usage is sparse overall (Fleet = 2 grid views) and no per-user view was observed. |
| **Why not required now** | Operator count is small; shared views have been sufficient. |
| **Architectural implications** | Low. Ownership is one nullable column. |
| **Becomes a requirement when** | Multiple operators per tenant want private working sets, or a saved-view feature ships. |
| **Preserve a future path?** | **Yes, cheaply.** When `saved_views` is built (§4.2, P3), include `owner_user_id NULL = shared` and `org_id` from day one. Retrofitting ownership onto existing shared views is a migration; including the column is free. |

### 7.4 Marketplace / extension ecosystem

| | |
|---|---|
| **In current dependency surface?** | **No** third-party Airtable extensions observed. |
| **Why not required now** | No demand; large surface; each extension is a security and support burden. |
| **Architectural implications** | Requires stable public APIs, auth scopes and versioning before it is even possible. |
| **Becomes a requirement when** | Operators or partners need to add capability without TMMT engineering — plausible for the operator-network tier. |
| **Preserve a future path?** | **Yes, indirectly.** The API work already in §4.8 (P2) with scoped tokens and webhooks *is* the foundation. Build the API as if a third party will consume it. |

### 7.5 Gantt / timeline views

| | |
|---|---|
| **In current dependency surface?** | **No.** Time is presented via `CalendarView` and a line chart with `yearMonth` bucketing. |
| **Why not required now** | No dependency-scheduled work observed. Maintenance and rentals are date-point, not duration-with-dependency. |
| **Architectural implications** | Needs start/end and optionally dependency edges on the underlying entity. |
| **Becomes a requirement when** | Rental terms, maintenance windows or recovery workflows need duration and overlap reasoning — plausible for fleet utilisation. |
| **Preserve a future path?** | **Yes.** Model time-bounded entities with explicit `starts_at`/`ends_at` rather than a single date where a duration genuinely exists. Vehicle status lifecycle (`business-rules/05`) already needs this — it has no transition history, so utilisation is currently underivable. |

### 7.6 Sync from external sources

| | |
|---|---|
| **In current dependency surface?** | **No** Airtable Sync configured. External data arrives by webhook (GHL) instead. |
| **Why not required now** | Webhook + API integration already covers the live path. |
| **Architectural implications** | A sync source is a second writer — exactly the split-brain risk this whole programme exists to remove. |
| **Becomes a requirement when** | A tenant must mirror an external system TMMT does not integrate directly. |
| **Preserve a future path?** | **Yes, with care.** Keep the provenance columns from CR-001 (`source_system`, `source_record_id`) as a **general pattern**, not attachment-only. Any synced row must be traceable and must never silently become authoritative. |

### 7.7 Comments / mentions / activity feeds

| | |
|---|---|
| **In current dependency surface?** | **Not materially.** Airtable record comments exist as a feature; no operational reliance observed. The `🔄 Change & Update Log` table (2 rows) is the closest thing — a *form-driven* change-capture process, not threaded discussion. |
| **Why not required now** | Operations used email and the change-log form. Assignment + audit trail carry most of the value. |
| **Architectural implications** | Low, if record identity is stable and polymorphic references are possible. |
| **Becomes a requirement when** | Multi-operator tenants need per-record discussion, or approval workflows need attached rationale — **likely**, given every customer/money/legal action must terminate at an owner-approval step. |
| **Preserve a future path?** | **Yes.** Give every entity a stable UUID primary key and avoid composite/natural keys, so a polymorphic `comments(entity_type, entity_id)` table can attach later without a data migration. |

### 7.8 Presentation minutiae

Record colouring, column widths, field ordering, real-time multi-cursor editing.

**Deferred.** Not in the dependency surface; each is presentation state on a saved view
(`owner_user_id` + a JSONB `display_config`) except multi-cursor, which needs a realtime
transport. **Preserve the path** by keeping view configuration in a JSONB blob rather than
hard-coded per screen.

---

### Deferral register — summary

| # | Capability | In use today? | Deferred | Path preserved by |
|---|---|---|---|---|
| 7.1 | Generic user-defined tables/fields | No | Yes | Typed field registry; no ad-hoc JSON on core tables |
| 7.2 | **Scripting / extension actions** | **YES (1 deployed)** | **Facility deferred; porting REQUIRED** | Typed action catalogue |
| 7.3 | Personal vs shared views | No | Yes | `owner_user_id` on `saved_views` |
| 7.4 | Marketplace / extensions | No | Yes | Build the API for third parties |
| 7.5 | Gantt / timeline | No | Yes | `starts_at`/`ends_at` + status transition history |
| 7.6 | External sync | No | Yes | General provenance columns |
| 7.7 | Comments / collaboration | Not materially | Yes | Stable UUID PKs for polymorphic attachment |
| 7.8 | Presentation minutiae | No | Yes | View config as JSONB |

**Rationale:** 100% coverage of *required* capability now, with the architecture kept open so
broader Airtable replacement stays reachable — rather than either a disposable clone or a dead
end.

---

## 8. Terminology that must not regress

- **706 = attachment-bearing RECORDS, not files.** File count remains **UNKNOWN** until
  `scripts/extract-attachments.ts --inventory` enumerates the arrays.
- **293 = identity-document records** (283 Background Checks + 10 Do Not Rent List). Not 283.
- **A populated JSON attachment column is evidence of a MISSING file.**
- **Code existing ≠ integration live.** Distinguish:
  `code exists → configured → enabled → capable → actually fired → recently active`.

---

## 9. Findings that affect the build

### 9.1 Automation safety — carried from Workstream A

8 Airtable automations are deployed; **`Notify Customer of Next Payment Due` sends customer
email via Gmail**. It is dormant only because no payment is currently due (latest due date
`2026-04-24`, 0 due today or later) — and its trigger evaluates "today" in **Asia/Karachi**.

**Dormant is not disabled.** This is the design requirement for §4.5's safety envelope: *a
workflow capable of emailing customers must never fire because someone restored an archive or
bulk-edited records.* TMMT's native engine must make that structurally impossible.

### 9.1a Eight automations contain script logic that neither the API nor the export can reach

VERIFIED 2026-09-16. `get_automation` returns `inputs: {}` for every `customScript` node, so
the bodies cannot be read programmatically. Airtable's base export covers **records and
attachments, not automation definitions**.

Consequence: the Gate 0 offline archive, as specified, **does not preserve this logic**.
**8 automations hold 15 script bodies.** One — `New Lead Notification and Status Update` — is
**deployed and runs two scripts on every new lead**. Another — `Update GoHighLevel Pipeline
Stages on Lead Status Change` — has a script as its **only node**, so 100% of its behaviour is
unknown and its name points at a live external integration.

**This is a Workstream A exit-preservation gate, not only a build input.** Whether any script
encodes a business rule belonging in `docs/business-rules/` is **UNKNOWN**, and must not be
inferred from neighbouring nodes. Full register, per-automation 14-field schema, capture
procedure and gate condition: `evidence/automation-logic-capture.md`.

The two `aiGenerate` prompts **were** recoverable via the API and are preserved there. One of
them instructs the model to categorise expenses *"based on predefined rules"* that the prompt
never supplies — so that categorisation was the model's own judgement, and is flagged
**BUSINESS POLICY REQUIRED** rather than an encoded rule.

### 9.2 Seven tables have RLS enabled with ZERO policies — VERIFIED

The exact signature of the two documented incidents (`do_not_contact_numbers` fail-open;
`outreach_touches` fail-closed-and-permanently-empty).

| Table | Rows | Assessment |
|---|---:|---|
| `customer_payments_snapshot_20260706` | 31 | Backup — deny-all is probably **correct** |
| `exec_va_tasks_dnc_remediation_20260906` | 144 | Backup — probably correct |
| `exec_va_tasks_dnc_remediation_20260916` | 71 | Backup — probably correct |
| `rate_limit_buckets` | 11 | Service-role only — probably correct |
| `tmmt_token_ledger` | 4 | Service-role only — probably correct |
| **`ghl_webhook_events`** | **0** | ⚠️ **INFERRED risk** — 0 rows + no policy matches the `outreach_touches` pattern |
| **`signup_invites`** | **0** | ⚠️ **INFERRED risk** — if signup writes here, it may be failing closed |

**Tagged INFERRED, not confirmed.** Emptiness may be correct (feature unused). Verify behaviour,
not the flag — §7.3 of the execution plan. **Do not add policies to "fix" these without
establishing intended behaviour first.**

### 9.3 Concurrent production activity — 2026-09-16

The database is actively being worked by another operator or scheduled process:

- `g01_dnc_normalize_20260916` — **71 `exec_va_tasks` rows remediated at 19:10:39 UTC today**,
  with a rollback table capturing prior state.
- `agent_job.lease_expired` ×2 at 19:35 and 19:40 UTC today.
- `security_remediation_20260914` on 2026-09-14.

**This does not affect any Airtable-exit gate** — credential columns, `documents`/`vehicle_media`
row counts, Incoming Leads (871) and `GHL Contact ID` (0) were all re-verified unchanged.
But **assume concurrent work**: re-check state before any mutation, and never reset, rebase or
force-push over it.

---

## 10. Owner decisions required before building

1. **Confirm or correct the §6 sequencing.**
2. **Approve the §7 deferral register** — confirm each capability is *deferred* rather than
   required now, and approve the cheap "preserve the path" decisions (UUID PKs,
   `owner_user_id` on saved views, `starts_at`/`ends_at`, general provenance columns).
3. **The eligibility truth table** (`business-rules/01`) — three signals → verdict. Never
   encoded; cannot be inferred. Blocks the rules engine.
4. **The 36 NULL partner percentages** (`business-rules/04`) — real split per vehicle, or
   explicitly "no partner". **Do not default NULL.** Blocks partner economics.
5. **Pricing band rule** (`business-rules/03`) — what determines a vehicle's band. Blocks quoting.
6. **Do-not-rent governance** (`business-rules/02`) — who may add, what reverses an entry.
   Currently permanent-by-omission.
7. **Whether `aiText` fields carry forward**, given the FCRA sensitivity on Background Checks.
8. **CR-001 authorization** — provenance schema; gates both Workstream A and B.

Plus the Workstream A decisions already open in `evidence/README.md`.

---

## 11. Success condition

TMMT succeeds when an operator can do the required work without Airtable, retaining the
necessary data, relationships, rules, views, interfaces, forms, automations, attachments,
permissions, integrations, auditability, mobile workflows, bulk operations, APIs and agent
access — and the legacy base can be retired without losing operational capability.

**Method, every time:** inventory → model → design → implement → test → verify → migrate →
reconcile → retire. Never skip the verification gates.
