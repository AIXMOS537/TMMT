# Evidence — Airtable Automation Logic Preservation (capture register)

**Purpose.** Capture the complete executable behaviour and surrounding configuration of every
Airtable automation containing `customScript` or `aiGenerate`, preserve the evidence, and
determine whether each behaviour is a business rule, integration behaviour, notification
behaviour, transformation, or other dependency that must be reproduced natively in TMMT.

Compiled 2026-09-16 from `get_automation` (read-only). **Nothing here is inferred from
neighbouring nodes.** Where Airtable does not expose the information, the field reads
**UNKNOWN** and stays UNKNOWN until captured from the live UI.

---

## 0. Why this register exists

| Fact | Status |
|---|---|
| Automations containing `customScript` | **8** |
| **Individual `customScript` bodies** | **15** |
| Of those, in a **deployed** automation | **2** (automation A1) |
| `customScript` bodies retrievable via API | **0** — `get_automation` returns `inputs: {}` for every one |
| Automations containing `aiGenerate` | **2** |
| `aiGenerate` prompts retrievable via API | **2 of 2 — RECOVERED, captured in §3** |
| Automation definitions included in Airtable's base export | **No** — the export covers records and attachments |

**Consequence.** Gate 0's offline archive does **not** preserve automation logic. Cancelling
the subscription destroys 15 script bodies permanently. `aiGenerate` prompts are recoverable and
are already preserved below.

> **Capture must happen while the subscription is live.** There is no later.

---

## 1. Capture schema

Each automation below carries the 14 required fields. Fields 4, 5, 6, 9, 10 and 11 are the ones
Airtable withholds; they are pre-marked **UNKNOWN — capture from UI**.

1. Automation name · 2. Deployment status · 3. Trigger · 4. Exact script body ·
5. Inputs available to the script · 6. Outputs / side effects · 7. Adjacent nodes ·
8. Tables / fields / services touched · 9. Changes data? · 10. Sends notifications / calls
external systems? · 11. Business rule encoded? · 12. Evidence artifact ·
13. TMMT replacement destination · 14. UNKNOWN wherever Airtable does not expose enough

**Rule for the capture session:** if the UI does not make a field certain, write UNKNOWN. A
plausible guess recorded as fact is the failure this register exists to prevent.

---

## 2. `customScript` automations — 15 bodies, all UNKNOWN

### A1 — New Lead Notification and Status Update ⚠️ **DEPLOYED**

| # | Field | Value |
|---|---|---|
| 1 | Name | New Lead Notification and Status Update (`wfl6aEZPBOZkd1KE7`) |
| 2 | Deployment | **DEPLOYED — live on every new lead** |
| 3 | Trigger | `recordCreated` on **Incoming Leads** (`tbl4gndUYeiOUWYRR`) |
| 4 | Script body ×2 | **UNKNOWN — capture from UI** (`wac9piYYj17HsBAGk`, `wac8VlmgckLOgpDrz`) |
| 5 | Script inputs | **UNKNOWN — capture from UI** |
| 6 | Outputs / side effects | **UNKNOWN — capture from UI** |
| 7 | Adjacent nodes | Before: `sendEmail` → owner inbox. After: `updateRecord` setting `Status` = "New Lead" (`sel22cd8PjA3KouFA`) |
| 8 | Touches | Known: Incoming Leads `Status`. Script's own reach **UNKNOWN** |
| 9 | Changes data? | **UNKNOWN** (the automation does, via the separate `updateRecord`) |
| 10 | Notifies / external? | **UNKNOWN**. The sibling email goes to the owner's own inbox, not a customer |
| 11 | Business rule? | **UNKNOWN** |
| 12 | Evidence artifact | ☐ TO CAPTURE |
| 13 | TMMT destination | Lead intake pipeline — precise target **UNKNOWN** until body is read |

> **Highest priority of the eight.** It is the only script-bearing automation that is live, and
> it runs twice on every lead created in an 871-row table.

### A2 — Update GoHighLevel Pipeline Stages on Lead Status Change

