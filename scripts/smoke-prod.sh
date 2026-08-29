#!/usr/bin/env bash
set -euo pipefail

BASE="${SMOKE_BASE_URL:-https://tmmt-ops.vercel.app}"
paths=(
  "/"
  "/login"
  "/forms/lead-intake"
  "/forms/dealer-apply"
  "/dealers"
  "/forms/customer-intake"
  "/forms/waitlist"
  "/forms/appointment"
  "/forms/ticket"
  "/api/health"
)

fail=0
echo "Smoke testing $BASE"

# Read the WHOLE redirect chain, not just the final status. `curl -L` reports
# 200 for anything it lands on — including Vercel's SSO login page and a
# redirect into a different, paused project. Both are indistinguishable from a
# healthy page by status code alone, and both have produced false PASSes here.
# awk is used for extraction because it exits 0 even when nothing matches,
# which `grep` does not, and this script runs under `set -e`.
probe() {  # $1=url ; sets PROBE_CODE PROBE_MATCHED PROBE_ERR PROBE_SSO
  local hdrs
  hdrs=$(curl -sS -D - -o /dev/null -L --max-time 20 "$1" 2>/dev/null) || hdrs=""
  PROBE_CODE=$(printf '%s
' "$hdrs"   | awk '/^HTTP/{c=$2} END{print c}')
  PROBE_MATCHED=$(printf '%s
' "$hdrs"| awk -F': *' 'tolower($1)=="x-matched-path"{v=$2} END{gsub(//,"",v); print v}')
  PROBE_ERR=$(printf '%s
' "$hdrs"    | awk -F': *' 'tolower($1)=="x-vercel-error"{v=$2} END{gsub(//,"",v); print v}')
  PROBE_SSO=$(printf '%s
' "$hdrs"    | awk 'tolower($0) ~ /sso-api/{f=1} END{print f+0}')
  [ -n "$PROBE_CODE" ] || PROBE_CODE="ERR"
}

for p in "${paths[@]}"; do
  probe "$BASE$p"
  code="$PROBE_CODE"

  if [ "$PROBE_SSO" = "1" ]; then
    echo "FAIL SSO  $p  (Vercel Deployment Protection — the app was never reached)"
    fail=1; continue
  fi
  if [ -n "$PROBE_ERR" ]; then
    echo "FAIL $code  $p  ($PROBE_ERR)"
    fail=1; continue
  fi
  case "$p" in
    /forms/*)
      if [ "$PROBE_MATCHED" = "/login" ]; then
        echo "FAIL $code  $p  (public form redirected to /login)"
        fail=1; continue
      fi;;
  esac

  if [[ "$p" == "/forms/customer-intake" && "$code" != "200" ]]; then
    echo "FAIL $code  $p"
    fail=1
  elif [[ "$code" =~ ^(200|307|308)$ ]]; then
    echo "OK   $code  $p${PROBE_MATCHED:+  -> $PROBE_MATCHED}"
  else
    echo "WARN $code  $p"
    if [[ "$p" != "/api/health" ]]; then fail=1; fi
  fi
done

exit "$fail"
