# CLAUDE.md — Rules of Engagement

Project: **TMMT / AIXMOS operational platform**
Owner: **Muhammad Taha**, founder & CEO, TMMT Auto Services LLC (operates publicly as "X" / AIXMOS)
Read alongside: `01-BUSINESS-BLUEPRINT.md`, `02-CURRENT-STATE-AUDIT.md`, `05-OPEN-DECISIONS.md`

---

## 1. Who you are working with

The owner is a business strategist, **not a developer**. He will describe outcomes in
business language and may use technical terms imprecisely. That is expected and fine.

**Your job:** translate business intent into technical requirements, make the ordinary
engineering decisions yourself, and explain them in plain English.

- Do not ask him to choose a framework, a schema shape, or a library.
- Do not hand him technical questions dressed up as business questions.
- Do ask when a real business decision is required (price, split, eligibility rule,
  partner responsibility, legal posture).
- Lead with the answer or the command. Explanation second. Keep prose short.
- Prefer one-shot, copy-pasteable commands over multi-step walkthroughs.

## 2. The prime directive: do not invent the business

When you produce anything — code, schema, a doc, a plan — every business rule in it
must be classifiable as one of three things, and **labeled**:

| Label | Meaning |
|-------|---------|
| `[STATED]` | The owner explicitly said this. |
| `[RECOMMENDED]` | Your professional recommendation, not yet approved. |
| `[OPEN]` | Requires a business decision. Not yet answered. |

Never silently pick a number. "The deposit is $500" is a violation.
"Deposit is `[OPEN]` — currently seeded at $400 for economy in `rental_pricing_rules`;
recommend keeping it configurable per tier" is correct.

Values already sitting in the production database are **not** automatically `[STATED]`.
Several were seeded during a build and have never been confirmed as real. Treat any
un-confirmed seeded value as `[OPEN]` and list it in `05-OPEN-DECISIONS.md`.

## 3. Brownfield discipline

A live system exists with real customer data (see `02-CURRENT-STATE-AUDIT.md`).

**Before building anything, check whether it already exists.** The order is:

1. Search the existing Supabase schema and the Airtable base.
2. Search the existing repos and deployed Vercel projects.
3. Only then propose new construction.

**Prohibited without an approved change request:**

- Dropping or renaming tables that hold rows
- Deleting or archiving repos
- Migrating or bulk-rewriting business data
- Rotating credentials without a written recovery plan
- Sending any external message (SMS, email, call) to a real contact
- Publishing anything publicly
- Modifying the CRM (GoHighLevel) records
- Deploying an autonomous agent that can act without a human in the loop
- Standing up a second orchestrator / queue / monitoring stack when one exists

## 4. Change request format

Any destructive or business-impacting change requires `CHANGE_REQUEST_<n>.md` with:

```
CURRENT      → what exists now, with evidence (table, row counts, file paths)
PROPOSED     → what you want it to become
WHY          → the business reason, not the technical one
DEPENDENCIES → what else touches this
RISK         → what breaks if this is wrong
ROLLBACK     → the exact steps to undo it
```

Owner approves before execution. No exceptions.

## 5. The owner gate

These actions are **always** owner-approved, never automated, regardless of how
confident the system is:

- Money movement of any kind (payouts, refunds, charges, deposits)
- Eligibility / qualification / denial decisions on a person
- Anything touching credit, funding, insurance, or a background check outcome
- Contract execution, title, registration, or vehicle ownership transfer
- Legal or compliance filings
- External communication to a customer, partner, or the public

Compliance actions additionally carry a **co-approver** (Umar) where the existing
compliance flags require it.

Automating *administrative work* (reminders, task creation, document collection,
status roll-ups, report generation) is encouraged.
Automating *decisions* is not, unless explicitly designed, validated, and approved.

## 6. Compliance is a design input, not a later step

This platform touches driver identity, background checks, insurance, credit repair,
business funding, and payments. Flag — do not quietly implement — anything involving:

- **FCRA** — background checks, consumer reports, adverse action notices
- **CROA** — credit repair services, disclosures, cancellation rights, fee timing
- **TCPA** — SMS/call outreach, consent, opt-out honoring
- **State insurance regulation** — selling, placing, or being compensated for insurance
- **Graves Amendment** and state rental liability law
- **PII / PCI** — driver's licenses, SSNs, card and bank data

When you hit one of these, stop and write what needs professional legal review.
"Technically possible" is not "should build."

**Also non-negotiable: TMMT must never be represented as performing a service that a
partner actually performs.** The system tracks referral, handoff, and outcome. It does
not claim the work.

## 7. Working method — every feature, in order

1. **Business objective** — what problem does this solve?
2. **Workflow** — who does what, when, and what happens next?
3. **Data** — what must be stored, and where does it already live?
4. **Users & permissions** — who can see, edit, approve?
5. **Integrations** — what specialist service should own this instead of us?
6. **Automation** — what is safe to automate (admin work only)?
7. **Compliance & security** — flag anything in §6.
8. **UX** — simple enough for non-technical staff and customers.
9. **Build incrementally** — smallest shippable slice.
10. **Test against the business** — does this actually make operations better?

## 8. Buy, don't build

Do not hand-roll an accounting ledger, a payments processor, a background-check
engine, an e-signature system, or a messaging platform. Integrate. The architecture's
job is to make those swappable, and to hold the *relationships and status* that no
vendor will hold for us.

## 9. Configuration over hard-coding

Every one of these must be data, not code: pricing, deposits, rental durations, late
fees, qualification thresholds, investor splits, management fees, referral
compensation, insurance requirements, vehicle eligibility, status names, workflow
stages, permissions, geographic coverage.

If the owner would ever want to change it without calling an engineer, it is config.

## 10. Relationship, not transaction

A person who does not qualify today is not a dead lead. Never delete, never discard.
Every person carries a lifecycle, a reason for their current state, and a next step.
The "doesn't qualify" pipeline is a first-class part of this system, not an afterthought.
