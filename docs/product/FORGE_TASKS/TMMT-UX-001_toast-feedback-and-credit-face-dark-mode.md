# TMMT-UX-001

## TASK ID
TMMT-UX-001

## TITLE
One feedback pattern (toast / inline status component on the token kit) replacing `alert()`/`confirm()`, and dark mode on the credit face (`CubeShell`)

## PM MILESTONE
PM-16 Flagship UX, slice 16a (roadmap: "A toast/feedback component"; "Dark mode on the credit face")

## OBJECTIVE
Every face gives feedback the same way, and the credit face is not the one face without dark mode.

## WHY (evidence refs)
- SPEC §22.1 (no toast; `alert()/confirm()` in 3 files; `CubeShell` 0 `dark:` classes), §22.2, §22.3 #1, #3, #5; READINESS §10.3 #4; E2 §4.1–§4.4 (`src/components/ui.tsx:498` `ErrorBanner`; `packages/aixmos-core/src/cube/CubeShell.tsx` hard-coded `slate`; T01 rescue targeted this).

## CURRENT BEHAVIOR (file:line)
- `alert()`/`confirm()` in 3 files (grep to list); no toast component; two kits (`ui.tsx` 96 importers vs `ui/*` 4 importers).
- `CubeShell.tsx`: no `dark:` classes; `globals.css:2` class-based dark variant exists.

## EXPECTED BEHAVIOR
- NEW `src/components/ui/toast.tsx` + provider (token-based, accessible: `role="status"`/`alert`, focusable dismiss, 4.5:1), and `ConfirmDialog` on the existing `Modal` pattern; the 3 `alert()/confirm()` sites migrated.
- `CubeShell` and the `(learn)`/`(program)` chrome use tokens with `dark:` coverage (or CSS vars) so `ThemeToggle` applies; no raw `slate-*` in changed lines.
- A static guard: no `alert(` / `confirm(` in `src/` (non-test); no raw `gray-`/`slate-`/`blue-600` in files under `src/components/ui/` (assert non-zero files scanned).

## FILES (in scope)
NEW toast/confirm components (+ tests); the 3 call sites; `packages/aixmos-core/src/cube/CubeShell.tsx` (+ snapshot test); NEW guard test.

## DATABASE ENTITIES
None.

## DEPENDENCIES
None (T01 kit already landed as `9f6a0636`).

## CONSTRAINTS
Do not migrate all 96 `ui.tsx` importers (SPEC §22.3 #1: migrate when a screen is touched). No new UI library.

## SECURITY REQUIREMENTS
Toast content never includes PII from errors (map to human messages).

## IMPLEMENTATION NOTES
Provider mounted once in the root layout; SSR-safe.

## ACCEPTANCE CRITERIA (testable)
1. `grep alert(` in `src/` (non-test) → 0 (fails pre-fix: 3).
2. Credit face renders with `.dark` and passes a contrast check on tokens.
3. Guard test green; full gate passes.

## TESTS (must fail on the pre-fix code)
Guard: `no alert/confirm in src` (fails pre-fix); component tests for toast/confirm; `CubeShell` dark snapshot.

## DO NOT CHANGE
`ui.tsx` (legacy kit); other shells; prod.

## OWNER GATE
None. Merge = deploy: owner + baton.
