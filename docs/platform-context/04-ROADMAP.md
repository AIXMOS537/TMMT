# 04 — Phased Roadmap

Brownfield-aware. The vision doc's Phase 1–6 assumed a greenfield build; because ~70%
already exists, Phase 0 is reconciliation, not construction.

Nothing in a later phase starts while an earlier phase's **exit criteria** are unmet.

---

## Phase 0 — Contain & Reconcile *(do this first, no exceptions)*

**Goal:** make the existing system trustworthy and safe before adding to it.

| # | Work | Why |
|---|---|---|
| 0.1 | **Remove plaintext credentials** from Airtable `Insurance` (`LOGIN EMAIL/PASSWORD/PHONE`) into a secrets manager | Active security exposure |
| 0.2 | **Lock down consumer-report data** — restrict access to `Background Checks` attachments; document the FCRA handling and adverse-action process; review the AI extraction field | Regulatory exposure |
| 0.3 | **Regression-test the TCPA opt-out gate** — assert `do_not_contact_numbers` fails *closed*. Block all outbound automation until green | It previously failed open |
| 0.4 | **Declare the system of record** in writing — which system wins per entity per field (Supabase / Airtable / GHL). Publish as `SYSTEM_OF_RECORD.md` | Everything downstream depends on this |
| 0.5 | **Reconcile the identity spine** — one `person` per human across `people`, `incoming_leads`, `ghl_contacts` | Currently three stores, 3,700+ rows, unknown overlap |
| 0.6 | **Fix tenant IDs** — one org ID for TMMT; remove the "Pilot Motors (smoke)" test tenant from production | Org-scoped queries silently miss data |
| 0.7 | **Confirm or void the seeded business rules** — pricing, deposits, insurance products, credit paths (see `05-OPEN-DECISIONS.md`) | Staff may be acting on unconfirmed numbers |
| 0.8 | **Audit `exec_va_tasks`** (17,192 rows) — what generates them, what acts on them, what should be turned off | Automation of unknown value and unknown risk |
| 0.9 | **Contract-of-record gap** — establish why only 2 of 16 active rentals have a contract row, and backfill | Legal and revenue exposure |
| 0.10 | **Move off Vercel hobby tier** for anything production | Availability risk |

**Exit criteria:** no plaintext credentials in any business database · opt-out gate
test green in CI · `SYSTEM_OF_RECORD.md` merged · one org ID · every seeded price and
product either confirmed or deactivated · every active rental has a contract row.

---

## Phase 1 — Close the operational loop

**Goal:** the rental business runs on the system rather than around it.

- `disqualification_reason` field + controlled vocabulary → **wired into the denial flow**
- Unified `status_event` log; backfill what can be inferred; stop writing status to
  scattered fields
- Status configuration table so statuses change without a deploy
- Qualification decision record: which checks passed, which failed, who decided, when
- Document entity with type, expiry, verification status, and record-level permissions —
  migrating off attachment-only storage
- Staff task queue consolidated to **one** store (not three)
- Owner approval queue surfaced as an actual screen

**Exit criteria:** every lead has a non-null status · every denial has a reason code ·
every active rental traceable end-to-end from lead through contract to payment.

---

## Phase 2 — The investor side *(highest business value)*

**Goal:** TMMT can tell an owner what their vehicle earned and pay them correctly.

1. `vehicle_owners` entity; human-reconcile the 21 free-text names into real owners
2. `fleet.owner_id` foreign key; backfill and verify against the reconciled list
3. `owner_agreements` — split terms, management fee, maintenance responsibility,
   term dates, signed document `[OPEN: terms are the owner's to state]`
4. Revenue attribution: which payment belongs to which vehicle and period
5. Expense attribution against the same
6. `owner_statements` — per owner, per period: revenue, expenses, fee, net
7. `payouts` — with an owner-gate approval before any money moves
8. **Investor dashboard** — vehicles, current renter, revenue, expenses, net,
   utilization, maintenance, payouts, statements, documents, history
9. Owner login via the existing `partner_fleet_access` mechanism

**Exit criteria:** a statement can be generated for every vehicle with a known owner,
and reconciles against the accounting platform.

---

## Phase 3 — The progression pipeline goes live

**Goal:** Pathway 2 and 3 carry real people. Blocked on partner decisions, not code.

- `[OPEN → decide first]` Which credit partner. The only record in the system is
  deactivated; there is no active credit capability configured.
- `[OPEN → decide first]` All In One Management's exact scope and responsibilities.
- `[OPEN → decide first]` Funding partners.
- Then build: `partner` + `partner_agreement` + `referral` with outcome tracking ·
  referral handoff and status-back · milestone tracking against the existing
  `journey_checkpoints` · re-assessment workflow · customer-facing progress view

**Compliance gates before any of this reaches a real person:** CROA disclosure flow
verified against the enrollment path · fee timing reviewed by counsel · partner
attribution copy reviewed so TMMT never claims partner-performed work · no timeline or
outcome guarantee anywhere in the UI or in any automated message.

**Exit criteria:** a denied applicant is automatically offered a next step, referred,
tracked, and re-assessed — with legal sign-off on the customer-facing language.

---

## Phase 4 — Administrative automation

Only after Phase 0.3 and 0.8. Administrative work only, per `CLAUDE.md` §5.

Reminders (document, verification, renewal, insurance, maintenance, payment) ·
follow-up cadences · investor report generation · partner referral notifications ·
progress notifications · re-assessment triggers · staff task creation · escalation.

Every automated send passes the consent gate. Every automation has an off switch and
an audit trail.

---

## Phase 5 — Integrations

Payments · accounting · background checks · driver/platform verification · insurance
placement · e-signature · messaging · funding. `[OPEN]` vendor selection per `05` §5.

Integration rule: the vendor owns the specialist function; TMMT owns the relationship,
the status, and the reconciliation.

---

## Phase 6 — Intelligence

Only meaningful once Phases 0–2 produce clean data. Lead scoring · customer scoring ·
utilization optimization · revenue forecasting · maintenance forecasting · business
intelligence.

**Do not build predictive scoring on top of a dataset that is 87% null.**

---

## Sequencing summary

```
Phase 0  Contain & Reconcile        ← blocks everything
Phase 1  Close the operational loop ← needs 0.4, 0.5
Phase 2  Investor side              ← needs 1 (status/identity); highest $ value
Phase 3  Progression pipeline       ← blocked on partner decisions, not code
Phase 4  Automation                 ← needs 0.3, 0.8
Phase 5  Integrations               ← needs vendor decisions
Phase 6  Intelligence               ← needs clean data from 0–2
```
