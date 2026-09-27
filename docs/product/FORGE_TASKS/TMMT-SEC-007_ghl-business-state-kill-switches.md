# TMMT-SEC-007

## TASK ID
TMMT-SEC-007

## TITLE
GHL-set business state kill switches: prove `GHL_AUTO_OPS=false` and `GHL_FORM_AUTO_CASE=false` really stop V1 and V4, and prepare the owner's env change

## PM MILESTONE
PM-00 Security containment (roadmap item 00-e)

## OBJECTIVE
Before GHL webhooks are ever connected (GHL M6/M10), GHL opportunity stages must not auto-verify rental/case state (V1), and GHL forms must not auto-create cases (V4). The owner flips two env values. This task makes sure the flip is **sufficient** and **provable**.

## WHY (evidence refs)
- SPEC §21.2 **V1**, **V4**, §28 **KD-06**; ROADMAP 00-e (owner: prod config + baton); E3 §6; E4 §2(b)4.
- V1 is default ON: `isGhlAutoOpsEnabled()` = `process.env.GHL_AUTO_OPS !== "false"`. Every stage rule is `auto_apply: true`.
- **Gap found while writing this task:** the form handler lets the **payload** force a case even when the env switch is off (`parsed.data.create_case ?? …`). The env kill switch alone does not contain V4. Recorded in `S2_SPEC_ISSUES.md`.

## CURRENT BEHAVIOR (file:line)
- `src/lib/ops-command/stage-rules.ts:95-96` `isGhlAutoOpsEnabled()`.
- `src/lib/ops-command/ghl-auto-ops.ts:42-48`: returns `enabled:false` when off. Called from `src/lib/ghl/handlers/opportunity-stage.ts:203`.
- `src/lib/ghl/handlers/form.ts:135-137`: `autoCase = parsed.data.create_case ?? (process.env.GHL_FORM_AUTO_CASE !== "false" && customerName !== "GHL Form Lead")`. A payload `create_case: true` wins over the env.
- Existing test touching the env: `src/app/api/webhooks/ghl/form/route.test.ts`.

## EXPECTED BEHAVIOR
- With `GHL_AUTO_OPS=false`: a GHL stage webhook creates **no** `cases` change, no `applyVerifiedSync`, and no staff assignment. It logs the event only.
- With `GHL_FORM_AUTO_CASE=false`: **no** case is created, **even if the payload sets `create_case: true`** (the env switch is authoritative when it is off; the payload may only opt *out*).
- With both unset: behaviour unchanged (to avoid a surprise change before the owner decides). The owner's env change is what turns them off.
- An owner runbook in the PR: the exact env names, the target values (`false`), where to set them (Vercel Production + Preview), the prod-baton steps, and how to verify (send a signed test fixture to a **preview**, which still uses the prod DB, so the owner decides whether to verify at all).

## FILES (in scope)
- `src/lib/ghl/handlers/form.ts` (the one-line precedence fix only)
- Tests: `src/app/api/webhooks/ghl/form/route.test.ts` (extend), NEW `src/lib/ops-command/ghl-auto-ops.test.ts` (or extend the existing one)

## DATABASE ENTITIES
`cases`, `crm_sync_records`, `ghl_form_submissions` (asserted **not** written / not changed in tests; fake db). No schema change.

## DEPENDENCIES
- **Coordinate with the GHL router track**: `handlers/form.ts` is a GHL file. The GHL owner reviews the diff. The durable fix (GHL raises events; the router decides) is GHL M6/M7.
- The owner's env change is a separate owner action after the code merges.

## CONSTRAINTS
- Do not change default-on semantics when the env is unset (that is an owner decision, recorded separately).
- Do not change the stage rules or `applyVerifiedSync`.

## SECURITY REQUIREMENTS
- A kill switch set to `false` must not be overridable by request data.
- Tests use synthetic payloads only.

## IMPLEMENTATION NOTES
- New precedence: `const envOff = process.env.GHL_FORM_AUTO_CASE === "false"; const autoCase = envOff ? false : (parsed.data.create_case ?? customerName !== "GHL Form Lead");`.

## ACCEPTANCE CRITERIA (testable)
1. `GHL_AUTO_OPS=false` + a stage fixture → the result has `enabled:false`, and no `cases`/`crm_sync_records` write is attempted.
2. `GHL_FORM_AUTO_CASE=false` + a payload `create_case:true` → no case is created (**fails pre-fix**).
3. `GHL_FORM_AUTO_CASE` unset + no `create_case` → the case is created (unchanged).
4. The PR contains the owner runbook and the postcondition checks.

## TESTS (must fail on the pre-fix code)
- `form/route.test.ts`: `GHL_FORM_AUTO_CASE=false cannot be overridden by payload create_case` — fails pre-fix.
- `ghl-auto-ops.test.ts`: `GHL_AUTO_OPS=false performs no case or sync write` (regression proof).

## DO NOT CHANGE
- `stage-rules.ts` rules. `applyVerifiedSync`. Webhook auth. Env default semantics when unset.

## OWNER GATE
**Vercel env** (owner sets `GHL_AUTO_OPS=false`, `GHL_FORM_AUTO_CASE=false` with the prod baton). The code PR itself: owner merge + baton.
