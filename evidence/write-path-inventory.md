# Evidence — Phase 4 (Write-Path Inventory)

Run date: 2026-09-15 · read-only. Covers the repo and the Airtable automation layer.
**Zapier and GoHighLevel consoles are NOT covered — owner access required (§4).**

**GATE 4 STATUS: NOT PASSED.** Inventory partial; no path has been retired; the 30-day
read-only period has not started.

---

## 1. SAFETY FINDING — read before touching the base

**8 Airtable automations are deployed and live. Two of them send email, one directly to
customers.** VERIFIED via the automations API.

| Automation | Trigger | Action |
|---|---|---|
| **Notify Customer of Next Payment Due** | `Customer Payments` where `Next Payment Due Date` = today | **gmailSendEmail → the customer** |
| Notify Team on New Fleet Vehicle | record created in `Fleet` | sendEmail (internal) |
| New Lead Notification and Status Update | record created in `Incoming Leads` | sendEmail + 2 × customScript + updateRecord |
| Update Payment Status to Overdue | `Customer Payments` past due | updateRecord |
| Move cust to Active Customers | `Incoming Leads.Status` = Contracting | createRecord |
| Auto-populate Partner Name/Customer in Expenses | `Expenses` updated | updateRecord |
| Verification Form from GHL → Background Checks | inbound webhook | createRecord |
| Incoming uber/lyft leads from GHL | inbound webhook | createRecord |

**Can the customer-facing one fire right now? No — VERIFIED, but only by luck of the data.**
`customer_payments` holds 31 rows, 21 with a due date, **0 due today or in the future**
(latest: 2026-04-24). The trigger is `due date = today`, so it is currently dormant.

**It is dormant, not disabled.** Any edit that sets a due date to today — a re-import, a
date-shifting fix, a test row — fires an email to a former customer of a business that stopped
trading in April 2026.

> **Consequence for this programme.** The plan forbids sending any external message to any
> contact in the system. Three planned activities could breach that *without anyone intending
> to send anything*: restoring the offline archive back into the base, correcting the stale
> statuses found in `docs/business-rules/05`, or any bulk edit during migration.
>
> **Recommended sequencing change: turn off all 8 deployed automations BEFORE Phase 2
> extraction or any corrective edit — not at Phase 4 step 6 where the plan currently places
> "set the base read-only".** This is an owner action in the Airtable UI. Extraction itself is
> read-only and does not trigger them, but it should not be the thing that finds out.

Note also **"Update Payment Status to Overdue"** matches `due date <= today` on 21 rows. Airtable
is still mutating its own records. The base is not quiescent.

---

## 2. Repo-side paths

### 2.1 App writes INTO Airtable — code exists, has NEVER run

`src/lib/crm-sync/airtable.ts` performs `POST` (create) and `PATCH` (update) against the
Airtable REST API. Call chain:

```
GHL webhook → /api/webhooks/ghl → lib/ghl/dispatch.ts
  → handleOpportunityStage()  (lib/ghl/handlers/opportunity-stage.ts:117)
    → upsertLeadForVerification()  → POST/PATCH Airtable "Leads"
```

The prior audit (`SYSTEM_AUDIT_2026/06_AIRTABLE_PARITY.md`) calls this **"split-brain — both
systems can act."** **That conclusion is not supported by the data.**

VERIFIED by counting the fields this code writes, in the live `Incoming Leads` table (871 rows):

| Field written only by this code path | Records populated |
|---|---:|
| `GHL Contact ID` (`fldJx0cPZMJSt3P2u`) | **0** |
| `Last Synced At` (`fldRNokPD9007204A`) | **0** |
| `Verified` (`fldvAWHsXD6EROMdG`) | **0** |

**Zero. The path has never successfully written to this base.**

