# SYSTEM OF RECORD

**Roadmap item 0.4.** The keystone decision — everything in Phase 1 and Phase 2 depends on it.

**Version 1.0** · 2026-09-01 · Owner: Muhammad Taha, TMMT Auto Services LLC
**Status:** DECIDED (owner, 2026-09-01) · Migration plan `[RECOMMENDED]`, pending approval

---

## 1. The decision

> **Supabase is the system of record for every business entity and every state.**
> **Airtable is being decommissioned.** It is a migration *source*, not an interface.
> **GoHighLevel is the communication and marketing layer only.**
> **The Vercel app is the only staff and customer interface.**

`[STATED]` — owner, 2026-09-01, verbatim: *"I want to completely get off of Airtable and have built out an app on Vercel for any and all data to display correctly and need for our Supabase to become our new Airtable with embedded agents and n8n automations."*

This supersedes the earlier `[RECOMMENDED]` posture in `02-CURRENT-STATE-AUDIT.md` §3, which proposed keeping Airtable as the staff interface. **That is no longer the plan.** Airtable has a defined end-of-life.

### What that means in practice

| | Role | Writes allowed? |
|---|---|---|
| **Supabase** | Owns every entity, every status, every relationship, every document. The books. | ✅ The only place business state is created or changed |
| **Vercel app** | The one screen staff and customers use. Reads and writes Supabase only. | ✅ Via Supabase |
| **GoHighLevel** | Phone, SMS, email, marketing campaigns, ad attribution. | ⚠️ Owns *conversation content only*. Never owns business state. |
| **n8n** | Automation runner. Moves data, fires reminders, calls partners. | ✅ Via Supabase, with the gates in §5 |
| **Airtable** | 🔻 **Decommissioning.** Read-only source for migration. | ❌ Freeze on the date in §6 |

---

## 2. Why this was straightforward — the live evidence

Verified against production 2026-09-01, read-only.

**The Airtable ↔ Supabase sync is already dead.** It has been for three months.

- `crm_sync_records`: **6 rows.** The Airtable half of it (`airtable_table`, `airtable_record_id`) was **never populated on a single row.**
- `sync_events`: **33 rows.** Last activity **2026-06-03**.
- Meanwhile `ghl_contacts` and `incoming_leads` are current to **2026-08-31**.

So there was never a real two-way sync to preserve. The only live pipe is **GHL → Supabase**, which this decision keeps.

**`people` is not an identity spine.** All 1,209 rows were created on 2026-08-20 and **not one has been updated since.** It is a one-shot snapshot of `ghl_contacts` that has been drifting for twelve days. It cannot be the spine; it must be rebuilt or retired.

**The duplication is smaller than it looks.** 3,726 rows across the three stores resolve to **~1,223 actual humans** — about 3 rows per person. 837 of 875 `incoming_leads` (95.7%) already match a `ghl_contacts` row by phone or email. A further **466 rows carry no phone and no email at all** and can never be resolved to a human; they are unrecoverable and should be quarantined, not merged.

---

## 3. Per-entity ruling

Read this as: *when two systems disagree about this thing, which one is right?*

