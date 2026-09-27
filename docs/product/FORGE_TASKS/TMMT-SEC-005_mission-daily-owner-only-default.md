# TMMT-SEC-005

## TASK ID
TMMT-SEC-005

## TITLE
`mission-daily.yml`: owner-only, no-notify default, and fail on non-2xx / non-JSON — **before** the middleware machine-route fix

## PM MILESTONE
PM-00 Security containment (roadmap item 00-d). It is a **hard prerequisite of TMMT-BUILD-001 (PM-01)**.

## OBJECTIVE
Make sure opening `/api/mission/*` in middleware cannot switch on an ungated daily Telegram broadcast to every team member, and make the job go red when it does not actually run.

## WHY (evidence refs)
- SPEC §27 (mission-daily LATENT SEND), §24 **FS-17**, §28 **KD-12**, §20.3 **SEC-11** (paired); ROADMAP 00-d ("Must land before PM-01 opens machine routes").
- E6 merge controls: the schedule defaults to `audience=team`, `notify=true`. The route messages the owner **and every profile with a Telegram chat id**. Every run gets `307 → /login` and reports success because `curl --fail-with-body` does not fail on 3xx.

## CURRENT BEHAVIOR (file:line)
- `.github/workflows/mission-daily.yml:19` cron `0 13 * * *`.
- `:41` `AUDIENCE: ${{ github.event.inputs.audience || 'team' }}`; `:42` `NOTIFY: ${{ github.event.inputs.notify || 'true' }}`.
- `:49-53` `curl -sS --fail-with-body -X POST … -H "x-cron-secret: …" -d '{"audience":…,"notify":…}'`. It does not check for a 3xx or a non-JSON body.
- Route: `src/app/api/mission/generate/route.ts:10,46` (secret check → 401). It sends when `notify=true` and `audience=team` (`sendMissionToTeam`).

## EXPECTED BEHAVIOR
- The scheduled run uses `audience=owner`, `notify=false`, unless the owner changes the defaults in a later, separately approved PR. **Or** the schedule is disabled (manual dispatch only). This is an owner decision.
- Manual `workflow_dispatch` inputs still work, with defaults `owner` / `false`.
- The step **fails** unless the HTTP status is 2xx **and** the body parses as JSON (use `curl -w '%{http_code}'` without following redirects, and `jq -e .` or a node one-liner).
- Secrets are referenced only via `${{ secrets.* }}` and never echoed.

## FILES (in scope)
- `.github/workflows/mission-daily.yml`
- Extend `src/lib/guards/workflows-no-unattended-merge.test.ts` (from TMMT-SEC-004), or NEW `src/lib/guards/workflows-no-default-broadcast.test.ts`

## DATABASE ENTITIES
None.

## DEPENDENCIES
- Owner decision: owner-only default vs schedule disabled.
- **Blocks TMMT-BUILD-001.** BUILD-001 must not merge before this is merged.

## CONSTRAINTS
- Do not change `src/app/api/mission/generate/route.ts` or `src/lib/mission/*`.
- Do not change the middleware (that is TMMT-BUILD-001).
- Do not run the workflow against prod.

## SECURITY REQUIREMENTS
- There is no default path that broadcasts to the team.
- Switching to `team`/`notify=true` later is a "switch on live communication" action: owner + baton.

## IMPLEMENTATION NOTES
- Example: `code=$(curl -sS -o body.json -w '%{http_code}' -X POST …)`, then `[ "$code" -ge 200 ] && [ "$code" -lt 300 ] || exit 1`, then `node -e 'JSON.parse(require("fs").readFileSync("body.json","utf8"))'`. Do not add `-L`.
- Do not `cat` the body into the log if it could contain names; print only the status code and top-level keys.

## ACCEPTANCE CRITERIA (testable)
1. The static test asserts that the scheduled defaults in `mission-daily.yml` are not `team` / `true` (fails pre-fix).
2. The static test asserts that the curl step checks the HTTP status and does not use `-L` (fails pre-fix).
3. A local dry run of the step's shell logic against a stub returning 307 exits non-zero (document the command in the PR; no prod call).
4. The PR records the owner decision and date.

## TESTS (must fail on the pre-fix code)
- `workflows-no-default-broadcast.test.ts`: `mission-daily scheduled default is not team broadcast`; `mission-daily fails on non-2xx`; `scanned mission-daily.yml` (non-zero target).

## DO NOT CHANGE
- The mission route and libs; `verify.yml`; the `CRON_SECRET` handling.

## OWNER GATE
Owner decision (default audience/notify or disable). Merge: owner + prod baton.
