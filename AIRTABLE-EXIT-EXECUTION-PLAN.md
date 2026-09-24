# TMMT EXECUTION PLAN — Airtable Exit & Fleet OS Productization

Handoff specification for Claude Code. Prepared 2026-09-15.
Source: read-only audit of Airtable, Supabase and Vercel performed the same day.

> **Status tracking lives in `evidence/`.** A gate is passed by producing its named
> artifact, not by believing the work is done. See `evidence/README.md`.

---

## 0. CONTEXT — what this system actually is

TMMT ran a small vehicle rental fleet in Northern Virginia from April 2025 to April 2026.
The fleet is no longer operating. The software built to run it is now the product: a fleet
operating system sold to other small rental and rideshare-fleet operators at $4,000–$8,500
plus a monthly retainer.

Two objectives, in this order:

1. **Get Airtable out of the stack.** It is the transitional system. It is at its record cap,
   it cannot accept a new row, and it will never be provisioned for a client.
2. **Make the remaining stack sellable as a multi-tenant product.**

### Live resources

| Resource | Identifier |
|---|---|
| Supabase project | `uapxakmlwnpfsftfeezx` (org AIXMOS) |
| Airtable base | `appcenWUju039rD7b` — "TMMT Rentals" |
| Vercel team | `aixmos537` / `team_UzatfZkJUpFKABaO6cZTQUq7` |
| Primary app | `tmmt-ops` — `prj_Cw4lJPwwlYSyVWLvuo98nuk1r5gV` |
| Repo | GitHub `AIXMOS537/TMMT` |
| Other Vercel projects | `tmmt-command-center`, `tmmt-training-site`, `aixmos-landing`, `aixmos-offer` |
| CRM / comms / billing | GoHighLevel (agency account, sub-account per client) |

### Established state (verified 2026-09-15)

- Supabase holds 180+ tables, RLS enabled on every one.
- Supabase is already richer than Airtable: `incoming_leads` 885, `ghl_contacts` 1653,
  `people` 1210, `tickets` 308, `audit_events` 3892, `exec_va_tasks` 19097.
- Row parity confirmed on `fleet` (43), `customer_payments` (31), `operation_costs` (5),
  `tickets` (308).
- **Row parity is not migration. Zero attachments have moved.**

---

## 1. PRIME DIRECTIVES

These are not style preferences. Violating one can destroy the only copy of business-critical
or legally-sensitive data.

1. **Nothing is deleted from Airtable until Phase 2 completes and is verified.** Airtable is
   currently the sole copy of 636+ attachments.
2. **Every phase gate must pass before the next phase starts.** A gate is passed by producing
   its named artifact, not by believing the work is done.
3. **Tag every finding VERIFIED / INFERRED / REPORTED / UNKNOWN / CONFLICT.** Never promote an
   inference to a fact. UNKNOWN means uncounted — it never means empty.
4. **Never mark anything COMPLETE without evidence.** Evidence is a count, a diff, a test
   result, or an opened file — not a successful exit code.
5. **Do not invent business rules, tables, integrations or legal requirements.** If a rule is
   unclear, stop and ask. Guessing a rule is how a client's eligibility gate silently changes.
6. **Reuse before rebuilding.** Large amounts of this system already exist. Inspect first.
   Do not rebuild something for tidiness.
7. **Secrets never enter the repo, a log, a commit, or this file.** Use environment variables
   only. If a credential is found in data, follow §2.1.
8. **No production writes without explicit per-package authorization from the owner,** named
   in the task.

### Absolutely prohibited without a signed-off change request

- Deleting or emptying any Airtable table, base, or field
- Cancelling the Airtable subscription
- Bulk-deleting rows in any Supabase table (in particular `exec_va_tasks`, 19,097 rows)
- Rotating credentials without a recovery plan
- Sending any external message — SMS, email, or call — to any contact in the system
- Disabling or weakening RLS on any table
- Weakening UUID validation globally, or adding a column purely because app code expects it.
  Fix the contract, not the database.

---