| Entity | System of record | Today | Migration note |
|---|---|---|---|
| **Person / identity** | **Supabase** `person` (to be built) | ❌ Split 3 ways; `people` is a stale snapshot | Rebuild the spine. Phone (E.164) is the primary match key — it resolves 1,090 identities vs email's 985 |
| **Contact details** (phone, email, address) | **Supabase**, fed from GHL | 🟡 GHL → Supabase live | Keep the pipe. GHL is the *collector*, Supabase the *holder* |
| **Conversations** (SMS, call, email body) | **GoHighLevel** | ✅ Working | Do NOT copy message bodies into Supabase. Store a pointer + timestamp + direction. GHL stays the archive |
| **Consent / opt-out** | **Supabase** `do_not_contact_numbers` | 🟡 10 rows, RLS previously failed open | Supabase is authoritative and must fail *closed*. GHL's own opt-out list is a mirror, never the master |
| **Lead & pipeline status** | **Supabase** `status_event` (to be built) | 🔴 86.7% null; `agent_status` is the constant `'NEW'` on all 875 rows and carries zero information; `qualification` is `{}` on all 875 | Nothing to migrate. Statuses start fresh from the app |
| **Qualification decision** | **Supabase** (to be built) | 🔴 Does not exist in any system | New build |
| **Disqualification reason** | **Supabase** (to be built) | 🟡 **Partially exists, and better than the audit claimed** — see §3a | Extend `background_checks.eligibility_status`; do not start from zero |
| **Vehicle** | **Supabase** `fleet` | ✅ 43 rows, live | Airtable `Fleet` is the mirror; freeze it |
| **Vehicle owner** | **Supabase** `vehicle_owners` (to be built) | 🔴 Free text `fleet.partner_name`, 22 spellings ≈ 18 real people, 7 vehicles with no owner | Human reconciliation. Not scriptable |
| **Owner split terms** | **Supabase** `owner_agreements` (to be built) | 🔴 `fleet.partner_percentage` populated on **7 of 43** vehicles | Owner has confirmed terms **vary per person and per car** — so this must be a per-vehicle agreement record, never a global setting |
| **Rental** | **Supabase** (`active_customers` today) | 🟡 35 rows doing the job informally | Promote to a first-class object |
| **Signed contracts** | **Airtable → Supabase (URGENT)** | 🔴 Supabase `contracts` has **2 rows: one empty migration stub, one literally named "TEST"**. `contract_instances`, `lto_agreements`, `documents` are all **0 rows** | ⚠️ **Airtable is currently the only place any signature exists.** This is the single hardest dependency on Airtable and must be solved before it can be switched off |
| **Documents & PII** (licenses, paystubs, background checks) | **Airtable → Supabase Storage (URGENT)** | 🔴 **810 populated attachment cells across 304 people** live only in Airtable | See §4. Migration is also the FCRA remediation |
| **Payments** | **Supabase**, reconciled to the processor | 🟡 `customer_payments` 31 rows | The processor is the money truth; Supabase holds the relationship |
| **Pricing / insurance / program config** | **Supabase** config tables | ✅ Right pattern already | Keep. Values still `[OPEN]` per `05` |
| **Marketing attribution / campaigns** | **GoHighLevel** | ✅ Working | Stays in GHL. Supabase stores the resolved source only |

---

### 3a. Correction — denial reasons partly exist already

The earlier audit said *"no disqualification reason field exists anywhere."* That is **wrong**, and the correction matters because it changes the build from "start from nothing" to "extend what works."

`background_checks.eligibility_status` is a real decision field with five server-enforced values, and staff are already using it:

```sql
-- supabase/migrations/20260828000000_sensitive_tables_admin_only.sql:136
('Eligible','Not Eligible','Need Manager''s Review','out of radius','Not found')
```

Live distribution across 82 declines (`src/lib/aixmos-prequal.test.ts`, 2026-08-26):

| Value | Count | What it actually means |
|---|---:|---|
| out of radius | **49** | A **geography** problem, not a credit or character problem |
| Not Eligible | 24 | The real denial |
| Not found | 9 | Record couldn't be located |

And `src/lib/aixmos-prequal.ts` already routes on it — it infers a pathway from the status string, with a comment that states the business insight plainly:

> *"NOT EVERY DECLINE IS A CREDIT PROBLEM. Of 82 declined background checks, 49 are 'out of radius' — a geography problem."*

**So the gap is narrower and more specific than reported:**

1. The five values conflate *why* with *what happened* — `out of radius` is a reason, `Not found` is a process failure, `Need Manager's Review` is a state, not an outcome. They need separating.
2. The field lives on `background_checks` only. A lead denied before a background check ever runs has nowhere to record a reason.
3. `decidePrequalRoute()` reverse-engineers the reason by string-matching the status. That works today and will break the moment someone adds a sixth value.

