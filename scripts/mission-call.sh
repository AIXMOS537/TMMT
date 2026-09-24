#!/usr/bin/env bash
# mission-call.sh — call /api/mission/generate and PASS only if the mission actually ran.
#
# Used by .github/workflows/mission-daily.yml. The old step was
#   curl -sS --fail-with-body -H "x-cron-secret: ..."
# which the middleware answered 307 -> /login; curl does not treat a 3xx as a
# failure, so the job went green every day while no mission was built or sent.
#
# Contract (REQUEST SENT != JOB SUCCESS):
#   - HTTP status must be exactly 200 (redirects are never followed or accepted)
#   - body must be JSON with ok=true and built=true
#   - notify=true, audience=owner: notified=true
#   - notify=true, audience=team:  sent>=1 and failed=0
# Anything else (3xx, login HTML, 401/403, 5xx, unexpected body) exits 1.
#
# Env: CRON_SECRET (required, never printed), MISSION_API_BASE, AUDIENCE (owner|team), NOTIFY (true|false)
set -uo pipefail

: "${MISSION_API_BASE:=https://tmmt-ops.vercel.app}"
: "${AUDIENCE:=team}"
: "${NOTIFY:=true}"

fail() { echo "::error::mission-daily FAILED: $*"; exit 1; }

[ -n "${CRON_SECRET:-}" ] || fail "CRON_SECRET is not set"
case "$AUDIENCE" in owner|team) ;; *) fail "AUDIENCE must be owner or team (got '$AUDIENCE')" ;; esac
case "$NOTIFY" in true|false) ;; *) fail "NOTIFY must be true or false (got '$NOTIFY')" ;; esac
command -v jq >/dev/null || fail "jq is required"

body=$(mktemp); trap 'rm -f "$body"' EXIT
url="$MISSION_API_BASE/api/mission/generate"
echo "Calling $url (audience=$AUDIENCE notify=$NOTIFY)"

# The secret goes in via a header file on stdin so it never appears in argv.
code=$(printf 'Authorization: Bearer %s\n' "$CRON_SECRET" | curl -sS --max-redirs 0 --max-time 120 \
  -o "$body" -w '%{http_code}' -X POST "$url" \
  -H @- -H "Content-Type: application/json" \
  -d "{\"audience\":\"$AUDIENCE\",\"notify\":$NOTIFY}") || fail "request did not complete (curl exit $?)"

if [ "$code" != "200" ]; then
  case "$code" in
    3??) fail "HTTP $code redirect (auth did not reach the route — check the edge gate / CRON_SECRET)" ;;
    401|403) fail "HTTP $code (secret rejected by the route — GitHub CRON_SECRET differs from Vercel)" ;;
    *) fail "HTTP $code: $(head -c 300 "$body" | tr -d '\r')" ;;
  esac
fi

jq -e . "$body" >/dev/null 2>&1 || fail "HTTP 200 but body is not JSON (login page?): $(head -c 200 "$body")"

# Print the result without the rendered mission text (preview).
jq -c 'del(.preview)' "$body"

[ "$(jq -r '.ok' "$body")" = "true" ] || fail "route returned ok!=true: $(jq -r '.error // .reason // "no reason"' "$body")"
[ "$(jq -r '.built' "$body")" = "true" ] || fail "mission was not built"

if [ "$NOTIFY" = "true" ]; then
  if [ "$AUDIENCE" = "owner" ]; then
    [ "$(jq -r '.notified' "$body")" = "true" ] || fail "owner not notified: $(jq -r '.reason // "no reason"' "$body")"
  else
    sent=$(jq -r '.sent // 0' "$body"); failed=$(jq -r '.failed // 0' "$body")
    [ "$sent" -ge 1 ] 2>/dev/null || fail "team send reached nobody (sent=$sent): $(jq -r '.reason // "no reason"' "$body")"
    [ "$failed" -eq 0 ] 2>/dev/null || fail "team send partly failed (sent=$sent failed=$failed)"
  fi
fi

echo "mission-daily PASSED (audience=$AUDIENCE notify=$NOTIFY)"
