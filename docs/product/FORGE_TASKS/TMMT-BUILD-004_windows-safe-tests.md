# TMMT-BUILD-004

## TASK ID
TMMT-BUILD-004

## TITLE
Windows-safe tests: LF line endings for TS/TSX, a cross-platform file listing in guard tests, and zero-target sentinels

## PM MILESTONE
PM-01 Reproducible build and CI truth (roadmap new-build item 5)

## OBJECTIVE
Remove the 2 Windows-only vitest failures and the vacuous pass. Local machines (the local army runs on Windows) must get the same answer as Linux CI.

## WHY (evidence refs)
- SPEC §4.4, §24 **FS-20**, §25.1, §25.2 (platform hygiene), §28 **KD-39**; ROADMAP PM-01 item 5; E1 §3.1, §5.3 items 1–2.

## CURRENT BEHAVIOR (file:line)
- `src/lib/guards/ticket-requester-is-not-the-customer.test.ts:25-30`: `execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'")`. On Windows cmd.exe the quotes pass through literally, the list is empty, `:38` fails, and 3 tests pass vacuously.
- `src/lib/agent/compliance/record-opt-out.test.ts:120-137`: a 2200-character look-back window. With `core.autocrlf=true`, `src/app/api/agent/sms/inbound/route.ts` is CRLF and the window misses the guard.
- `.gitattributes`: LF only for `*.sh`, `*.command` and a few named scripts.

## EXPECTED BEHAVIOR
- `.gitattributes` adds `*.ts text eol=lf`, `*.tsx text eol=lf` (and `*.mjs`, `*.js`, `*.json`, `*.sql`, `*.yml`, `*.md`: owner may narrow). **No renormalisation commit of the whole tree in this PR** unless the owner approves. If it is needed, do it as a separate, mechanical commit.
- The ticket-requester guard lists files with a cross-platform method: `git ls-files -z -- src` with no shell quoting (via `execFileSync('git', ['ls-files','-z','--','src'])`) and a JS filter on `.ts/.tsx`, or `fs` recursion. It keeps its non-zero sentinel.
- The opt-out test normalises `\r\n` → `\n` before measuring the window (or measures by lines/AST); its meaning is unchanged.
- A shared helper `src/lib/testing/source-files.ts` (listing + a non-zero assertion) that other guard tests can adopt later. Do not migrate all 27 scan tests here; list them in the PR as follow-ups.

## FILES (in scope)
- `.gitattributes`
- `src/lib/guards/ticket-requester-is-not-the-customer.test.ts`
- `src/lib/agent/compliance/record-opt-out.test.ts`
- NEW `src/lib/testing/source-files.ts` (+ `source-files.test.ts`)

## DATABASE ENTITIES
None.

## DEPENDENCIES
None.

## CONSTRAINTS
- Do not weaken what either test proves. The opt-out test still pins exactly 2 call sites, each on an opt-out branch.
- Do not touch `src/app/api/agent/sms/inbound/route.ts`.

## SECURITY REQUIREMENTS
The opt-out guard is a compliance control (SoR §5.6). It must remain at least as strict.

## IMPLEMENTATION NOTES
- `execFileSync` avoids the shell entirely, so quoting is not an issue on any OS.
- To verify locally on Windows: `git config core.autocrlf true`, re-checkout, `npm test`.

## ACCEPTANCE CRITERIA (testable)
1. On Windows with `core.autocrlf=true`: `npm test` → 0 failures (was 2).
2. On Linux CI: still green.
3. Temporarily pointing the ticket-requester listing at an empty dir makes the sentinel fail (the zero target is caught).
4. `source-files.test.ts` asserts a non-zero count and that the listing includes a known file.

## TESTS (must fail on the pre-fix code)
- The existing two tests are the red evidence on Windows pre-fix. New: `source-files.test.ts`: `lists src files on any OS`, `throws on zero files`.

## DO NOT CHANGE
- The sms inbound route, `record-opt-out.ts`, other guard tests (list them only).

## OWNER GATE
None for the code (owner approves any tree-wide renormalisation separately). Merge: owner + baton.
