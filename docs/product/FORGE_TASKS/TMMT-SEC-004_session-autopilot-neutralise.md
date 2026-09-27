# TMMT-SEC-004

## TASK ID
TMMT-SEC-004

## TITLE
Neutralise the `session-autopilot.yml` auto-merge and branch-delete steps

## PM MILESTONE
PM-00 Security containment (roadmap item 00-c)

## OBJECTIVE
No GitHub workflow can merge to master (= prod deploy) or delete branches unattended.

## WHY (evidence refs)
- SPEC §27 (session-autopilot LATENT RISK), §20.3 **SEC-04**, §28 **KD-04**; ROADMAP 00-c; READINESS §5 #3.
- E6 merge controls: master is unprotected and cannot be protected on the current plan (403). The workflow runs every 6 h with `contents: write` + `pull-requests: write`. Its "ONE-TIME OWNER SETUP" comment tells the owner to enable auto-merge, after which PRs "merge themselves". Today it is latent only because `allow_auto_merge=false` and Actions cannot create PRs. The branch-delete step is live code.

## CURRENT BEHAVIOR (file:line)
- `.github/workflows/session-autopilot.yml:7-15`: header, including the owner-setup instruction.
- `:19` cron `0 */6 * * *`; `:22` `permissions:` block.
- `:57-78`: opens PRs for `claude/*` branches and runs `gh pr merge "$PR_NUM" --auto --merge` (`:76`).
- `:84-96`: `git push origin --delete "$branch"`.
- Summary line `:100`. All runs report `success` while every action is refused (FS-18).

## EXPECTED BEHAVIOR (per owner decision; pick one and record it)
- **Option A (recommended): disable the workflow.** Remove the `schedule` trigger (keep `workflow_dispatch` only, or delete the file), and remove `--auto` merge and branch delete.
- **Option B: report-only.** Keep the schedule, but the job only **lists** `claude/*` branches ahead of master and those at master. It creates no PR, merges nothing and deletes nothing. Permissions drop to `contents: read`, `pull-requests: read`.
- In both options the misleading "ONE-TIME OWNER SETUP … merges itself" comment is removed.

## FILES (in scope)
- `.github/workflows/session-autopilot.yml`
- NEW `src/lib/guards/workflows-no-unattended-merge.test.ts` (static scan over `.github/workflows/*.yml`)

## DATABASE ENTITIES
None.

## DEPENDENCIES
- An **owner decision** (A or B) recorded in the PR.
- None technical.

## CONSTRAINTS
- Do not change `verify.yml` or `pii-guard.yml` in this task.
- Do not change repo settings (`allow_auto_merge` stays `false`; the owner owns settings).
- Do not delete any branch.

## SECURITY REQUIREMENTS
- After the change, no workflow file contains `gh pr merge` with `--auto`, `gh pr merge` at all on a schedule, or `push origin --delete` / `git push --delete`.
- Workflow permissions are least-privilege.

## IMPLEMENTATION NOTES
- The guard test reads files with `fs.readdirSync('.github/workflows')` (not a `git ls-files` glob, to stay Windows-safe). It **asserts that at least one workflow file was scanned**, to avoid a zero-target pass (see `13_TESTING.md`).

## ACCEPTANCE CRITERIA (testable)
1. The guard test fails on the current `session-autopilot.yml` and passes after the change.
2. The guard test asserts a non-zero file count.
3. `actionlint` (if available) or a YAML parse of the file succeeds.
4. The PR records the owner's choice (A/B) and date.

## TESTS (must fail on the pre-fix code)
- `workflows-no-unattended-merge.test.ts`: `no workflow enables auto-merge` (fails pre-fix on `:76`); `no workflow deletes remote branches` (fails pre-fix on `:94`); `scanned at least one workflow file`.

## DO NOT CHANGE
- Other workflows. Repo or GitHub settings. Remote branches.

## OWNER GATE
Owner decision (option A/B). Merge = a push to master: owner + prod baton (docs/workflow-only changes are skipped by `scripts/vercel-ignore.sh`, but merging is still an owner action).
