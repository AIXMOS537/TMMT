# TMMT-DATA-005

## TASK ID
TMMT-DATA-005

## TITLE
Scope `staff-documents` signed URLs by org: a staff user can only sign paths that belong to their org (or is platform admin)

## PM MILESTONE
PM-02 Canonical data, tenancy and roles (roadmap item 9). SPEC §20.3 assigns SEC-15 to PM-07; the pack follows the roadmap (see `S2_SPEC_ISSUES.md` SI-03).

## OBJECTIVE
Close the cross-org read of contracts, licences and other staff documents through signed URLs.

## WHY (evidence refs)
- SPEC §20.3 **SEC-15**, §28 **KD-26**, §5.7 (security risks), §25.2 (tenant isolation); E5 §C.6: `(admin)/document-actions.ts:39-61` gives any staff user a 1 h signed URL for any `staff-documents` path; only `licenses/background_checks/` is owner-restricted; there is no org check. The bucket policy is `is_staff()` for select/insert/update/delete (E3 §4).

## CURRENT BEHAVIOR (file:line)
- `src/app/(admin)/document-actions.ts:39-61`: `getSignedDocumentUrl`-style action → `isStaffUser` → service/SSR client → `storage.from('staff-documents').createSignedUrl(path, 3600)`; owner-only branch for the `licenses/background_checks/` prefix.
- `uploadContractPdf` (`:69`) stores at a per-contract key; the path shape (does it embed `org_id`?) must be read from the code and from an aggregate listing of prefixes in the bucket (owner-provided, no filenames with PII).
- Bucket policies on prod: `staff_documents` CRUD via `is_staff()` (E3 §4).

## EXPECTED BEHAVIOR
- Every signed-URL request resolves the document's org **server-side** (from the owning row: `contracts.org_id`, `background_checks` → lead org, etc., or from an org-prefixed path convention) and refuses unless the caller is platform admin or `is_staff_of(org)` (TMMT-DATA-003 helper; until it lands, `profiles.organization_id = org` via the SSR client).
- New uploads write to an org-prefixed key `org/<org_id>/…`; existing keys keep working through the row-based lookup (no mass move in this task).
- Staged bucket policy update: `storage.objects` policies for `staff-documents` add the org check for `select`, mirroring the app rule. Rehearsal covers it.
- A hostile authenticated user (no staff role) and staff of another org get a refusal with no information about whether the path exists.

## FILES (in scope)
- `src/app/(admin)/document-actions.ts` (+ NEW `document-actions.test.ts`)
- NEW `src/lib/documents/resolve-document-org.ts` (+ test)
- NEW `supabase/migrations/_staged/<ts>_staff_documents_org_scope_STAGED.sql` + `scripts/tests/sql/staff-documents-org-scope.rehearsal.mjs`

## DATABASE ENTITIES
`storage.objects` policies for bucket `staff-documents`; read: `contracts`, `background_checks`, `incoming_leads` (org resolution). No new table.

## DEPENDENCIES
- TMMT-DATA-003 (`is_staff_of`) preferred; the task works without it using `profiles.organization_id`.
- TMMT-BUILD-003 snapshot for the current storage policy names.
- Owner-provided aggregate of existing key prefixes (count per top-level prefix).

## CONSTRAINTS
- No file moves or deletions in the bucket.
- Do not change `program-documents` or `vehicle-media` policies (separate tasks if needed).
- Keep `licenses/background_checks/` owner-only.

## SECURITY REQUIREMENTS
- Deny by default when the org cannot be resolved.
- Test with hostile authenticated, other-org staff, same-org staff, platform admin.
- Do not log document paths that embed names; log ids only.

## IMPLEMENTATION NOTES
- Row-based resolution is more reliable than path parsing for legacy keys; use the path prefix only as a fast path for new keys.

## ACCEPTANCE CRITERIA (testable)
1. Other-org staff requesting a signed URL for org A's contract PDF → refused (fails pre-fix).
2. Same-org staff → URL issued; platform admin → URL issued.
3. Unresolvable org → refused.
4. Rehearsal: storage policy denies `select` on an `org/A/…` object to org-B staff.
5. Full gate passes.

## TESTS (must fail on the pre-fix code)
- `document-actions.test.ts`: `refuses cross-org signed url` (fails pre-fix); `refuses when org unresolvable`; `allows same-org staff`; `platform admin allowed`.
- `staff-documents-org-scope.rehearsal.mjs`: `bucket select denied cross-org` (fails pre-migration).

## DO NOT CHANGE
- Upload replace/delete behaviour (KD-37 → TMMT-DOC-001). Other buckets. Prod.

## OWNER GATE
**Prod baton** for the storage policy migration. Code merge: owner + baton.
