# TMMT-DATA-002

## TASK ID
TMMT-DATA-002

## TITLE
Fix the three column-drift bugs and add a static schema check so no code path queries a table or column that prod does not have

## PM MILESTONE
PM-02 Canonical data, tenancy and roles (roadmap item 7: "Fix column drift"; exit criterion "no code path queries a non-existent table or column")

## OBJECTIVE
Code must only reference tables and columns that exist in the prod schema snapshot. Fix the three known column drifts, and make the check permanent so the 14 ghost tables are either created (owner decision, TMMT-ADR-001) or their code paths are removed, with CI proving it.

## WHY (evidence refs)
- SPEC §9.5 (ghost tables + column drift), §28 **KD-16**, **KD-17**, §24 **FS-04**, **FS-12**, **FS-19**; ROADMAP PM-02 item 7; E3 §1.5.
- `amount_past_due` insert silently never lands (the column is `amout_past_due`); `active_customers.email` lookup errors (column is `contact_email`); `vin_number` fields never bind (column is `vin`).

## CURRENT BEHAVIOR (file:line)
- `src/lib/ghl-payment-sync.ts:275-288`: balance-row insert into `amount_past_due` (does not exist), error unchecked.
- `src/app/api/webhooks/ghl/route.ts:211`: `.ilike("email", …)` on `active_customers` (column is `contact_email`), falls through to `incoming_leads`.
- `src/app/(admin)/customers/page.tsx:126`, `src/app/(admin)/former-customers/page.tsx:70`, `src/app/(partner)/partner/page.tsx:20`: `vin_number` form fields; prod column is `vin`.
- Ghost tables (14) queried from `src/app/ops-actions.ts`, `src/lib/queries.ts`, `src/lib/routing/*`, `src/lib/routing/execute.ts`, `src/lib/lead-pool.ts`, `src/lib/referrals.ts`, `src/lib/intake/unified.ts`, `src/lib/ops-command/execute.ts`, investor portal, `src/lib/engagement.ts`, policy lookup, `src/lib/email/outbound-email-gate.ts`.
- No test compares `.from('x')` / column names to a schema inventory; 25 test files use `fake-supabase`, which accepts any table (E1 §5).

## EXPECTED BEHAVIOR
- The three column drifts are fixed to the prod names. For `amount_past_due`, **check with TMMT-SEC-002 first**: SEC-002 deliberately leaves the balance insert dead. Fixing the column name revives a write path (a second "Pending balance" `customer_payments` row per high-ticket tag). Options: (a) fix the name **and** keep the row `Pending`/unverified, checking the insert result; (b) delete the balance insert. **Owner decides (a) or (b)**; default (b) if SEC-002 has landed and the owner wants no GHL-sourced money rows at all.
- NEW static test `src/lib/db/schema-references.test.ts`: scans `src/` for `.from("<table>")` (and `.rpc("<fn>")`) and asserts each name exists in the schema inventory produced by TMMT-BUILD-003 (`supabase/schema/prod-snapshot-<date>/*.tsv`). It asserts a **non-zero** number of references was scanned. Ghost tables are listed in an explicit allow-list with a reason and the owner decision id (from TMMT-ADR-001 ADR-05 etc.), so the test is green only while each ghost is consciously tracked.
- For each ghost table, the PR records the owner's decision (create from staged SQL / remove the code path / defer with reason). Removing a code path means: delete the query, render an honest empty/"not available" state, keep the route unless ADR says retire it.

## FILES (in scope)
- `src/lib/ghl-payment-sync.ts`, `src/app/api/webhooks/ghl/route.ts` (GHL track reviews), the three `vin_number` pages
- NEW `src/lib/db/schema-references.test.ts`
- Ghost-table code paths only where an ADR decision says "remove"

## DATABASE ENTITIES
Read-only against the snapshot: `customer_payments` (`amout_past_due`), `active_customers` (`contact_email`), `fleet`/`vehicles` (`vin`). No schema change in this task (creating a ghost table is its own staged migration under its ADR).

## DEPENDENCIES
- **TMMT-BUILD-003** (schema snapshot) — required for the static test.
- **TMMT-ADR-001** (ghost-table and queue decisions) — required before removing code paths.
- **TMMT-SEC-002** — sequence: land SEC-002 first; then decide (a)/(b) for the balance insert.
- GHL track review for the two GHL files.

## CONSTRAINTS
- Do not rename prod columns (no "fix the typo in prod"). The typo `amout_past_due` is what prod has; renaming is a PM-02 migration under its own ADR if the owner wants it.
- Do not create tables here.
- The static test must not require network or DB access.

## SECURITY REQUIREMENTS
- Ghost-table removals must not widen any policy or drop a fail-closed behaviour: `outbound-email-gate.ts` reading the ghost `do_not_contact_emails` must keep **failing closed** (block the send) until a real table exists.

## IMPLEMENTATION NOTES
- Regex for the scan: `\.from\(\s*["']([a-z_0-9]+)["']` and `\.rpc\(\s*["']([a-z_0-9]+)["']`; exclude `*.test.ts`, `fake-supabase`, and `apps/engine`, `aria/`.
- Column-level checking for every query is out of scope; do the three known columns plus the table-level scan.

## ACCEPTANCE CRITERIA (testable)
1. `vin_number` no longer appears in `src/` (grep); the three pages bind `vin`.
2. `active_customers` lookup in the GHL route uses `contact_email` and checks its result.
3. The balance insert is fixed-and-checked or removed, per the recorded decision.
4. `schema-references.test.ts` passes on master + snapshot with every ghost table in the allow-list carrying a decision id; removing an allow-list entry whose code path still exists makes it fail.
5. The test asserts > 0 references scanned.
6. The full gate passes.

## TESTS (must fail on the pre-fix code)
- `schema-references.test.ts`: `every .from() table exists in the snapshot or is an allow-listed ghost` — fails pre-fix on the 14 ghosts with an empty allow-list; `scanned references > 0`.
- Route test: `GHL notes lookup uses contact_email` (mock asserts the column) — fails pre-fix.
- Page tests or a static grep test: `no vin_number field names` — fails pre-fix.

## DO NOT CHANGE
- Prod schema. Policies. `fake-supabase`. Credit files. The GHL event-id handling.

## OWNER GATE
Owner decision on the balance insert (a/b) and on each ghost table (via TMMT-ADR-001). Merge = deploy: owner + baton.