| # | Field | Value |
|---|---|---|
| 1 | Name | Update GoHighLevel Pipeline Stages on Lead Status Change (`wfl1oG2fiJvGVbtrX`) |
| 2 | Deployment | Undeployed |
| 3 | Trigger | `recordUpdated` on **Incoming Leads**, watching `Status` (`fld930xkWGfScnRGD`) |
| 4 | Script body ×1 | **UNKNOWN — capture from UI** (`wacEdxK8qrKVV8CIp`) |
| 5 | Script inputs | **UNKNOWN** |
| 6 | Outputs / side effects | **UNKNOWN**. VERIFIED: `outputSchema` is empty `[]` |
| 7 | Adjacent nodes | **None — the script is the ONLY node** |
| 8 | Touches | **UNKNOWN**. Name implies GoHighLevel; not verifiable from the API |
| 9 | Changes data? | **UNKNOWN** |
| 10 | Notifies / external? | **UNKNOWN — likely an external CRM write, unconfirmed** |
| 11 | Business rule? | **UNKNOWN — probable lead-stage mapping, unconfirmed** |
| 12 | Evidence artifact | ☐ TO CAPTURE |
| 13 | TMMT destination | Probably `src/lib/ghl/` stage mapping — **UNKNOWN** until read |

> **Second priority.** 100% of this automation's behaviour is inside the script. There is no
> surrounding configuration to reason from, and its name points at a live external integration.

### A3 — Background Check Completion Notification and Customer Update

| # | Field | Value |
|---|---|---|
| 1–3 | `wflIpdzHPxremcTkC` · Undeployed · `recordMatchesConditions` on **Background Checks**, when `Background Check Status` = Verified |
| 4–6 | Script bodies ×2 (`wacGuOHEoWo9eIZYz`, `wacDMGdNOHTR42Iy0`), inputs, outputs — **UNKNOWN** |
| 7 | Adjacent | Before: `findRecords` on Active Customers → `updateRecord` setting `Status` = "Verified" → `sendEmail`. Scripts are the **final two** nodes |
| 8 | Touches | Known: Background Checks, Active Customers. Script reach **UNKNOWN** |
| 9–11 | Changes data / external / business rule | **UNKNOWN** |
| 12 | Evidence artifact | ☐ TO CAPTURE |
| 13 | TMMT destination | Eligibility → `docs/business-rules/01` — **UNKNOWN** |

> **Documentary lead, not a finding.** The sibling email's own text states: *"the customer's
> status has been updated in GoHighLevel CRM for outreach, and a task has been assigned in
> ClickUp for follow-up actions."* That is **evidence the scripts may touch GHL and ClickUp**,
> tagged **INFERRED**. It is prose written by whoever built the automation, not the script body.
> The behaviour remains **UNKNOWN** until read.

### A4 — Vehicle Handover Completion Automation

| # | Field | Value |
|---|---|---|
| 1–3 | `wflDX47seBgvVTlQR` · Undeployed · `recordMatchesConditions` on **Vehicle Handover**, when `Handover Status` = Completed |
| 4–6 | Script bodies ×2 (`waceaC46JOzN5FdpP`, `wacb5DV94bunruEmZ`), inputs, outputs — **UNKNOWN** |
| 7 | Adjacent | `findRecords` Fleet → `updateRecord` Fleet `Vehicle Status` = **Available** → `findRecords` Contracts → **script 1** → `sendEmail` to owner inbox with the customer checklist attached → **script 2** |
| 8 | Touches | Known: Vehicle Handover, Fleet, Contracts. Script reach **UNKNOWN** |
| 9–11 | Changes data / external / business rule | **UNKNOWN** |
| 12 | Evidence artifact | ☐ TO CAPTURE |
| 13 | TMMT destination | Handover gate → `docs/business-rules/07`; status lifecycle → `05` — **UNKNOWN** |

> Relevant to `business-rules/05`: this is the only observed mechanism that writes
> `Vehicle Status` = Available, and it is **undeployed** — consistent with the finding that the
> status field is stale.

### A5 — New Payment Recorded Automation

| # | Field | Value |
|---|---|---|
| 1–3 | `wfldhpJXmBKJDIl6Q` · Undeployed · `recordCreated` on **Customer Payments** |
| 4–6 | Script bodies ×2 (`wacFGlRAMedur0iGK`, `wacQnx2ovjHm4zKuH`), inputs, outputs — **UNKNOWN** |
| 7 | Adjacent | `sendEmail` "Your Payment Receipt" (**customer-facing**, receipt attached) → `findRecords` Active Customers → `updateRecord` → scripts are the **final two** |
| 8 | Touches | Known: Customer Payments, Active Customers. Script reach **UNKNOWN** |
| 9–11 | Changes data / external / business rule | **UNKNOWN** |
| 12 | Evidence artifact | ☐ TO CAPTURE |
| 13 | TMMT destination | Collections / money meter — **UNKNOWN** |