## 2. PHASE 0 — SAFETY

**Objective:** make everything recoverable and remove the one live security exposure.
Nothing else in this plan may start until Phase 0's gate passes.

### 2.1 Rotate and purge the stored credential — P0

Airtable table `Insurance` (`tblU3rRVFuZFU4kPs`) contains plaintext login columns:

| Field | ID |
|---|---|
| LOGIN EMAIL | `fldiWrNKyClzWqUju` |
| LOGIN PASSWORD | `fldX30NUSBz5MM8Vd` |
| LOGIN PHONE | `fld4QT0cHNr1GoGey` |

One record is populated — the policy attached to the 2024 Honda CRV. VERIFIED by filtered
count on 2026-09-15; the value was deliberately never read.

**Order of operations, and the order matters:**

1. Owner changes the password at the insurance carrier's site. Not Claude Code — this is a
   human action against a third-party account.
2. Owner confirms the new credential works and is stored in a password manager.
3. Only then clear the field value.
4. Delete all three columns from the table schema.
5. Confirm the corresponding Supabase `insurance` columns are absent or empty.
   (Previously reported empty — re-verify, do not assume.)

Purging before rotating leaves a live credential you no longer have a record of. **Rotate first.**

### 2.2 Full offline archive

Export the entire Airtable base including all attachments. Store off the working machines.
Open the archive and confirm a sample of files actually open.

This archive is the rollback for everything that follows. It is kept permanently, including
after cancellation.

### 2.3 Capture true infrastructure cost

`operation_costs` currently lists only GoHighLevel ($117.00), OpenPhone ($221.83),
Zapier ($29.99) and Intellius ($25.11) — $393.93. Supabase, Vercel, Airtable, domains and
Google Workspace are not in it. Real burn is higher and unknown.

Collect actual current charges for every service and write them into `operation_costs`.
Client-install margin cannot be quoted honestly until this is real.

### GATE 0

- [ ] Carrier credential rotated, field cleared, three columns deleted
- [ ] Full base export with attachments archived offline and spot-checked by opening files
- [ ] `operation_costs` reflects true current spend across all vendors

Produce `evidence/phase0-report.md` recording each item with its evidence.
**Do not proceed without it.**

---

## 3. PHASE 1 — PARITY VERIFICATION

**Objective:** know exactly what is in Airtable that is not in Supabase.

### 3.1 Full row-count reconciliation

Build `scripts/parity-check.ts`. For every Airtable table, count rows and compare to the
mapped Supabase table. Emit a report with MATCH / GAP / UNMAPPED per entity.

Already verified — do not re-derive, but do re-confirm in the run:

| Entity | Airtable | Supabase | State |
|---|---|---|---|
| fleet | 43 | 43 | MATCH |
| customer_payments | 31 | 31 | MATCH |
| operation_costs | 5 | 5 | MATCH |
| tickets | 308 | 308 | MATCH |
| active_customers | 40 | 35 | CONFLICT — 5 rows |
| contracts | UNKNOWN | 2 | Suspiciously low — investigate |
| incoming_leads | UNKNOWN | 885 | Supabase richer (GHL-fed) |
| background_checks | UNKNOWN | 299 | Count Airtable side |
| waitlist | UNKNOWN | 104 | Count Airtable side |
| insurance | UNKNOWN | 24 | Count Airtable side |
| do_not_rent_list | UNKNOWN | 12 | Count Airtable side |
| expenses | UNKNOWN | 34 | Count Airtable side |

### 3.2 Resolve the two known discrepancies

- **Active Customers, 5 rows.** Identify them by name. Determine whether they failed to
  migrate or were deliberately excluded. Both answers are acceptable; an unanswered question
  is not.
- **Contracts at 2 rows.** The business signed far more than two rental agreements. Either
  contracts live elsewhere, or the migration dropped them. Find out which.

### 3.3 Field-level fidelity, sampled

Row counts do not prove field fidelity. For each mapped table, pick 5 records at random and
diff every field value Airtable → Supabase. Pay attention to:

- Linked-record relationships (`multipleRecordLinks`) — did the foreign keys survive?
- Single-select values — did option names map cleanly or silently become null?
- Formula and rollup outputs — these must be **recomputed** in Supabase, not copied as stale values.
- Currency and percent precision — `Partner Percentage` is stored as a decimal (0.70), not an integer.

### GATE 1

- [ ] Every Airtable table counted; no entity remains UNKNOWN
- [ ] Active Customers 5-row gap explained in writing
- [ ] Contracts count explained in writing
- [ ] Field-level sample diff run, discrepancies listed

Produce `evidence/parity-report.md`.

---

## 4. PHASE 2 — ATTACHMENT EXTRACTION

This is the phase that actually blocks the Airtable exit. Everything else is reversible;
this is not.

### 4.1 The gap

VERIFIED 2026-09-15 — records carrying at least one attachment:

| Airtable table | Table ID | Records with files | Content |
|---|---|---|---|
| Background Checks | `tbl1OFZh3cMXytNZM` | 287 | Driver's licenses, proof of insurance, paystubs, background-check screenshots |
| Tickets | `tblhfKVanQDgn9plv` | 308 | Citations, screenshots, supporting documents |
| Fleet | `tblubnSDZkvsc9L6I` | 41 | Vehicle photos, registrations, state inspection & emissions |
| Contracts | `tblyDwuH3fBZmaCTF` | not counted | Signatures, addendums |
| Vehicle Handover | `tblKmdjH0tmKY9Bcl` | not counted | Staff and customer checklists |
| Vehicle Onboarding Inspections | `tblqJuzv6YkuAn1kL` | not counted | Condition & document photos |
| Expenses | `tblu4DFhHglmQMEBj` | not counted | Receipts |
| Fleet Car Inspections | `tbluH4YH2YBuu7FFg` | not counted | Inspection attachments |

Supabase destination tables `documents`, `vehicle_media` and `program_documents` all hold
0 rows. **Nothing has moved.**

### 4.2 Legal precondition — do not skip

287 records contain identity documents belonging to people who are no longer customers.

Before extraction runs, the owner must obtain from counsel a written retention rule covering:
which document types must be retained, for how long, which must be destroyed now, and what
obligations attach to holding them. Extract according to that rule. Do not default to
migrating everything because it is easier — over-retention of identity documents is its own
liability, and a prospective client will ask how you handle it.

**Claude Code does not decide this. Claude Code implements the decision.**

### 4.3 Technical constraints — read before writing the script

- **Airtable attachment URLs expire.** They are short-lived signed URLs (on the order of a
  couple of hours). You cannot save the URL and fetch later. The script must list, download,
  and persist within the same run, and must re-fetch the record if a download fails rather
  than retrying a stale URL.
- **Airtable API rate limit is 5 requests/second per base.** Throttle explicitly. A 429
  mid-run corrupts your progress accounting.
- **The run must be resumable.** Maintain a manifest keyed by
  `(table, record_id, field_id, filename)` with status
  `pending | downloaded | uploaded | verified | failed`. Never restart from zero.
- **Writes to Supabase need `service_role`,** and every inserted row must carry the correct
  `organization_id` or RLS will misfile or silently reject it. Set tenancy explicitly; do not
  rely on a default.
- **Preserve provenance.** Every stored file records: source table, source record id, source
  field id, original filename, content type, byte size, sha256, and extraction timestamp.

### 4.4 Implementation

1. Create Supabase Storage buckets, **private**, one per entity: `background-checks`,
   `tickets`, `fleet`, `contracts`, `inspections`, `expenses`.
2. Storage policies: `service_role` write, tenant-scoped read, no public access. These are
   identity documents. There is no scenario in which a bucket holding driver's licenses is public.
3. Build `scripts/extract-attachments.ts` implementing the manifest and constraints above.
4. Run per table, smallest first (Fleet, 41 records) to prove the pipeline before touching the 287.
5. Write each file's metadata row into `documents` or `vehicle_media`, linked to its Supabase
   parent record.