**And there is a live policy contradiction to resolve** (`docs/GHL-PIPELINE-MAP.md:107`): the GHL stage **"❌ Disqualified - Do not Reapply"** says *never come back*, while `decidePrequalRoute()` sends the same person to AIXMOS to be fixed and re-apply. **Both are running right now.** `[OPEN]` — which is the policy?

---

## 3b. ⚠️ Three live hazards found in the code

These were not in the original audit. Each one can destroy or corrupt production, and each is armed today.

### Hazard 1 — a script that wipes Supabase and refills it from Airtable

`scripts/sync-airtable.mjs`, built to an **approved** 2026-03-26 spec that says, verbatim:

> *"treating Airtable as the source of truth. **Truncates existing Supabase data** and re-inserts from Airtable on each run."*
> *"Conflict resolution — **Airtable always wins**; no merge logic"*

That spec is the exact opposite of the decision in §1. **If anyone runs this script against current production, it destroys every GHL-sourced and app-authored row** — the 1,642 contacts, the 875 leads, all of it.

`[RECOMMENDED]` **Disarm it today.** A guard clause at the top of the file that refuses to run without an explicit `--i-understand-this-truncates-prod` flag. One line, no behaviour change for anything else. Needs a change request but should be the first one filed.

### Hazard 2 — a missing environment variable silently mislabels every lead

`src/lib/crm-sync/stage-map.ts:36` reads `GHL_PIPELINE_STAGE_MAP_JSON`. If that variable is unset, line 44 falls back to `{ pipelines: {}, default_canonical_stage: "inquiry" }` — **collapsing every inbound GHL stage to `inquiry`.** The reverse direction then returns `null` and only tags the contact instead of moving the opportunity.

Both failures are **silent**. Nothing logs, nothing alerts. This is a strong candidate explanation for why pipeline state is untrustworthy. `[RECOMMENDED]` Make it fail loudly at boot rather than defaulting.

### Hazard 3 — the repo cannot rebuild production

`docs/RECONCILIATION-lead-systems.md` records roughly **130 migrations applied in production against 38 in the repo.** Tables that RLS policies actively reference — `bookings`, `revenue_splits`, `rental_pricing_rules`, `contract_instances` — **have no `CREATE TABLE` in any repo.** They exist only in the live database.

This means there is no disaster recovery, and no safe way to test a migration before it hits customers. It has to be closed before the Airtable migration starts, because that migration is the largest schema change this system will ever take.

---

## 3c. The dependency nobody has noticed: Airtable is the approval gate

This is the single most important operational finding, and it is not in any prior document.

**Airtable is not just a mirror. It is a human approval step wired into live code.** The flow:

```
GHL webhook  →  Supabase crm_sync_records (sync_status: "pending_verification")
             →  Airtable "Leads" row written
             →  a human ticks the "Verified" checkbox in Airtable
             →  ONLY THEN does Supabase get the real `cases` record
             →  Supabase pushes the stage back to GHL
```

The gate is explicit — `src/app/api/webhooks/airtable/route.ts:67`:

```js
if (!verified) return NextResponse.json(
  { error: "row not verified — check Verified in Airtable first" }, { status: 400 });
```

**Consequences:**

- Turning Airtable off without replacing this checkbox **stops leads from entering the system entirely.** The Vercel app must grow its own verification queue *before* Airtable goes read-only. This is added as a hard blocker to §6 step 4.
- `docs/GHL-PIPELINE-MAP.md` reports **98% of opportunities are stalled at verification.** If that is accurate, the gate is not a safety feature — it is where the pipeline dies. That is very likely the real reason 86.7% of leads have no status: **nobody is ticking the box.**