> **Customer-facing if deployed.** VERIFIED: the `sendEmail` node has **no `to:` configured**.
> Whether it would send, and to whom, is **UNKNOWN**. Do not deploy to find out.

### A6 — Insurance Policy Expiry Notification and Renewal Flagging

| # | Field | Value |
|---|---|---|
| 1–3 | `wflZGHfX5X8elViHP` · Undeployed · `recordMatchesConditions` on **Insurance**, `Policy End Date` = one week from now (America/Chicago) |
| 4–6 | Script bodies ×2 (`wac9k4wZIAItT2TjN`, `wacaoUx2JkUxqf4EB`), inputs, outputs — **UNKNOWN** |
| 7 | Adjacent | `sendEmail` **to the insured customer** (`Insured Customer (Link)`) → `sendEmail` to renewal team → `updateRecord` Insurance Status → scripts are the **final two** |
| 8 | Touches | Known: Insurance. Script reach **UNKNOWN** |
| 9–11 | Changes data / external / business rule | **UNKNOWN** |
| 12 | Evidence artifact | ☐ TO CAPTURE |
| 13 | TMMT destination | Insurance renewal workflow — **UNKNOWN** |

### A7 — New Ticket Submission Automation

| # | Field | Value |
|---|---|---|
| 1–3 | `wfl74yJhnE424a9cn` · Undeployed · `formSubmitted` on **Tickets** (form `pagmI1Ls0pxKsaeKz`) |
| 4–6 | Script bodies ×2 (`wacEbhaEyX95jl2ow`, `wacUNLMd8SoPJ7BkF`), inputs, outputs — **UNKNOWN** |
| 7 | Adjacent | `findRecords` Employee Access Rights → `updateRecord` Tickets → `sendEmail` **to the submitting customer** → scripts are the **final two** |
| 8 | Touches | Known: Tickets, Employee Access Rights. Script reach **UNKNOWN** |
| 9–11 | Changes data / external / business rule | **UNKNOWN** |
| 12 | Evidence artifact | ☐ TO CAPTURE |
| 13 | TMMT destination | `/forms/ticket` + ticket workflow — **UNKNOWN** |

### A8 — Notify Customers of Waitlist Position Changes

| # | Field | Value |
|---|---|---|
| 1–3 | `wflgHokPQOZT0LPF4` · Undeployed · `recordUpdated` on **Waitlist**, watching `Status` |
| 4–6 | Script bodies ×2 (`wacAku0sj011IQi1t`, `wac1FJ6TpBFhu5mjQ`), inputs, outputs — **UNKNOWN** |
| 7 | Adjacent | `findRecords` up to **1000** Waitlist records with Status = Waiting → `sendEmail` **to every one of them** → scripts are the **final two** |
| 8 | Touches | Known: Waitlist. Script reach **UNKNOWN** |
| 9–11 | Changes data / external / business rule | **UNKNOWN** |
| 12 | Evidence artifact | ☐ TO CAPTURE |
| 13 | TMMT destination | Waitlist notification — **UNKNOWN** |

> ⚠️ **Highest blast radius if ever deployed.** A single status edit fans out email to up to
> 1,000 waitlist customers. Waitlist currently holds 104 records. This is the clearest argument
> for the §4.5 automation safety envelope: dry-run, affected-record preview, and a DNC check
> that fails closed.

---

## 3. `aiGenerate` automations — prompts RECOVERED

Unlike `customScript`, `aiGenerate` prompts **are** exposed by the API. Captured here; no UI
visit needed for the prompt itself.

### B1 — Expense Categorization and Monthly Totals Update

`wflSDSZ69uktC4jIk` · Undeployed · `recordCreated` on **Expenses** · `randomness: 0`

