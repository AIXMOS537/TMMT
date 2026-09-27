# TMMT-DOC-002

## TASK ID
TMMT-DOC-002

## TITLE
Agreement rendering into `contract_instances` + `documents` with a content hash (no signing yet), and the signing-provider ADR

## PM MILESTONE
PM-07 Agreements and e-sign (roadmap new-build: "Templates and rendering with a content hash"; "OWNER DECISION on the signing provider, ⚖️ legal review of the templates")

## OBJECTIVE
The AGREEMENT_READY state gets a writer: a rental agreement (and LTO as **two** documents) is rendered from a template to a fixed document with a hash, linked to the journey and booking. Signing is a separate decision recorded in an ADR.

## WHY (evidence refs)
- SPEC §7 J5 (MISSING), §10.1 (AGREEMENT READY: `contract_instances.status`, nobody writes it), §12 (no PDF library; target table), §5.7 acceptance; SoR §5.7 (LTO = Ijārah as two documents); ROADMAP PM-07; E3 §1.1 (`contract_instances` enum `rental_agreement | lto_purchase_agreement | vehicle_turnover | vehicle_exchange | operator_license`, `journey_id`, `document_id`, `signed_at`, 0 rows; `lto_agreements` PLACEHOLDER).

## CURRENT BEHAVIOR (file:line)
- No template, no renderer, no PDF library in `src/`.
- `contract_instances`, `documents`: no writers. `client_journey` 35 rows link bookings (0).

## EXPECTED BEHAVIOR
- Part A (code): `src/lib/agreements/render.ts`: template registry (`rental_agreement`, `lto_lease`, `lto_sale_promise` — the last two as two separate `contract_instances` rows per SoR), deterministic HTML render from booking + journey + pricing data, stored as a document (HTML or PDF — if PDF, choose a library with an owner-approved dependency justification; default HTML + hash, PDF later), `documents` row with `content_hash`, `contract_instances` row `status='rendered'` (`document_id`, `journey_id`). Staff action from the booking detail (RENT-007) and the transition `RESERVED → AGREEMENT_READY` via `rental_transition` with the document hash as evidence ref.
- Part B (docs): `docs/adr/ADR-PM07-01-signing-provider.md` — options (provider SDK vs in-house canvas + identity binding via the customer account), consequences (⚖️ ESIGN/UETA record requirements: consent, identity, tamper evidence, copy retention), cost, `Decision: PENDING OWNER`. Templates flagged ⚖️ legal review.

## FILES (in scope)
NEW `src/lib/agreements/{render.ts,templates/*.ts}` (+ tests), booking detail action; NEW ADR.

## DATABASE ENTITIES
`contract_instances` (first writer), `documents`, read `bookings`, `client_journey`, `rental_pricing_rules`. No schema change expected (verify `contract_instances` columns in the snapshot).

## DEPENDENCIES
TMMT-RENT-002/007 (transition + detail), TMMT-DOC-001 (storage/hash), TMMT-ADR-001 (vehicle canonical). ⚖️ Template wording is owner + counsel.

## CONSTRAINTS
No signature capture in this task. No interest or late-fee-as-revenue clauses in templates (test). No customer-facing view (PM-16c).

## SECURITY REQUIREMENTS
Staff-only, org-scoped rendering; hash recorded before any view; hostile/other-org tests.

## IMPLEMENTATION NOTES
Deterministic rendering (fixed timestamps injected) so the same inputs give the same hash in tests.

## ACCEPTANCE CRITERIA (testable)
1. Rendering a booking yields `documents` + `contract_instances` rows with a hash; LTO yields two instances (fails pre-fix: no writer).
2. Same input → same hash (determinism test).
3. Template lint: no banned clauses.
4. ADR exists with `PENDING OWNER`.

## TESTS (must fail on the pre-fix code)
`render.test.ts`: `writes instance + document`, `lto is two documents`, `deterministic hash`, `banned clause lint`.

## DO NOT CHANGE
`contracts` legacy table; bucket policies; prod.

## OWNER GATE
Owner decision (signing provider ADR); ⚖️ template review. Merge = deploy: owner + baton.