`[OPEN]` — Should verification stay a human step at all? If yes, it needs to be one screen in the app with a work queue and an assignee, not a checkbox in a spreadsheet nobody opens.

---

## 4. The two things that make Airtable hard to switch off

Both are the same problem: **Airtable is holding the legally significant records.**

**A. Signatures.** Supabase has no signed agreement, anywhere. The Airtable `Contracts` table holds the real `Signatures (Customer/Staff)` and `Addendums` attachments. 16 active customers and 21 rented vehicles are operating against contracts that exist in exactly one place.

**B. Consumer-report and identity PII.** Airtable `Background Checks` holds, for 304 people:

| Field | Type | Populated |
|---|---|---:|
| Driver's License | attachment | 283 |
| Paystub | attachment | 269 |
| Background Check Screenshot | attachment | 206 |
| Proof of Insurance | attachment | 52 |
| Key Details (Extracted from Screenshot) | **AI text** | 117 |

Supabase's `background_checks` table holds only an `airtable_id` pointer. The documents themselves are not in it.

**This means the Airtable migration and the FCRA remediation (Roadmap 0.2) are the same project, not two.** Doing them separately would mean touching the same 810 files twice.

> **Correction to the earlier audit:** the plaintext-credential finding (Roadmap 0.1) is **less severe than reported**. The fields `LOGIN EMAIL` / `LOGIN PASSWORD` / `LOGIN PHONE` do exist on the Airtable `Insurance` table — but across 24 records there are **0 passwords and 0 phones stored, and 1 email**. This is a bad schema inviting future misuse, not an active credential leak. It drops from "highest-priority remediation" to "delete the fields during migration." The FCRA exposure in **B is the real one.**

---

## 5. Rules that follow from this decision

These are architectural, not negotiable, and they are what make "Supabase as the new Airtable" actually work rather than recreating the same mess.

1. **One writer per field.** Every field has exactly one system allowed to change it. Anything else reads.
2. **GHL never sets business state.** A GHL pipeline stage moving does not change a rental's status. It can *raise an event*; a person or a rule in Supabase decides what that means.
3. **n8n writes through Supabase, never around it.** No automation writes to Airtable, and none writes to GHL except to send an approved message.
4. **Embedded agents get the same gates as people.** An agent may draft, route, remind, and roll up. It may not decide eligibility, move money, or send externally without the owner gate (`CLAUDE.md` §5). Agent writes are attributed and reversible.
5. **Append, don't overwrite.** Owner, renter, insurance, and status are records with validity periods. "Who rents this car" is never a column you overwrite.
6. **The opt-out gate fails closed.** If Supabase cannot confirm consent, nothing sends. This needs a regression test before any n8n send goes live — it previously failed *open*.
7. **No riba. This is a schema constraint, not a policy note.** `[STATED]` — the owner's hardest and most consistently repeated rule, applied concretely across the legal suite on 2026-06-04:
   - **Late fees may never be revenue.** The existing contracts route them to charity. So a `late_fee` row needs a `disposition` field (`charity`), and it must never roll into a revenue or owner-split calculation.
   - **Deposits are ʿarbūn**, flat, no interest, applied to the total — not a financing instrument.
   - **Rent-to-own is Ijārah Muntahia Bittamleek** (AAOIFI Std 9), modelled as **two separate agreements** so ownership is not baked into rent. `lto_agreements` must reflect that, not a single lease-with-purchase row.
   - **Payments never allocate to accrued interest.** The legacy Vehicle Lease did; it was flagged and rewritten.
   A schema that treats a late fee as income, or a deposit as a financing charge, is not a compliance problem to fix later — it makes the books wrong from day one.

---

## 6. Getting off Airtable — the order `[RECOMMENDED]`

Each step needs a change request per `CLAUDE.md` §4 before execution. Nothing here is approved yet.

