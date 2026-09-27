# TMMT-DOC-001

## TASK ID
TMMT-DOC-001

## TITLE
Versioned contract PDF storage: replacing a contract PDF never deletes the previous file; every version is recorded in `documents` with a content hash

## PM MILESTONE
PM-07 Agreements and e-sign (roadmap new-build: "Versioned storage (stop delete-on-replace)")

## OBJECTIVE
A signed or uploaded agreement can never be silently replaced; each version is addressable and hash-verifiable. This is the storage half PM-07's signing ceremony will build on.

## WHY (evidence refs)
- SPEC §5.7 (bugs: "No versioning of contract PDFs"), §12 (facts; target "Versioned storage (never overwrite)"; `documents` table ORPHANED), §28 **KD-37**; E3 §4 (`uploadContractPdf` `(admin)/document-actions.ts:69`: `upsert:false` but the previous file is **deleted** on replace; 0 of 2 `contracts` have a PDF; `documents` 0 rows, columns `case_id, kind, title, storage_path, visibility`).

## CURRENT BEHAVIOR (file:line)
- `src/app/(admin)/document-actions.ts:69` (`uploadContractPdf`), `:83,127` (`contracts.contract_pdf_storage_path`); bucket `staff-documents` private; delete-on-replace.
- `documents` has no writer; `contract_instances.document_id` FK → `documents`.

## EXPECTED BEHAVIOR
- Upload writes to a new versioned key (`org/<org>/contracts/<contract>/v<n>-<sha256-8>.pdf`), never deletes, and inserts a `documents` row (`kind='contract_pdf'`, `storage_path`, `title`, a `sha256` — add a `content_hash` column via staged migration only if absent; `case_id` nullable if the snapshot allows, else STOP and report the FK shape) plus updates `contracts.contract_pdf_storage_path` to the newest.
- A "versions" list on `/interfaces/contracts` (read-only), signed URLs through the org-scoped path (TMMT-DATA-005).
- Hash verified on download (re-hash and compare) with a visible "verified"/"mismatch" state.

## FILES (in scope)
`src/app/(admin)/document-actions.ts` (+ test), `src/lib/document-storage.ts`, `/interfaces/contracts` page (versions list), NEW staged migration for `documents.content_hash` (if absent) + rehearsal.

## DATABASE ENTITIES
`documents` (first writer), `contracts.contract_pdf_storage_path`; bucket `staff-documents`.

## DEPENDENCIES
TMMT-DATA-005 (org-scoped URLs); TMMT-BUILD-003 (`documents` exact shape). Signing provider decision is **not** needed for this task.

## CONSTRAINTS
No deletion path added. No e-sign. No customer access yet (PM-16c).

## SECURITY REQUIREMENTS
Staff-only, org-scoped; hostile authenticated and other-org staff tests; no PII in keys (ids only).

## IMPLEMENTATION NOTES
Compute the hash server-side from the uploaded bytes before storing.

## ACCEPTANCE CRITERIA (testable)
1. Two uploads for one contract → two objects, two `documents` rows, pointer at the newest (fails pre-fix: previous deleted).
2. Hash check flags a tampered fixture.
3. Other-org staff cannot upload or list.
4. Full gate passes.

## TESTS (must fail on the pre-fix code)
`document-actions.test.ts`: `replace keeps previous version` (fails pre-fix); `documents row with hash`; `cross-org refused`.

## DO NOT CHANGE
Bucket policies beyond DATA-005; `contract_instances` (DOC-002); prod.

## OWNER GATE
Prod baton if a column is added. Merge = deploy: owner + baton.