**Prompt (VERBATIM, RECOVERED):**
> "Categorize the new expense based on predefined rules using the following details:
> - Expense Type: `{Expense Type}` - Vendor / Payee: `{Vendor / Payee}` - Description:
> `{Description}` … Use these details to determine the most appropriate category for the expense."

Writes the model's response **back into `Expense Type`** (`fld7NU5ejnWhQs1Pm`) — the same field
it reads. Then aggregates the last month of expenses into an **Operation Costs** row named
"Monthly Expense Total".

> **"based on predefined rules" — those rules are not in the prompt.** The model is asked to
> apply a rule set that is never supplied. Whatever it produced was the model's own judgement.
> Flagged for `docs/business-rules/`: expense categorisation is currently **BUSINESS POLICY
> REQUIRED**, not an encoded rule.

### B2 — Customer Inspection Photos Automation

`wfljRbv8DVfyoQVpT` · Undeployed · `recordCreated` · `randomness: 0`

**Prompt (VERBATIM, RECOVERED):**
> "Analyze the 'Vehicle Photos' for any signs of damage and generate a summary report… Generate
> a detailed summary highlighting any visible damage or issues in the photos."

Reads Full Name, Date & Time, Odometer, Vehicle Name and the photo attachments; links the
inspection to a Fleet vehicle; writes a generated damage summary back to the record.

> **Damage assessment by generated summary.** If a condition report of this kind is ever used in
> a customer dispute, its provenance matters. Flagged alongside the other `aiText` fields for the
> counsel question already open in `business-rules/01`.

---

## 3a. What the native envelope already refuses

`src/lib/automation/` (Workstream B, P0 #3) encodes these findings as refusals, so the legacy
failure modes cannot recur natively even before the scripts are captured:

| Finding here | Native refusal |
|---|---|
| A8 fans out to up to 1000 waitlist records | `exceeds_max_affected` — every definition declares a cap, and the caller can declare a tighter one |
| A5 has a customer email with no `to:` | `no_recipients` — an unconfigured recipient list is a defect, not an empty send |
| 15 `customScript` bodies are UNKNOWN | `unported_script` — an action referencing an uncaptured script always refuses |
| 8 automations were live without a decision | `disabled` — definitions are off until switched on, and `dryRun` defaults to true |
| DNC has failed open once already | `dnc_check_missing` — customer contact requires a check, and a throwing check suppresses |

**This does not reduce the capture requirement.** The envelope refuses to run unknown logic; it
cannot tell you what that logic did. Gate condition in §5 stands unchanged.

## 4. Capture procedure

For each automation A1–A8, in the Airtable UI:

1. Open the automation → select the script node → **copy the full script body verbatim**.
2. Record the **Input variables** panel (names and their source field/node).
3. Record any **output variables** the script declares.
4. Screenshot the script editor showing the automation name and node — this is field 12.
5. Note every table, field, API endpoint, credential or external service referenced.
6. Answer fields 9, 10 and 11 **from the body**, not from the automation's name.
7. Where the UI does not make something certain, **write UNKNOWN**.

Store bodies under `evidence/automation-scripts/<automation-id>/<node-key>.js` with a sibling
`context.md` carrying fields 1–14.

> **Secrets:** a script may contain an API key or token. If one is found, **do not commit it** —
> record `CREDENTIAL PRESENT — see password manager`, and treat it as a Phase 0 §2.1 rotation
> item. This is a live possibility for A2, which appears to call an external CRM.

---

## 5. Gate condition

**Airtable automation logic preservation.** 8 script-bearing automations identified, containing
15 `customScript` bodies. Deployed script bodies and execution context must be captured from the
live Airtable UI before subscription cancellation. Unknown behaviour must remain explicitly
marked UNKNOWN until verified.

**No cancellation gate may pass while unrecoverable automation logic remains uncaptured.**

- [ ] A1 captured (**deployed — do first**)
- [ ] A2 captured (script is the only node)
- [ ] A3 captured
- [ ] A4 captured
- [ ] A5 captured
- [ ] A6 captured
- [ ] A7 captured
- [ ] A8 captured
- [x] B1 prompt recovered via API
- [x] B2 prompt recovered via API
- [ ] Each captured body classified: business rule / integration / notification / transformation / other
- [ ] Any business rule found is folded into `docs/business-rules/`
- [ ] Any credential found is routed to Phase 0 §2.1 rotation
