#!/usr/bin/env bash
set -euo pipefail

BASE="${SMOKE_BASE_URL:-https://tmmt-ops.vercel.app}"
paths=(
  "/kits"
  "/login"
  "/forms/lead-intake"
  "/forms/customer-intake"
  "/forms/waitlist"
  "/forms/appointment"
  "/forms/ticket"
  "/forms/credit-funding-intake"
  "/lp/aixmos/lead-magnet"
  "/api/agent/_health"
)

fail=0
echo "Smoke testing $BASE"
for p in "${paths[@]}"; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" -L --max-time 20 "$BASE$p" || echo "ERR")
  final=$(curl -sS -o /dev/null -w "%{url_effective}" -L --max-time 20 "$BASE$p" 2>/dev/null || echo "")
  if [[ "$p" == "/api/agent/_health" && "$code" =~ ^(200|503)$ ]]; then
    echo "OK   $code  $p"
  elif [[ "$final" == *"/login"* && "$p" != "/login" ]]; then
    echo "FAIL $code  $p (redirected to login)"
    fail=1
  elif [[ "$code" =~ ^(200|307|308)$ ]]; then
    echo "OK   $code  $p"
  else
    echo "FAIL $code  $p"
    fail=1
  fi
done

exit "$fail"