### 4.5 Verification — the part that is usually skipped

- Manifest count per table equals the source count. VERIFIED, not assumed.
- Every row has a non-null storage path and a sha256.
- Open a random sample of at least 10 files per table and confirm they render correctly.
  A file of the right byte length can still be a truncated download or an HTML error page.
- Spot-check that each file is linked to the correct parent record. A perfectly extracted
  archive attached to the wrong renters is worse than no archive.

### GATE 2

- [ ] Retention rule received in writing from counsel and applied
- [ ] All attachment-bearing tables counted — none left uncounted
- [ ] Extraction complete with manifest reconciled per table
- [ ] ≥10 files per table opened and visually confirmed
- [ ] Parent-record linkage spot-checked

Produce `evidence/attachment-extraction-report.md`.
**Airtable may not be cancelled before this gate passes.**

---

## 5. PHASE 3 — CAPTURE THE BUSINESS LOGIC

The part that does not export, and the part that makes the product worth $8,500.

Airtable holds a year of operating rules encoded as formulas, views, select options and field
descriptions. Data migration carries none of it. Extract it into a written specification.

Produce `docs/business-rules/` with one document per domain:

1. **Eligibility & screening** — what makes an applicant pass or fail. Source: Background
   Checks (`tbl1OFZh3cMXytNZM`) — Eligibility Status, Background Check Status, Insurance Check
   Status, Earnings Verification Status. Document the actual decision logic, including the
   combinations that were treated as borderline.
2. **Do-not-rent criteria** — `tblE6nOqVcSeGFQCi`. What lands someone on the list, who can add,
   whether it is ever reversed.
3. **Pricing bands** — Fleet Weekly Prices ($300/350/400/450/500/550) and Lowest Possible
   Price. What determines a vehicle's band, and what authority exists to discount.
4. **Partner economics** — Partner Percentage (values on file: 0.60, 0.65, 0.70). Which tier
   applies when, and what TMMT carries in exchange. See the Revenue Architecture document for
   the tier definitions being adopted going forward.
5. **Vehicle status lifecycle** — Available → Rented → Under Maintenance → Coming Soon →
   Retired. Legal transitions, who may make each, what must be true first.
6. **Customer lifecycle** — Incoming Lead → Background Check → Waitlist → Appointment →
   Contracting → Active Customer → Former Customer, plus the repossession path.
7. **Handover requirements** — Vehicle Handover checkboxes: required docs, inspection,
   registration, insurance. What blocks a handover.

For each rule, record: the rule, where it was encoded, whether it was consistently enforced,
and whether it should carry forward unchanged. **Several were not consistently enforced — that
is a finding, and it is more valuable than the rule itself. Write it down rather than quietly
fixing it.**

### GATE 3

- [ ] Seven rule documents written
- [ ] Each rule tagged: carry forward / change / drop — with the owner's decision recorded
- [ ] Rules that were not consistently enforced are named as such

This becomes the configuration spec for every client install. It is a deliverable, not
documentation.

---

## 6. PHASE 4 — CUT THE WRITE PATHS

**Objective:** nothing writes to Airtable any more.

1. Inventory every Zapier Zap. For each: trigger, action, whether it touches Airtable, and
   whether it is live.
2. Inventory GHL workflows and webhooks pointing at Airtable.
3. Inventory forms — Airtable form views, landing pages, the operator signup page — that write
   into the base.
4. Re-point each to Supabase or retire it. Record the decision per item.
5. Interview the owner: does any person still open Airtable to do their job? If yes, that
   workflow is not migrated regardless of what the data says.

A single live webhook silently making the base authoritative again is how a migration fails a
year later.

6. Set the base read-only. Run the business entirely on Supabase + `tmmt-ops` for 30 days.
   Log anything that breaks.

### GATE 4

