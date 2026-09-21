# 06 — MVP: The Core Business Operating System

**Goal:** run the rental business from one system. Not the whole ecosystem — the spine
that every later phase attaches to.

Because this is brownfield, "build the MVP" mostly means **finish and consolidate what
exists**, not create it. Each item below shows what already exists so the work is
scoped honestly.

---

## MVP scope

### 1. People / CRM
People · customers · leads · contact information · source · notes · communication history.

*Exists:* `people` (1,209), `incoming_leads` (875), `ghl_contacts` (1,642), full UTM and
source capture.
*Work:* **reconcile the three stores into one person spine.** This is the single
largest MVP task and everything else depends on it.

### 2. Rental applications
Application · customer information · driver information · required information ·
application status · qualification workflow · staff review.

*Exists:* `incoming_leads` + `background_checks` (299) with per-check status fields.
*Work:* a unified qualification decision record (which checks passed, which failed, who
decided, when) and a **disqualification reason** field with a controlled vocabulary.

### 3. Document management
Required documents · upload · verification status · expiration dates ·
customer/vehicle association.

*Exists:* `documents` table (0 rows); real documents live as Airtable attachments.
*Work:* stand up the document entity properly and migrate off attachment-only storage.
**Do this together with the FCRA and credentials remediation in Roadmap Phase 0** —
they touch the same data.

### 4. Vehicles
Vehicle records · ownership · availability · status · basic vehicle history.

*Exists:* `fleet` (43) with inspections, maintenance, expenses, tickets, handover.
*Work:* replace free-text `partner_name` with a real owner foreign key. Vehicle history
must be records with validity periods, not overwritten current-value fields.

### 5. Rentals
Customer · vehicle · rental dates · status · agreement tracking · basic payment status.

*Exists:* `active_customers` (35) is doing this job informally; `contracts` has 2 rows
against 16 active renters.
*Work:* make the rental a first-class object separate from the vehicle and the person,
and close the contract-of-record gap.

### 6. Staff tasks
Assign · due dates · status · follow-ups.

*Exists:* three competing stores — `exec_va_tasks` (17,192), `tasks` (0),
`clickup_tasks` (0).
*Work:* pick one, retire the others, and audit what generates the 17,192.

### 7. Basic communications
Email/SMS notifications · application notifications · missing-document reminders ·
staff and customer communication history.

*Exists:* `comm_channels` (4), `do_not_contact_numbers` (10), GHL as the send layer.
*Work:* one communication log visible from the person's profile. **Blocked until the
opt-out gate has a fails-closed regression test.**

### 8. Basic dashboard
Management sees, immediately: New Leads · Applications · Applications Awaiting Review ·
Qualified · Not Qualified · Active Rentals · Available Vehicles · Vehicles Needing
Attention · Upcoming Expirations · Tasks.

*Exists:* ops surfaces on Vercel (`tmmt-ops`, `tmmt-command-center`).
*Work:* these counts are only trustworthy once status is populated — today 87% of leads
have a null status, so the dashboard currently cannot be believed.

### 9. Basic non-qualified pathway
`Not Qualified → Reason → Potential alternative path → Follow-up / referral`

**In the MVP: the reason and the follow-up only.** Do not build the credit, business
formation, or funding ecosystem in version 1 — but design the foundation so it attaches
later without a rewrite. The `journey_checkpoints` and `programs` scaffolding already
in the database is that foundation.

---

## Explicitly NOT in the MVP

Investor portal and payouts · the full credit/business/funding pipeline · partner
settlement · telematics · predictive scoring · the operator marketplace · accounting
integration.

Each of these has a later phase in `04-ROADMAP.md`. Two caveats:

- **The investor side is Phase 2, not "later."** It is the highest-value gap and the
  one place where money currently moves without a ledger. It sits outside the MVP only
  because it depends on the person/vehicle spine the MVP establishes.
- **Nothing in Roadmap Phase 0 is optional or deferrable**, MVP or not. The plaintext
  credentials, the consumer-report handling, and the opt-out gate are remediations, not
  features.

---

## MVP exit criteria

- One person record per human, across all three stores
- Every lead carries a non-null status
- Every denial carries a structured reason
- Every active rental traceable end-to-end: lead → application → qualification →
  vehicle → contract → payment
- Every vehicle has a real owner reference
- One task store, one communication log, one document store
- The admin dashboard's numbers reconcile against the underlying tables