| Step | Work | Gate to clear |
|---|---|---|
| **1** | **Freeze new Airtable schema.** No new tables or fields. Existing use continues. | Announce to staff |
| **2** | **Build the person spine in Supabase.** Match on E.164 phone first, email second. Quarantine the 466 identifier-less rows rather than merging them. Retire the stale `people` snapshot. | Reconciliation report reviewed by a human |
| **3** | **Migrate documents + contracts into Supabase Storage** with record-level access control, and remediate FCRA at the same time. Delete the three `LOGIN *` fields on the way through. | Legal review of the FCRA handling and adverse-action process |
| **3.5** | 🔴 **Replace the Airtable "Verified" checkbox** with a real verification queue in the Vercel app (see §3c). | **Hard blocker.** Skip this and leads stop entering the system |
| **4** | **Rebuild the staff screens in the Vercel app**, table by table, until staff have no reason to open Airtable. | Staff can do a full day's work without Airtable |
| **5** | **Airtable read-only.** Watch for 30 days. | No one blocked |
| **6** | **Export a cold archive, then disconnect.** | Owner sign-off |

**Airtable cannot be switched off until step 3 is complete and verified.** Everything else is reversible; losing the only copy of a signature or a driver's licence is not.

---

## 7. What this changes in the existing plan

| Doc | Change |
|---|---|
| `02-CURRENT-STATE-AUDIT.md` §3 | The recommendation "Airtable is the staff interface" is **superseded**. Airtable is a decommission target. |
| `02` §7A (plaintext credentials) | **Downgraded** — fields exist, near-zero data in them. Fix during migration. |
| `02` §6 ("two org IDs for one tenant") | **Refuted.** There is exactly one tenant UUID (`8e651b25…`) across all operational data. The real defect is **two competing column names** — `org_id` vs `organization_id`. On `incoming_leads` both exist and `organization_id` is NULL on 774 of 875 rows, so a query joining the wrong column silently loses 88% of the leads. Fix the column naming, not the tenant. |
| `04-ROADMAP.md` 0.4 | Satisfied by this document. |
| `04-ROADMAP.md` 0.2 + `06-MVP-SPEC.md` §3 | **Merge them.** Document migration and FCRA remediation are one project. |
| `04-ROADMAP.md` | **Add:** Airtable decommission as a tracked workstream with the six steps in §6. |

---

## 8. Still open

Nothing in this document answers these. Do not guess them.

- **Owner split terms per vehicle** — owner states these **vary per person and per car** `[STATED]`. But a *written* model already exists and disagrees with the database, so this needs reconciling, not inventing:
  - `docs/PARTNERSHIP-MODEL.md` describes **one car, 50/50, with TMMT's cost recovery coming off the top first** — *"you never bleed on the car."* Worked example: net $2,000 → TMMT $1,400 ($800 recovery + 50% of the $1,200 upside), partner $600. Net $500, under the $800 recovery → TMMT takes all $500, partner $0.
  - `scripts/deal.sh` **implements exactly that**, defaulting to a 50% split — but writes to a local TSV file, not Supabase.
  - The database says something different again: 0.60, 0.65, 0.70 on 7 of 43 vehicles.
  - **Three sources, three answers.** The owner's "varies per person and per car" is consistent with all of them being real for *different* vehicles. The build implication is settled either way: **`owner_agreements` must be per-vehicle, and must model cost-recovery-off-the-top, not just a flat percentage.** The specific numbers per owner remain `[OPEN]` and blocking for Phase 2.
- **Insurance structure** — owner states the primary model is *helping the customer get their own policy through a broker*, with *TMMT's own companies selling to qualified people* as a secondary path. **These are two different regulated activities running side by side.** Both need to be modelled, and the compensation question on the broker path needs legal review before either ships.
- **Credit partner** — none active; owner is selecting a replacement. Pathway 3 stays blocked, correctly.
- Everything else in `05-OPEN-DECISIONS.md` §1, §2, §5–§9.

---

