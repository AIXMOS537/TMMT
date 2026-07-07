#!/usr/bin/env bash
set -euo pipefail

# Public ops forms (customer-intake) live on tmmt-ops; command-center may lag until M1 prod deploy.
BASE="${SMOKE_BASE_URL:-https://tmmt-ops.vercel.app}"
paths=(
  "/"
  "/login"
  "/forms/lead-intake"
  "/forms/customer-intake"
  "/forms/waitlist"
  "/forms/appointment"
  "/forms/ticket"
  "/api/health"
)

fail=0
echo "Smoke testing $BASE"
for p in "${paths[@]}"; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" -L --max-time 20 "$BASE$p" || echo "ERR")
  if [[ "$p" == "/forms/customer-intake" && "$code" != "200" ]]; then
    echo "FAIL $code  $p"
    fail=1
  elif [[ "$code" =~ ^(200|307|308)$ ]]; then
    echo "OK   $code  $p"
  else
    echo "WARN $code  $p"
    if [[ "$p" != "/api/health" ]]; then fail=1; fi
  fi
done

exit "$fail"