- [ ] Every integration inventoried and dispositioned
- [ ] No automated write path to Airtable remains
- [ ] No human workflow depends on Airtable
- [ ] 30 days read-only completed with breakages logged and resolved
- [ ] **Airtable automation logic preservation** — 8 script-bearing automations identified, containing **15 `customScript` bodies**; deployed script bodies and execution context must be captured from the live Airtable UI before subscription cancellation. Unknown behaviour must remain explicitly marked UNKNOWN until verified. **No cancellation gate may pass while unrecoverable automation logic remains uncaptured.** Register: `evidence/automation-logic-capture.md`

Only after this gate may the owner cancel the Airtable subscription. The offline archive is
retained permanently regardless.

---

## 7. PHASE 5 — MULTI-TENANT CLIENT INSTALL

**Objective:** make "provision a new client" a repeatable, documented procedure that touches
no Airtable.

### 7.1 What already exists — inspect before building

| Table | Rows | Purpose |
|---|---|---|
| `organizations` | 9 | Tenant root |
| `org_roles` | 1 | Role assignment |
| `organization_licenses` | 4 | Licensing |
| `organization_domains` | 2 | Custom domains |
| `installations` | 2 | Hardware-bound install licensing |
| `partner_fleet_access` | 0 | Partner-scoped fleet visibility |
| `ventures` | 1 | Portfolio businesses; TMMT Rentals is venture #1 |

RLS is enabled on all 180+ tables. Audit whether the policies are actually **correct**, which
is a different question from whether RLS is switched on. See the warning in §7.3.

### 7.2 Build the provisioning runbook

`docs/runbooks/provision-client.md` — an exact, ordered procedure:

1. Create `organizations` row; capture the org id.
2. Create `organization_licenses` row at the purchased tier.
3. Create the GHL sub-account; record its id against the org.
4. Seed reference data for the tenant: `rental_pricing_rules`, `reason_categories`,
   `verticals`, `programs`.
5. Create the owner user, assign `org_roles`.
6. Import their existing data (CSV in; never an Airtable base).
7. Configure `enforcement_settings` for their delinquency ladder.
8. Tenant isolation test — see below.
9. Hand over credentials only after final payment is received.

### 7.3 Tenant isolation test — mandatory, automated

Write `tests/tenant-isolation.test.ts`. For every table carrying `organization_id`, assert that
a user authenticated to org A cannot read, update or delete any row belonging to org B.

This test runs in CI and must pass before any client goes live.

Two documented precedents in this database prove why: `do_not_contact_numbers` — RLS with no
SELECT policy made every downstream opt-out gate **fail open**, returning zero rows and reading
as "nobody opted out", until 2026-07-16. `outreach_touches` — RLS enabled with no policy made
every read **fail closed**, leaving the table permanently empty until 2026-09-03.

**RLS being "on" told you nothing in either case. Test the behaviour, not the flag.**

### GATE 5

- [ ] Provisioning runbook written and executed end-to-end on a throwaway tenant
- [ ] Tenant isolation test written, passing, and running in CI
- [ ] Zero Airtable dependency anywhere in the client path

---

## 8. PHASE 6 — THE COLLECTIONS ENGINE

This is the differentiated thing being sold. The fleet system already exists; the collections
layer is what the $8,500 tier is priced on, and its absence is what ended the original business.

### 8.1 Required capability

- **Autopay mandate captured at contract signing.** Payment method on file, authorization
  recorded with the contract, charged automatically. Collection is the default state, not an
  activity someone performs.
- **Automatic delinquency ladder,** driven by `enforcement_settings` (table exists, 1 row) so
  each tenant configures their own:
  - Day 1 — automated text
  - Day 3 — call task assigned to a named person
  - Day 7 — written demand
  - Day 10 — suspension / recovery decision
- **Collection rate as the primary metric.** Billed vs received, per week, on the front page of
  the dashboard. Not buried in a table.
- **Partner earnings visibility.** Each vehicle owner sees what their unit earned and why a
  payment was short. Partner churn was the mechanism of failure; opacity was the cause.

### 8.2 Compliance — non-negotiable

Any automated outbound contact is subject to TCPA and related rules.