## 9. Corrections to the brief — things the docs get wrong

Found by sweeping every repo and every historical transcript on this machine, 2026-09-01.

### 9a. 🔴 "All In One Management" is not a partner. It is the owner's own company.

`01-BUSINESS-BLUEPRINT.md` §10 and `05-OPEN-DECISIONS.md` §4 both model *All In One Management* as an **external business-formation partner** whose scope is an open question.

It isn't external. It is **the owner's own GoHighLevel agency** — agency owner "Muhammad", email `muhammad@allinonemanagementsolutions.com`, the same account that holds all five TMMT sub-accounts (Detailing, XPRESS, Moving/Cleaning, Rentals, and All-In-One itself). The Supabase project is literally named after that address.

**Why this matters, and it is not a technicality:** the compliance rule in `CLAUDE.md` §6 — *"TMMT must never be represented as performing a service that a partner actually performs"* — was written to stop TMMT claiming a partner's work. Here the relationship is **inverted**: the "partner" is TMMT wearing a second hat. That is not a misattribution risk, it is a **related-party disclosure** question, and it changes what the customer-facing copy must say. Referral compensation between two entities the same person owns is also a different tax and legal object than a third-party referral fee.

`[OPEN]` — is All In One Management meant to be a separately-branded arm of the same business, or genuinely arm's-length? Needs an answer before any progression-pathway copy ships.

### 9b. ⚠️ Umar is a fleet partner, not staff — and is named as a compliance co-approver

`CLAUDE.md` §5 says compliance actions carry a co-approver, **Umar**. But `fleet.partner_name` lists **Umar as a vehicle owner at a 0.70 split**. He does not appear on the staff roster anywhere.

A vehicle owner co-approving compliance decisions that affect vehicle owners is a conflict of interest. `[OPEN]` — is this the same person? If yes, he should be recused from anything touching owner splits, payouts, or fleet economics.

### 9c. Staff roster corrections

- **Dominique Bibbs** and **Michaela Bibbs** are **two different people** sharing a surname — previously collapsed into one. The roster is 4, not 3.
- **Dashan Dyson** — `[email removed]`.
- Escalation chain `[STATED]` 2026-06-04: **first line Dominique Bibbs + Justin Perez**, then Michael Bibbs + Dashan Dyson. Dominique and Justin already hold `role='admin'` in Supabase.
- **Tyrone Hicks Jr. no longer works here** `[STATED]` — his Operations Manager contract is retired and replaced by the Operator/Driver Profit-Share Agreement.

### 9d. This decision is a re-confirmation, not a new one

The owner said the same thing **fourteen months of frustration ago**, on 2026-07-07:

> *"I'm trying to let go of Airtable — I told you that on my Mac."*
> *"BEST OF ALL JUST LOSE AIRTABLE AND SLACK I NEED GHL AND SUPABASE."*

The decision was made then. **The cutover was never finished.** That is the actual failure this document exists to correct — not a missing decision, an unexecuted one. Which is why §6 has dated steps and a blocker list rather than a recommendation.

### 9e. Two portals share one role

`src/app/(partner)/partner/page.tsx` and `src/app/(investor)/investor/page.tsx` **both** gate on `getTierForUser(user) !== "investor"`. A partner and an investor are indistinguishable to the auth layer. Anyone who can see one can see the other. Fix before the investor dashboard carries money.

### 9f. Where the real answers actually are

The rules for qualification, pricing and splits are **not on this PC**. Three places to look, in order:

1. **The Google Drive data room** — specifically documents named *"Background Check Quals"*, *"Partners Payout Template"*, *"Selling prices"*, *"JV Tiered Program"*. A sweep is running.
2. **The owner's Mac** — he said *"I told you that on my Mac."* Memory is per-machine; there is a parallel decision history there that has never been merged.
3. **The deactivated `partners` row in Supabase** — it carries the "do not re-enable" note and would name the former credit partner.

---

