# OWNER DECISION — 2026-09-16 — CLIENT SELF-SERVICE VISIBILITY

**Status: DECIDED by the owner. Not yet implemented. No migration written. No production change made.**

Companion to `CUSTOMER_2_DATA_POLICY.md` and `CUSTOMER_2_READINESS.md`.

---

## THE DECISION, AS GIVEN

> *"yes a client can see their own background check once it comes back and see their
> own payments they have made."* — Taha, 2026-09-16

Read literally, three constraints are carried in that sentence and all three are binding:

1. **Their own only.** Not the org's. Not anyone else's. One person, one record.
2. **Once it comes back.** After a decision exists — not while screening is pending.
3. **Payments they have made.** Their own payment history, not the operator's ledger.

---

## WHO "CLIENT" MEANS HERE — AND WHY IT MATTERS

This decision is about the **renter** — the person who applied, got screened, and pays.
It is the third layer of the debut journey (lead → org member → **client**).

It is **not** the same question as the one left open in `CUSTOMER_2_DATA_POLICY.md`,
which asks what a *Customer #2 organisation member* (the rental operator buying TMMT OS)
may read. The phrase "payments they have made" settles it: an operator does not make
payments, a renter does.

> **STILL OPEN — separate decision required.** May a Customer #2 org member read their
> organisation's background checks and payments? That question is untouched by this
> decision and still blocks P0-1 in `CUSTOMER_2_READINESS.md`.

---

## THE STRUCTURAL FINDING — THERE IS NO IDENTITY TO SCOPE BY

Verified read-only against production on 2026-09-16:

`background_checks` and `customer_payments` carry **no `user_id`, no `auth_user_id`,
and no foreign key to `auth.users`.** They key on:

| Table | Identity columns present |
|---|---|
| `background_checks` | `customer_name`, `phone_number`, `email`, `customer_id` (bigint), `lead_id`, `org_id` |
| `customer_payments` | `customer`, `customer_name`, `customer_phone_number`, `incoming_lead_id`, `org_id` |

**A renter has no account in this system and never has had one.** So "their own" cannot
be expressed as `auth.uid() = row.user_id`. There is nothing to compare.

Any implementation that begins by adding renter logins is building an authentication
system to answer a question the codebase already answers another way.

## THE MECHANISM — REUSE WHAT IS ALREADY BUILT AND ALREADY HARDENED

`background_checks` and `active_customers` both already carry:

```
license_upload_token             uuid
license_upload_token_expires_at  timestamptz
```

`src/app/forms/license-upload-actions.ts` already implements the full pattern: a
**staff-minted, expiring, single-subject token** matched server-side on token **and**
expiry, behind a server action, with the raw row never crossing to the client.

That is exactly the primitive this decision needs, it is in production, and it was
built for precisely this trust boundary. **Reuse it. Do not build renter auth.**

Shape of the work (not yet written):
- A security-definer RPC / server action that takes a token, resolves **one** row, and
  returns a **narrow projection** — never `select *`.
- The admin-only table policies from `20260828000000_sensitive_tables_admin_only.sql`
  stay **exactly as they are**. This decision requires no widening of any RLS policy.
- Tokens are minted by staff, expire, and are single-subject.

---

## WHAT THE RENTER SEES — PROTECTIVE DEFAULT APPLIED

The owner said "their own background check." That phrase spans two very different
payloads, and the difference is legal, not cosmetic. Applying the most protective
reading until told otherwise:

### SHOWN — the decision
- screening outcome (eligible / not eligible)
- `reason_code` — **but only where the taxonomy permits it.** See the hard gate below.
- `date_verified`
- document presence flags — *"insurance received", "paystub received"* — so they can
  chase what is missing

### WITHHELD — pending owner + counsel sign-off
- `background_check_screenshot` — the screening vendor's consumer report
- `key_details_extracted_from_screenshot` — derived from that report
- `review_notes` — **internal staff deliberation, never customer-facing under any reading**
- `driver_s_license`, `paystub`, `proof_of_insurance` raw payloads — these are the
  renter's own documents, but re-exposing them through a link widens the attack surface
  on the most sensitive PII in the system for no stated business need

### ⚖️ NEEDS LICENSED REVIEW
Showing a consumer their own screening report, and declining someone on the basis of
one, engages **FCRA adverse-action** duties — notice content, the source of the report,
and the right to dispute. The withheld list above is the safe side of that line. Before
any screening *report* content is shown to a renter, or any decline notice is worded,
a bar-licensed human must review it. **I have not drafted adverse-action language and
should not.**

Nothing in the SHOWN list depends on that review. Build that half now.

### Payments — unambiguous, no legal fork
Their own payment history: `last_payment_date`, `amount`, `payment_status`,
`next_payment_due_date`, `payment_method` (masked — method type only, never an account
identifier), and their own receipts. Scoped to one customer by the same token.

---

## 🔴 THE REASON-CODE GATE — DO NOT SHIP WITHOUT THIS

Verified live 2026-09-16. `reason_categories` holds 8 seeded rows, and the flag
`customer_msg` is already decided per category:

| category | recoverable | customer_msg |
|---|---|---|
| `DOCUMENT_ADMIN` | yes | **true** |
| `MANUAL_REVIEW` | yes | **true** |
| `CREDIT_FINANCIAL` | yes | **true** |
| `TEMPORARY_PROGRAM` | yes | **true** |
| `RISK_POLICY` | no | **true** |
| `DNC_DNR` | no | **FALSE** |
| `FRAUD_SECURITY` | no | **FALSE** |
| `OTHER` | yes | **FALSE** |

**Three of the eight categories must never reach the renter.** Showing a reason whose
category is `customer_msg = false` would tell someone they are on a do-not-rent list,
or that they are under a fraud/security escalation. That is a disclosure with legal and
physical-safety consequences and it must be structurally impossible, not merely avoided
in the happy path.

**Required behaviour:** the projection joins `reason_categories` and returns the reason
only when `customer_msg = true`. Otherwise it returns a neutral status and says nothing
about why. **This is a fail-closed test, and per the house doctrine it does not count as
built until it has been watched refusing a `DNC_DNR` row.**

The column is `reason_categories.category` (not `code`).

**Note:** `reason_codes` — the finer per-code table beneath these categories — is
**empty (0 rows, verified same day)**. Until it is seeded, category-level is the only
granularity that exists. Do not write code that assumes a code-level message exists.

---

## WHY THIS IS THE CHEAP PATH

- Zero RLS changes. The August hardening stays untouched.
- Zero new auth surface. No renter accounts, no password resets, no new session risk.
- The token pattern, the reason-code taxonomy with customer-safe messages, and the
  document-presence flags **already exist**. This is wiring, not construction.
- It is reversible: a token can be revoked by clearing one column.

---

## WHAT THIS DOES *NOT* UNBLOCK

The debut still needs the other two journeys, which this decision does not touch:

- **New org member** — `org_roles` has 1 row system-wide, `signup_invites` has 0. A
  scoped tenant user has never existed. Still unproven.
- **P0-1 / Customer #2 org member access** — still an open owner decision (see above).
- **Bookings** — `bookings` has 0 code references and 0 rows. The rental core the app is
  named after is still not wired.

---

*Recorded 2026-09-16. Figures read live from production `uapxakmlwnpfsftfeezx`,
read-only, same day. No production writes were made in producing this record.*
