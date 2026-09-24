# Scheduled-job acceptance checks (post-deploy)

Branch `fix/safe-fixes-20260923`. Run these **after** the branch is deployed
to production. Every check is read-only except the authorized trigger, which
does exactly what the schedule would do anyway (idempotent upsert / recompute).

## Why this exists

Since the middleware started running (commit `3c27dc9`, 2026-08-19, "middleware
never ran") every scheduled call to `/api/cron/*` was answered `307 -> /login`.
Vercel Cron does not follow redirects and does not log redirected runs, so both
jobs stopped with no error anywhere. The fix lets `/api/cron/*` past the edge
**only** with `Authorization: Bearer $CRON_SECRET` (constant-time compare);
everything else keeps the old behaviour.

## Rules for running the checks

- The secret goes in a **header only**, read from the local env file. Never in
  a URL, never echoed, never pasted into chat.
- `BASE=https://tmmt-ops.vercel.app` (the custom domain has no DNS, F-01).
- Load the secret without printing it, e.g. `set -a; . <env file holding
  CRON_SECRET>; set +a`. It must be the same value as the Vercel production
  env var (`~/.config/tmmt/<svc>.env`, chmod 600, per house rules).
- SQL runs in the Supabase SQL editor (project `uapxakmlwnpfsftfeezx`), read-only.

## 0. Preconditions (once)

| Check | Command | Pass |
|---|---|---|
| CRON_SECRET is set in Vercel prod | `vercel env ls production \| grep -c '^ *CRON_SECRET'` (names only) | `1` |
| Deployed build contains the fix | `curl -s -o /dev/null -w '%{http_code}\n' -H 'Authorization: Bearer wrong' "$BASE/api/health?deep=1"` | `401` (old build answers `200` and ignores `deep`) |
| Deep health proves the DB | `curl -s -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/health?deep=1"` | `200`, `"db":"ok"` |

If CRON_SECRET is **not** set in Vercel, the middleware denies every machine
call (by design) and the crons keep failing. Set it first, then redeploy.

## 1. Unauthorized calls are rejected (both jobs)

```bash
for p in marketing-kpi-ghl journey-recompute; do
  printf '%s none  -> ' $p; curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$BASE/api/cron/$p"
  printf '%s wrong -> ' $p; curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -H 'Authorization: Bearer wrong' "$BASE/api/cron/$p"
  printf '%s xhdr  -> ' $p; curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -H "x-cron-secret: $CRON_SECRET" "$BASE/api/cron/$p"
done
```

Pass: all six lines are `307 .../login`. The Vercel runtime log shows
`[middleware] rejected machine call {"path":...,"reason":"bearer_mismatch"|"x_cron_secret_not_accepted_at_edge"}`
for the last two of each, and never the header value.

## 2. `/api/cron/marketing-kpi-ghl` (Mon 13:00 UTC, `0 13 * * 1`)

Writes: one upsert into `marketing_kpi_weeks` keyed on `week_start` (manual
social fields preserved). Idempotent.

**Authorized trigger (harmless, same as the schedule):**

```bash
WEEK=$(python3 -c 'import datetime as d;t=d.datetime.now(d.timezone.utc).date();print(t-d.timedelta(days=t.weekday()))')
T0=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -s -o /tmp/kpi.json -w '%{http_code}\n' -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/marketing-kpi-ghl?week_start=$WEEK"
python3 -c 'import json;b=json.load(open("/tmp/kpi.json"));print(b.get("ok"),b.get("error"),b.get("auto",{}).get("details"))'
```

Pass: HTTP `200` with `ok: True`, **or** `503` with `error: ghl_mirror_stale`
(the job ran and correctly reported that the M1 GHL mirror synced 0 contacts
that week). `500` means a DB read failed: see the `[degraded]` log line.

**Postcondition (the row changed):**

```sql
select week_start, ghl_synced_at, email_list_growth, new_subscribers
from marketing_kpi_weeks where week_start = '<WEEK>';
```

Pass: `ghl_synced_at >= <T0>`.

**Scheduled run (next Monday):** after 13:05 UTC, the same query for that
Monday returns `ghl_synced_at` between 13:00 and 13:05 UTC that day, and Vercel
Settings -> Cron Jobs -> View Logs shows the invocation with status 200/503
(redirected runs were never logged, so any entry at all is new).

## 3. `/api/cron/journey-recompute` (daily 04:00 UTC, `0 4 * * *`)

Writes, per journey (up to 500, newest first): `recompute_journey(email)` RPC,
delete+reinsert of that customer's **unacknowledged** `client_alerts` of the
recomputed types (`metadata.source = 'journey_recompute'`), and upserts into
`journey_checkpoint_events` (`credit_education_acknowledged`,
`training_core_complete`, `credit_enrollment_active`, `lto_eligible`).
This is **not** a duplicate of pg_cron `aixmos_nightly_journey_recompute`
(04:30), which only calls `recompute_journey()`.

**Authorized trigger, scoped to one known account (harmless):** use the
owner's own test/house account email, never a customer's.

```bash
EMAIL='<owner test account email>'
T0=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -s -o /tmp/jr.json -w '%{http_code}\n' -G --data-urlencode "email=$EMAIL" \
  -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/journey-recompute"
python3 -c 'import json;b=json.load(open("/tmp/jr.json"));print(b.get("ok"),b.get("journeyId"),b.get("alertCount"))'
```

(`email` is a query parameter the handler already supports; it is an address,
not a secret, but prefer a test account so no customer data sits in a URL/log.)

Pass: HTTP `200`, `ok: True`, a non-null `journeyId`.

**Postcondition:**

```sql
select count(*) as new_alerts from client_alerts
where customer_email = lower('<EMAIL>')
  and metadata->>'source' = 'journey_recompute'
  and created_at >= '<T0>';
```

Pass: `new_alerts` equals `alertCount` from the response.

**Scheduled run (next night):** after 04:10 UTC,

```sql
select count(*) from client_alerts
where metadata->>'source' = 'journey_recompute'
  and created_at >= date_trunc('day', now() at time zone 'utc') + interval '4 hours';
```

Pass: `> 0` whenever any active journey has an alert template (0 is possible
only if no journey qualifies; then confirm the Vercel cron log shows a 200 with
`processed > 0`).

## 4. What is still blocked (unchanged on purpose)

| Route | Caller | Status | Why left closed |
|---|---|---|---|
| `/api/license/heartbeat` | nothing today | still `307 -> /login` | the only auth is a `hardware_uuid` string (a bearer identifier, not a secret), no client calls this route (the partner kit writes `partner_heartbeats` over REST), and every licence row had `hardware_uuid = null` as of a 2026-08-31 audit note (not re-queried). Opening it would expose an unauthenticated endpoint that returns `kill_command` and writes `last_heartbeat_at` for anyone holding two identifiers. Open it only together with a signature check against the enrolled device key |
| `/api/license/provision`, `/api/license/revoke` | nothing today | still `307` | same licence spine; open together with a signed heartbeat |
| `/api/mission/generate` | GitHub Actions `mission-daily.yml` (daily 13:00 UTC) | still `307`; the workflow goes **green** on the redirect because curl `--fail-with-body` does not fail on 3xx | it sends Telegram messages to the team; it uses `x-cron-secret` not Bearer. Owner decision: move it under `/api/cron/` with Bearer, and make the workflow fail on any non-2xx status (it currently treats the redirect as success) |
