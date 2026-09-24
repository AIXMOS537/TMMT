# Owner Decision Pack

Everything currently blocking the TMMT program, turned into questions you can **answer**
rather than author. Compiled 2026-09-22 from live reads. Nothing here was invented; where a
number appears, it was counted.

| # | Decision | Effort | Unblocks |
|---|---|---|---|
| 1 | Screening policy | ~20 min | Rules engine, every client install |
| 2 | Partner splits | ~15 min | Partner earnings, payout math |
| 3 | §7 deferral register | ~5 min | Schema choices in remaining build |
| 4 | CR-003 authorization | ~5 min | P0 #2, Gate 2 |
| 5 | Script capture (UI work) | ~45 min | Gate 4, cancellation |

---

## 1. Screening policy — the question changed

**I was wrong about what this decision is, and the correction makes it easier.**

I previously said the eligibility truth table "existed only in an operator's head." VERIFIED
2026-09-22, both systems:

| Signal | Airtable populated | Supabase populated |
|---|---:|---:|
| `Background Check Status` | **0** | **0** |
| `Insurance Check Status` | **0** | **0** |
| `Earnings Verification Status` | **0** | **0** |
| `Eligibility Status` (the verdict) | **233** of 304 | **232** of 299 |

**The three signals were never recorded. Not once, in either system.** So there is no truth
table to recover, and you are not being asked to remember one. The three-signal model is a
structure that was designed and never used; 233 decisions were made entirely outside the
system and only the verdict was written down.

**This is not a migration failure** — both sides agree at zero.

### What was actually decided (299 Supabase rows)

| Decision | Records | Share |
|---|---:|---:|
| Eligible | 81 | 27% |
| **Need Manager's Review** | **69** | **23%** |
| *(blank — never decided)* | 67 | 22% |
| out of radius | 49 | 16% |
| Not Eligible | 24 | 8% |
| Not found | 9 | 3% |

Two things worth your attention. **Nearly a quarter escalated to manager review** — whatever
the rule is, it left a lot undecided. And **`out of radius` is 16%** — a geographic filter
doing more work than the "Not Eligible" verdict itself, which argues for making service area
an explicit early check rather than an eligibility outcome.

### ☐ DECISION 1A — what are the inputs?

The three legacy signals are unused. Options:

- ☐ **Keep all three** and start actually recording them
- ☐ **Keep some** — which: ☐ background check ☐ insurance ☐ income
- ☐ **Replace** with a different set (name them)
- ☐ **Drop** and screen some other way

### ☐ DECISION 1B — what is the rule?

Once 1A is answered, state the mapping. Example shape (**illustrative only — not a
recommendation**): *"All required checks Verified → Eligible. Any Failed → Not Eligible. Any
Pending → Need Manager's Review."*

Your rule: ______________________________________________

### ☐ DECISION 1C — service area

Should out-of-area be checked **before** screening (a separate gate) rather than being an
eligibility verdict? ☐ yes ☐ no — service area definition: ______________

### ☐ DECISION 1D — mandatory documents

283 of 304 carry a licence; 269 carry a paystub. Records advanced with incomplete sets.
Which are **mandatory**? ☐ licence ☐ proof of insurance ☐ income ☐ background report

> Once 1A–1D are answered, `decideEligibility()` stops throwing and every client install
> inherits a defined gate. This is the single highest-leverage decision in the program.

---

## 2. Partner splits — 19 real decisions, not 36

36 vehicles have no `partner_percentage`. Grouped by partner name, most of that collapses.

### 2A — Company-owned: 10 vehicles, one batch answer

`TMMT Rentals` (8) · `TMMT` (1) · `Tmmt ` (1, trailing space)

2013 Lexus RX450H · 2015 Chevy Equinox · 2017 FORD FUSION · 2018 TOYOTA COROLLA ·
2018 VOLKSWAGEN ATLAS · 2019 TESLA MODEL 3 · 2020 BMW X3 (White) · 2022 FORD ESCAPE ·
2022 TOYOTA RAV4 · 2024 TOYOTA CAMRY

☐ **All 10 are company-owned — mark "no partner"** (expected answer; one tick)
☐ Some have a partner — list them: ______________

> Three spellings of the company name is itself a data-quality item; canonicalise on migration.

### 2B — Named partners: 19 vehicles, 12 partners

**Partners are identified by the vehicles they own, not by name.** `CLAUDE.md` forbids
third-party data in git, and a split-per-partner worksheet does not need names to be
answerable — you know who owns what. Keep any name mapping in your own notes, not in this file.

