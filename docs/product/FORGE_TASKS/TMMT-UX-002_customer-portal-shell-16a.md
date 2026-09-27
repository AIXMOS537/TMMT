# TMMT-UX-002

## TASK ID
TMMT-UX-002

## TITLE
Customer portal shell (slice 16a): read-only status, documents upload and credit education pages ported from the archive onto the customer tier, one nav generated from the tier map

## PM MILESTONE
PM-16 Flagship UX, slice 16a (roadmap: "A portal shell with read-only status, documents upload and credit education; one nav definition per face"; SPEC §23.1)

## OBJECTIVE
The owner-URGENT customer portal lands in canon, on the customer auth path, with only the pages that need no PM-05/06/07 data.

## WHY (evidence refs)
- SPEC §2.3, §5.16, §6.5 (T04–T06 `(client)/client/*` 15 pages USEFUL, owner URGENT), §23.1 (route table), §22.3 (UX rules), §33 (conditions: Next 16 / React 19 / Tailwind 4 pass; URL-shape decision; PM-19 auth; per-person RLS; profiles P0 closed); READINESS §9 #1; ROADMAP PM-16 16a; E2 §5 (archive at `C:\dev\tmmt-os\src\app\(client)\client\*`, listing only).

## CURRENT BEHAVIOR (file:line)
- Canon: TMMT-AUTH-002's minimal home only. Archive: 14–15 client pages (dashboard, documents, credit, path, support, updates, training, upgrade…), Next 14 / React 18 / Tailwind 3, own components.

## EXPECTED BEHAVIOR
- Pages in this slice: home/status (extend AUTH-002), `documents` (upload into a customer-scoped bucket policy — staged: `program-documents` or a new `customer-documents` bucket per owner decision; single-use token pattern reused), `credit` (education only: `(learn)` content or `FinancingReadinessPanel`; **no** score/financing claims; credit track owns S4/S5 later), `support` (creates a `tickets` row via a **staff-reviewed** server action — check `tickets` anon policy is not the path; ANON-TENANT-001), `updates` (`client_alerts`, read-only).
- One nav definition for the customer face generated from the tier map (`src/lib/auth/route-matrix.ts` from AUTH-005).
- Every page: token kit, four states, mobile first, "Pending verification" language, plain words.
- Archive code is **read, then re-written** for Next 16/React 19/Tailwind 4; never copied with its data layer; never pushed as a bundle.

## FILES (in scope)
`src/app/(client)/client/{documents,credit,support,updates}/*`, `src/lib/client-portal/*` (+ tests), staged bucket policy migration + rehearsal, nav definition; route registry rows.

## DATABASE ENTITIES
Read: `client_renter_status`, `client_alerts`, `program_documents`/bucket; write: `tickets` (org derived server-side), documents bucket. No new tables.

## DEPENDENCIES
TMMT-AUTH-001/002/005, TMMT-DATA-002 (ghost tables not referenced), TMMT-UX-001 (toast), OWNER DECISION URL shape and bucket.

## CONSTRAINTS
No rental, billing or agreements pages (16c). No credit projections. No sends.

## SECURITY REQUIREMENTS
Two-customer rehearsal on every read; upload policy scoped to the person; hostile authenticated tests; `no-browser-pii.test.ts` respected.

## IMPLEMENTATION NOTES
Port one page per PR if the slice is too large; each PR meets the DoD.

## ACCEPTANCE CRITERIA (testable)
1. A customer sees only their status, alerts and documents (rehearsal).
2. Upload lands under the person's prefix; other customers cannot list it.
3. Support ticket carries the server-derived org.
4. Nav is generated, not hand-written; DoD per page.

## TESTS (must fail on the pre-fix code)
Rehearsals per table/bucket; page state tests; nav generation test.

## DO NOT CHANGE
Staff desk; credit engine files; the archive itself.

## OWNER GATE
Owner decisions (URL shape, bucket); prod baton for the bucket policy. Merge = deploy: owner + baton.