Two independent reasons why, both VERIFIED:
1. `upsertLeadForVerification` returns `{skipped: true}` unless `AIRTABLE_API_KEY`/`AIRTABLE_PAT`
   **and** `AIRTABLE_BASE_ID` are set. The PAT was revoked and purged on 2026-07-22 per
   `CLAUDE.md`.
2. **The table names don't exist.** The code defaults to `AIRTABLE_LEADS_TABLE ?? "Leads"` and
   `AIRTABLE_OPS_LOCATIONS_TABLE ?? "Ops Locations"`. This base has **`Incoming Leads`**, and
   has **no `Ops Locations` table at all** (31 tables enumerated). Unless those env vars are
   set to override, both paths target tables that do not exist.

**This materially de-risks the exit.** The most dangerous category — an app silently writing
into the base being retired — is dormant code, not live traffic. It still must be deleted
(a PAT and a correct table name would wake it), but it is a code-removal task, not a
data-reconciliation emergency.

**Correction to `SYSTEM_AUDIT_2026/06_AIRTABLE_PARITY.md`:** "both systems can act" overstates
it. Only Airtable's own automations have acted.

### 2.2 Airtable writes INTO Supabase — live, and correctly secured

`src/app/api/webhooks/airtable/route.ts` — `POST`, guarded by `SYNC_WEBHOOK_SECRET` via
constant-time compare, Zod-validated, with a documented replay guard.

Events: `lead.verified` (Verified checkbox → promote a sync record + case) and
`ops_location.upsert`.

Direction is **Airtable → Supabase**, so it does not make Airtable authoritative for storage —
but it *does* make an Airtable checkbox a trigger for Supabase state, which is the
human-workflow dependency §4 step 5 asks about. With `Verified` populated on **0** records, this
has also never fired against this base.

Second route: `src/app/api/webhooks/airtable/locations/route.ts` (ops locations roster) —
targets the non-existent `Ops Locations` table.

### 2.3 Read-only consumers

| Path | Purpose | Disposition |
|---|---|---|
| `scripts/sync-airtable.mjs` | Bulk Airtable → Supabase copy (the 2026-04-22 migration) | Retire after Gate 2 |
| `scripts/export-operators-from-airtable.mjs` (`npm run export-operators`) | Operator export | Re-point to Supabase |
| `AIXMOS/scripts/sync-airtable-people.mjs` (`npm run sync:aixmos-people`) | People sync | Re-point to Supabase |
| `src/lib/crm-sync/airtable.ts` → `fetchAirtableRecord` | Live read, 27 refs | Delete with the webhook routes |
| `scripts/parity-check.ts`, `scripts/extract-attachments.ts` | **This programme's own tooling** | Retire when Airtable is cancelled |

### 2.4 Env vars to remove at the end

`AIRTABLE_PAT` · `AIRTABLE_API_KEY` · `AIRTABLE_BASE_ID` · `AIRTABLE_BASE_NAME` ·
`AIRTABLE_LEADS_TABLE` · `AIRTABLE_PEOPLE_TABLE` · `AIRTABLE_OPS_LOCATIONS_TABLE` ·
`AIRTABLE_OPS_LOCATIONS_SCHEMA`

---

## 3. Airtable automation layer — 51 total

**8 deployed** (§1 above). **43 undeployed** — built and never switched on, including the
entire payment/collections ladder: *Payment Tracking and Late Fee Application*,
*Customer Payment Due and Overdue Alerts*, *Notify Staff When Customer Payment is Overdue*,
*Update Payment Reliability Rating*, *Recurring Payment Balance Update*.

> **This is Phase 6's prehistory and it is worth the owner's attention.** The collections
> engine — the capability the $8,500 tier is priced on, and whose absence the plan says ended
> the business — *was built here and left switched off*. Before rebuilding it in Supabase,
> read these 43 definitions: they encode the intended ladder, and the reason they were never
> deployed is itself worth knowing.

Also undeployed: *Move Customers to Do Not Rent List on Repo Status* — the automated bridge
from repossession to the ban list, matching the `Repo Status` rule in
`docs/business-rules/06` §6.4, and never switched on.