- Every outbound message checks `do_not_contact_numbers` (78 rows) and **must FAIL CLOSED.**
  If the DNC check errors or returns an ambiguous result, do not send. This table has already
  failed open once in this system's history; treat that as a live hazard, not history.
- Log every touch in `outreach_touches`.
- Honour opt-outs immediately and irreversibly.
- Route via `comm_channels` — the personal line is marked `do_not_contact` and must never be
  used for outreach.
- **No message is sent to any real contact during development or testing.** Use a seeded test
  tenant with owned numbers.

Collections practice, dunning language, suspension terms, telematics disclosure and deposit
handling all **REQUIRE ATTORNEY REVIEW** before a single automated message goes out — for TMMT
and for every client tenant.

### 8.3 Existing scaffolding — reuse it

`agent_definitions` (2), `agent_jobs` (25), `automation_outbox` (28), `exec_va_tasks` (19,097),
`rate_limit_buckets` (11), `audit_events` (3,892), `enforcement_settings` (1). The queue exists
and has run. **Extend it; do not build a second one.**

### GATE 6

- [ ] Ladder configurable per tenant
- [ ] DNC gate fails closed, with a test proving it
- [ ] Collection rate surfaced on the dashboard
- [ ] Partner earnings view live
- [ ] Attorney review obtained on all outbound language and terms
- [ ] Zero messages sent to real contacts during development

---

## 9. WORKING AGREEMENT

**Package gates.** Every unit of work moves:
`DESIGN → READY → IMPLEMENTED IN SAFE ENV → TESTED → PRODUCTION READY → PRODUCTION VERIFIED`.
Never collapse these into "done".

**Change requests.** Any destructive or business-impacting change gets a
`CHANGE_REQUEST_<n>.md` documenting: CURRENT → PROPOSED → WHY → DEPENDENCIES → RISK → ROLLBACK.
Approved by the owner before execution.

**Evidence directory.** Every gate produces its report in `evidence/`. A gate without its
report has not passed.

**Ask rather than assume.** If a business rule, a retention period, or a tenancy boundary is
unclear — stop and ask. The cost of one question is minutes. The cost of an invented rule is a
client's eligibility gate quietly changing, or an identity document filed against the wrong person.

---

## 10. ORDER OF EXECUTION

```
PHASE 0  Safety            credential + archive + true cost      BLOCKING
PHASE 1  Parity            counts, gaps, field fidelity
PHASE 2  Attachments       636+ files, legal rule first          BLOCKS CANCELLATION
PHASE 3  Business logic    the spec that makes it sellable
PHASE 4  Write paths       cut every integration, 30 days RO     BLOCKS CANCELLATION
PHASE 5  Multi-tenant      provisioning runbook + isolation test
PHASE 6  Collections       the differentiated product
```

Phases 3 and 5 may run in parallel with 1, 2 and 4. Phase 0 blocks everything.
Phases 2 and 4 both block cancelling Airtable.

---

## 11. DEFINITION OF DONE

Airtable exits the stack when all of the following are true, each with evidence:

- [ ] Every row reconciled or its absence explained
- [ ] Every attachment extracted, verified by opening, and correctly linked
- [ ] Credentials rotated and purged; columns deleted
- [ ] Retention rule agreed with counsel and applied
- [ ] Business logic written as specification
- [ ] No automated or human write path remains
- [ ] **Automation logic preserved** — all 15 `customScript` bodies captured with execution
      context; nothing unrecoverable left uncaptured
- [ ] 30 days of clean operation without it
- [ ] Offline archive stored permanently
- [ ] Client provisioning path touches Airtable at zero points

**Then, and only then, cancel the subscription.**

---

Figures in this plan marked VERIFIED were read live from the named systems on 2026-09-15.
Anything marked UNKNOWN is uncounted, not empty. Retention periods, collections practice,
contract terms, telematics disclosure and marketing claims require review by a qualified
attorney; tax and entity questions belong with the CPA. Nothing in this plan authorizes
sending messages to real contacts or making production changes without the owner's explicit
per-package approval.
