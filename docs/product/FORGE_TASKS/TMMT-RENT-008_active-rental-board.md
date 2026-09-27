# TMMT-RENT-008

## TASK ID
TMMT-RENT-008

## TITLE
Active rental board: every ACTIVE rental shows vehicle, agreement, verified balance and next due date from one source, with reminders staged through the gateway

## PM MILESTONE
PM-09 Active rentals (roadmap: "the active-rental view, reminders via PM-18"; exit "every active rental shows vehicle, agreement, verified balance and next due date, from one source")

## OBJECTIVE
Staff see the live book of rentals with truthful money and paperwork state, and can stage (not send) the due-payment and return reminders.

## WHY (evidence refs)
- SPEC §8.2, §23.2 (Rentals nav), §23.4 (widgets: "Payments due today / overdue (verified)" = NEW BUILD; "Returns due this week" `bookings.ends_at`), §22.3 #7 ("Pending verification" visible); ROADMAP PM-09; E2 §1.3 (`/bookings` board reads).

## CURRENT BEHAVIOR (file:line)
- `/bookings` board (RENT-007 extends it); no active-rental view; money from unverified `customer_payments`.

## EXPECTED BEHAVIOR
- `/bookings/active` (or a tab): ACTIVE bookings with vehicle (view from RENT-005), agreement instance + hash (DOC-002), verified balance and next due (PAY-001's model; interim: reconciliation rows), return date; "Pending verification" badges where evidence is missing.
- Actions: stage `payment_due` and `return_reminder` via `stageMessage` (COMM-006); no send.
- `sweep_payment_due_notices` re-pointed through `stageMessage`'s template (staged SQL) so DB-queued notices share the template and consent path.

## FILES (in scope)
`src/app/(admin)/bookings/active/*` (+ tests), `src/lib/rental/active-queries.ts` (+ test), staged SQL for the due-notice sweep re-point + rehearsal; route registry rows.

## DATABASE ENTITIES
Read: `bookings`, `rental_events`, vehicle state view, `contract_instances`, `documents`, money tables per PAY-001; write: `automation_outbox` via the stager. Function behind `sweep-payment-due-notices` (staged).

## DEPENDENCIES
TMMT-RENT-005/007, TMMT-DOC-002, TMMT-PAY-001, TMMT-COMM-006, TMMT-HAND-001 (ACTIVE exists).

## CONSTRAINTS
No sends. No money writes. Server-side reads (SSR user client), not the browser anon client.

## SECURITY REQUIREMENTS
Org-scoped; hostile/other-org tests; no PII beyond what the board needs.

## IMPLEMENTATION NOTES
One query function; the page renders four states; 375 px usable.

## ACCEPTANCE CRITERIA (testable)
1. An ACTIVE fixture shows all five facts from one query (fails pre-fix: no view).
2. Missing evidence → "Pending verification" badge.
3. Reminder action stages a row with the correct template and approval state; nothing sends.
4. Full gate passes.

## TESTS (must fail on the pre-fix code)
`active-queries.test.ts` (real request shape / rehearsal); page state tests; rehearsal for the sweep re-point.

## DO NOT CHANGE
The transition matrix; senders; prod.

## OWNER GATE
Prod baton for the staged sweep change. Merge = deploy: owner + baton.
