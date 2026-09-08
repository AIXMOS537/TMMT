# ROLLBACK — how to undo a change to tmmt-ops, fastest first

Written 2026-09-08 (remediation F-25). Before this file existed no runbook in the repo
described how to roll anything back. Every step below is reversible itself and none
requires a `--force` or a history rewrite. Production database DDL stays owner-gated
(`docs/commercialization/OWNER_DECISIONS.md` D-18): the owner runs the SQL steps.

## 0. First minute — stop the bleeding without deploying

| Symptom | Switch | Where | Effect |
|---|---|---|---|
| SMS agent misbehaving (wrong replies, loops, cost) | `B3_KILL_SWITCH=1` | Vercel → tmmt-ops → Settings → Environment Variables → Production, then **Redeploy** the current deployment | `guardOrganization()` throws for every org, house included; inbound SMS answer with empty TwiML; `/api/agent/health` reports the switch. No data change. |
| One tenant's agent only | `organization_licenses.active=false` for that org (owner, SQL) | Supabase SQL editor | That org's agent refuses; others unaffected. |
| A Vercel cron doing damage (`journey-recompute`, `marketing-kpi-ghl`) | rotate `CRON_SECRET` | Vercel env + Redeploy | Cron calls get 401 until re-pointed. |
| GHL webhooks flooding | rotate `GHL_WEBHOOK_SECRET` | Vercel env + Redeploy | All GHL inbound gets 401; re-enter the new secret in GHL when ready. |

Env changes take effect only on the next deployment: use **Redeploy** on the current
production deployment (Deployments → ⋯ → Redeploy), which rebuilds the same commit.

## 1. Roll back the application (Vercel) — about 60 seconds

Production is the latest READY deployment of `master` (`vercel.json` → `git.deploymentEnabled.master`).
Docs-only commits never build (`scripts/vercel-ignore.sh`), so the previous READY deployment is
always the previous *code* change.

1. Vercel → tmmt-ops → **Deployments**. Find the last READY production deployment that predates
   the bad change (each shows its commit SHA and message).
2. ⋯ → **Promote to Production** (Vercel calls this Instant Rollback on the current-production row).
   Traffic moves to that build immediately; no rebuild.
3. Verify: `curl -sI https://tmmt-ops.vercel.app/api/health` returns 200, and
   `npm run smoke:prod` (`scripts/smoke-prod.sh`) is green.
4. Then fix forward: `git revert <sha>` on a branch → PR → merge. **Never** `git push --force`
   to `master`; a promoted old deployment already protects production while the revert lands.

Notes
- Promoting an old build does not undo database or env changes made since it shipped.
- The API read `list_deployments` on project `prj_Cw4lJPwwlYSyVWLvuo98nuk1r5gV` shows
  `isRollbackCandidate: true` on the deployment Vercel would fall back to.

## 2. Roll back a database migration — owner runs it

Every package applied since 2026-09-07 ships an explicit reverse path. Apply ONE step at a time,
verify with the SELECT in the file header, and record the reversal in
`supabase/schema/live-ledger-*.tsv` and `docs/migrations-applied-*/ROLLBACK.md`.

| Change | Reverse | Notes |
|---|---|---|
| S3-07b nightly recompute | `select cron.unschedule('aixmos_nightly_journey_recompute'); drop function public.recompute_all_journeys();` | remove before S3-07 |
| S3-03b hardening indexes | `docs/migrations-applied-2026-09-07/ROLLBACK.md` step 2 | drop 6 indexes, re-grant `resolve_person_id` |
| S3-07 customer standing | `docs/S3-07_down.sql` | restores original `compute_good_standing` verbatim |
| S3-03 decision contract | `docs/S3-03_down.sql` | archives `decision_events` to `decision_events_archive_s3_03` first; never drops data |
| R-01 VA backlog archive | `docs/migrations-applied-2026-09-07/ROLLBACK.md` step 4 | restores `previous_status` from `result` |
| Staged: SMS replay index | `drop index if exists public.agent_messages_provider_sid_uniq;` | `supabase/migrations/_staged/20260908000000_*` |
| Staged: rate-limit RPC | `drop function if exists public.rate_limit_hit(text,integer,integer); drop table if exists public.rate_limit_buckets;` | `supabase/migrations/_staged/20260908000100_*` |
| Any future migration | its `down.sql`, which must exist before apply (operating script §4) | no down file → do not apply |

After a reversal: `notify pgrst, 'reload schema';` and delete the version row from
`supabase_migrations.schema_migrations` so the CLI ledger matches reality.

The application is written to tolerate the staged objects being absent (fallbacks in
`src/lib/rate-limit-durable.ts` and the inbound SMS route), so reversing them needs no app deploy.

## 3. Roll back a secret rotation

Vercel keeps previous values only in your own record. Before rotating anything, paste the old value
into the owner's password manager entry for that key. To reverse: set the old value, Redeploy.
GHL, Twilio, Airtable and ClickUp each need the matching change on their side.

## 4. Roll back a merged PR without touching production first

```bash
git fetch origin
git checkout -b revert/pr-NNN origin/master
git revert -m 1 <merge-commit-sha>
git push -u origin HEAD
gh pr create --base master --fill
```

The pre-push gate runs on the revert like any push. Merge, and `master` deploys the reverted
code (unless the diff is docs-only, in which case nothing needs deploying).

## 5. What is NOT rollback-able the fast way

- `organization_licenses.kill_command = 'wipe'` — a partner device that has already wiped is gone;
  only re-provisioning restores it. Set `soft_disable` first when unsure.
- Outbound customer messages already sent (SMS, GHL conversations, tags that fired GHL workflows).
- Rows deleted by a migration with no archive step. That is why the operating script forbids
  bulk deletes without a fresh owner line.

## 6. Who can do what

| Step | Who |
|---|---|
| Vercel promote / env / redeploy | anyone with Vercel team access; production-affecting, so tell the owner |
| Database reversal | owner (D-18) |
| Revert PR | any engineer; merge by the owner or per branch convention |
| Secret rotation | owner |