## 10. Decisions log

| # | Date | Decision | Status |
|---|---|---|---|
| D1 | 2026-07-07 | Drop Airtable and Slack. GHL + Supabase only. | `[STATED]` — restated and now executed against |
| D2 | 2026-09-01 | **Supabase is the system of record.** Airtable decommissions; Vercel app is the only interface; GHL is comms only. | `[STATED]` — §1 |
| D3 | 2026-09-01 | **Verification gate removed.** A lead counts the moment it arrives. No human tick required. Staff work the list instead of guarding the door. | `[STATED]` — unblocks the 676 stalled opportunities |
| D4 | 2026-09-01 | **Denial routing depends on the reason.** Out-of-radius is held for market expansion; a profile decline routes to improvement; an adverse background result closes. One flat "do not reapply" is wrong. | `[STATED]` — resolves the §3a contradiction |
| D5 | 2026-09-01 | **`scripts/sync-airtable.mjs` locked.** Refuses to run without an explicit acknowledgement flag. `--dry-run` unaffected. Tested. | ✅ Done |
| D6 | standing | **No riba.** Late fees are charity-only and never revenue; deposits are ʿarbūn; LTO is Ijārah Muntahia Bittamleek as two documents. | `[STATED]` — §5.7, binding on schema |

### D3 — what "let them all through" actually requires

Removing the gate is right, but it is not a one-line change. Doing it carelessly turns 676 stalled opportunities into 676 unassigned rows, which is the same problem wearing a different hat.

`[RECOMMENDED]` the minimum viable version:

1. `crm_sync_records.sync_status` defaults to `active`, not `pending_verification`.
2. The Airtable webhook path stays alive during migration but stops being a *gate* — it becomes one more way to update a record that already exists.
3. **Every lead gets an owner and a next action on arrival.** Today `assigned_to` is populated on **0 of 875** rows and there is no `contacted_at`, `qualified_at`, `closed_at` or `lost_at` on any of them. A lead with no owner is stalled whether or not a checkbox blocks it.
4. Backfill the 676: they are not new leads, they are **months-old leads that were never worked**. They need triage and honest expectations, not a blast. This is a `[OPEN]` question about outreach, and TCPA consent applies to every one of them.

### D4 — the reason→route map `[RECOMMENDED]`

Owner stated the routing depends on why. Below is the proposed map, built on the five values already in `background_checks.eligibility_status` and the live counts. **Confirm or change each row** — these are recommendations, not decisions.

| Reason | Live count | Recommended route | Why |
|---|---:|---|---|
| `out of radius` | **49** | **Market waitlist.** Keep warm, do not send to credit. Re-open when the service area expands. | A geography problem is not a credit problem. This is the single biggest bucket and it is currently being treated as a denial |
| `Not Eligible` | 24 | **Split it.** Needs a sub-reason before it can route — see below | Today this one bucket hides several different situations |
| `Not found` | 9 | **Re-run the check.** Not a decision at all | A process failure being recorded as an outcome |
| `Need Manager's Review` | — | **Hold, assigned to a named manager, with a due date** | A state, not an outcome. Right now it routes nowhere and nobody owns it |
| `Eligible` | — | Proceed to vehicle matching | — |

`Not Eligible` needs breaking into sub-reasons before Pathway 2 can work, because the route differs sharply: an adverse background result should close (and carries **FCRA adverse-action obligations** — that is a legal step, not a status change), while *cannot meet deposit*, *no insurance*, or *documentation incomplete* are all fixable and should route to improvement. `[OPEN]` — the owner confirms the sub-list.

---

## 11. Sign-off

| | |
|---|---|
| Decision (§1) | ✅ Owner, 2026-09-01 |
| Migration plan (§6) | ⬜ Pending owner approval |
| FCRA handling (§4B) | ⬜ Pending legal review |
| Insurance dual-model (§8) | ⬜ Pending legal review |