---

## 3a. Script logic inside automations — NOT recoverable via API

VERIFIED 2026-09-16. **8 of the 51 automations contain `customScript` action nodes.** One is
deployed: `New Lead Notification and Status Update` (`wfl6aEZPBOZkd1KE7`), which fires on every
record created in `Incoming Leads` and runs **two** scripts.

`get_automation` returns `inputs: {}` for every `customScript` node — the bodies are readable
only in the Airtable UI. Airtable's base export includes records and attachments, **not
automation definitions**.

**Therefore the Gate 0 offline archive does not capture this logic.** Cancelling the
subscription destroys it.

The deployed automation's other nodes are legible: an internal email to the owner's own inbox,
then an `updateRecord` setting lead `Status` to "New Lead". What the two scripts do in between
is **UNKNOWN**.

Two further automations use `aiGenerate` nodes (both undeployed): *Expense Categorization and
Monthly Totals Update*, and *Customer Inspection Photos Automation*.

**Action required before cancellation:** capture the **15 `customScript` bodies** and their full
execution context per the 14-field schema in `evidence/automation-logic-capture.md`, and classify
each as business rule / integration / notification / transformation / other. This is an owner or
UI-access task; it cannot be done through the API. **Do not infer a body from its neighbouring
nodes — UNKNOWN until captured.**

The two `aiGenerate` prompts **were** API-recoverable and are already preserved in that register.

## 4. NOT covered — owner access required

| Source | Status | Why |
|---|---|---|
| **Zapier** | **UNKNOWN** | No console access. `operation_costs` shows a live $29.99/mo Zapier subscription, so Zaps are presumed to exist. **UNKNOWN means uncounted, not zero.** |
| **GoHighLevel workflows/webhooks** | **UNKNOWN** | Agency console access needed. Three deployed Airtable automations receive inbound webhooks *from* GHL, so at least three GHL-side senders exist. |
| **Airtable form views** | **PARTIAL** | Two form-triggered automations found (`Update Vehicle Type in Waitlist`, `New Ticket Submission`, form `pagmI1Ls0pxKsaeKz`). A full form-view inventory needs the UI. |
| **Human workflows** | **UNKNOWN** | §4 step 5 — requires interviewing the owner. The `🔄 Change & Update Log` table (2 rows) exists specifically for humans to log changes, so a human process was at least intended. |

---

## 5. Gate 4 checklist

- [~] Every integration inventoried and dispositioned — **repo + Airtable automations done;
      Zapier, GHL and form views outstanding**
- [ ] No automated write path to Airtable remains — **3 inbound-webhook automations still
      create records; 3 more still mutate them**
- [ ] No human workflow depends on Airtable — **UNKNOWN, needs the owner interview**
- [ ] 30 days read-only completed with breakages logged — **NOT STARTED**
- [ ] **(added)** **Airtable automation logic preservation** — 8 script-bearing automations identified, containing **15 `customScript` bodies**; deployed script bodies and execution context must be captured from the live Airtable UI before subscription cancellation. Unknown behaviour must remain explicitly marked UNKNOWN until verified. **No cancellation gate may pass while unrecoverable automation logic remains uncaptured.** Register: `evidence/automation-logic-capture.md` — **NOT STARTED.**

### Recommended order

1. **Disable the 8 deployed automations** — before any extraction or corrective edit (§1).
2. Owner inventories Zapier and GHL.
2a. Work `evidence/automation-logic-capture.md` — capture the 15 `customScript` bodies and
   their execution context from the Airtable UI. Do this while the subscription is live; it is
   unrecoverable afterwards. A1 is deployed and goes first.
3. Delete the dormant write code (`upsertLeadForVerification` and its call site).
4. Re-point `export-operators` and `sync:aixmos-people` at Supabase.
5. Owner interview on human workflows.
6. Set the base read-only; start the 30 days.