| Partner | Vehicles they own | Split? |
|---|---|---|
| **A** (4) | 2015 Prius *(Retired)* · 2016 Corolla · 2017 Camry Brown · 2017 Camry SE Black | ______ |
| **B** (3) | 2013 Prius C Red *(Retired)* · 2017 Hyundai Accent · 2019 Kia Rio *(Retired)* | ______ |
| **C** (2) | 2017 Corolla (Red) · 2020 Corolla (Red) | ______ |
| **D** (2) | 2014 Prius 2 *(Retired)* · **2024 Honda CRV** | ______ |
| **E** (1) | 2019 Nissan Versa | ______ |
| **F** (1) | 2019 Dodge Caravan | ______ |
| **G** (1) | 2015 Honda Accord *(Coming Soon)* | ______ |
| **H** (1) | 2017 Toyota Sienna *(Coming Soon)* | ______ |
| **I** (1) | 2014 Ford Focus | ______ |
| **J** (1) | 2023 Mitsubishi Outlander *(Coming Soon)* | ______ |
| **K** (1) | 2013 Toyota Corolla | ______ |
| **L** (1) | 2025 Toyota Camry | ______ |

Values on file elsewhere: **0.60, 0.65, 0.70** (decimals, never 70).
One answer per partner covers all their vehicles unless they differ.

> **E and F look like the same partnership recorded twice** — the two stored names are the same
> pair of people in opposite order, one vehicle each. Confirm: ☐ same partner ☐ genuinely different
>
> **Partner D's 2024 Honda CRV is the vehicle whose insurance record holds the plaintext
> credential** (Phase 0 §2.1). Unrelated to the split, but the same row is waiting on your
> carrier rotation.

### ☐ DECISION 2D — the churn threshold

`Owner Net After Note / Month` near zero or negative predicts the partner quits in month 2.
"Near zero" was never a number. Yours: **$______ / month**

---

## 3. §7 deferral register — 8 ticks

Each is **deferred, not excluded**. Confirm the classification and the cheap
keep-the-door-open decision. Detail: `TMMT-AIRTABLE-CAPABILITY-MATRIX.md` §7.

| # | Capability | Defer? | Keep path open via |
|---|---|---|---|
| 7.1 | User-defined tables/fields | ☐ | Typed field registry; no ad-hoc JSON on core tables |
| 7.2 | Scripting facility *(porting is REQUIRED — see §5)* | ☐ | Typed action catalogue |
| 7.3 | Personal vs shared views | ☐ | `owner_user_id` on `saved_views` from day one |
| 7.4 | Marketplace / extensions | ☐ | Build the API as if a third party will consume it |
| 7.5 | Gantt / timeline | ☐ | `starts_at`/`ends_at` + status transition history |
| 7.6 | External sync | ☐ | General provenance columns |
| 7.7 | Comments / collaboration | ☐ | Stable UUID PKs for polymorphic attachment |
| 7.8 | Presentation minutiae | ☐ | View config as JSONB |

☐ **All eight confirmed as written** — or note exceptions: ______________

---

## 4. CR-003 — read the SQL, then authorize

The migration is written and staged at
`supabase/migrations/_staged/20260922000000_attachment_provenance_STAGED.sql`.
`supabase db push` ignores `_staged/`, so **it cannot apply itself**.

It adds 12 provenance columns to `documents` and `vehicle_media`, makes
`vehicle_media.customer_email` nullable, adds idempotency indexes, and creates 7 **private**
buckets. All three tables hold 0 rows, so there is no backfill and rollback is clean.

Seven postcondition queries are in the file — per CLAUDE.md, `success: true` is not proof.

☐ **Authorized** — and Gate 0's offline archive exists first
☐ Changes needed: ______________

> Order matters: archive → CR-003 → counsel retention rule → extraction. Applying CR-003
> after extraction makes rollback a question about what happens to extracted files.

---

## 5. Script capture — 45 minutes in the Airtable UI, and it expires

15 `customScript` bodies across 8 automations. The API returns `inputs: {}` for every one and
the base export excludes automation definitions, so **cancelling the subscription destroys
them**. Full 14-field schema: `evidence/automation-logic-capture.md`.

Work in this order — the first two carry the most unknown:

| # | Automation | Why first | Done |
|---|---|---|---|
| A1 | New Lead Notification and Status Update | **The only DEPLOYED one.** 2 scripts, every new lead | ☐ |
| A2 | Update GoHighLevel Pipeline Stages | Script is the **only node** — 100% unknown, external CRM | ☐ |
| A3 | Background Check Completion | 2 scripts | ☐ |
| A4 | Vehicle Handover Completion | 2 scripts | ☐ |
| A5 | New Payment Recorded | 2 scripts | ☐ |
| A6 | Insurance Policy Expiry | 2 scripts | ☐ |
| A7 | New Ticket Submission | 2 scripts | ☐ |
| A8 | Notify Customers of Waitlist Position | 2 scripts | ☐ |

Per script: copy the **body verbatim**, the input-variable panel, any output variables, and a
screenshot. Save to `evidence/automation-scripts/<automation-id>/<node-key>.js`.

**If a script contains an API key: do not paste it into the repo.** Write
`CREDENTIAL PRESENT — see password manager` and treat it as a Phase 0 §2.1 rotation item.
A2 is the live candidate — it appears to call an external CRM.

Where the UI does not make something certain, **write UNKNOWN**. A plausible guess recorded as
fact is the failure this register exists to prevent.

---

## Still owner-only, not in this pack

Carrier credential rotation · offline archive · true infrastructure cost · Zapier/GHL console
inventory · counsel retention rule · where the executed rental agreements live. Tracked in
`evidence/README.md`.
