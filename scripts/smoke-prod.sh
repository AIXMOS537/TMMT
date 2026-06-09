#!/usr/bin/env bash
set -euo pipefail

# Canonical public storefront (pitch pages). Staff login lives on tmmt-command-center.
BASE="${SMOKE_BASE_URL:-https://tmmt-ops.vercel.app}"
paths=(
  "/kits"
  "/build"
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
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 20 "$BASE$p" || echo "ERR")
  if [[ "$p" == "/build" || "$p" == "/kits" ]]; then
    if [[ "$code" == "200" ]]; then
      echo "OK   $code  $p"
    else
      echo "FAIL $code  $p (pitch page must be 200, not redirect to login)"
      fail=1
    fi
  elif [[ "$p" == "/forms/customer-intake" && "$code" != "200" ]]; then
    echo "FAIL $code  $p"
    fail=1
  elif [[ "$code" =~ ^(200|307|308)$ ]]; then
    echo "OK   $code  $p"
  else
    echo "WARN $code  $p"
    if [[ "$p" != "/api/health" ]]; then fail=1; fi
  fi
done

echo ""
echo "Webhook (POST-only):"
wh=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 20 "$BASE/api/webhooks/ghl" || echo "ERR")
if [[ "$wh" == "405" ]]; then
  echo "OK   $wh  /api/webhooks/ghl (GET rejected — POST-only)"
else
  echo "WARN $wh  /api/webhooks/ghl (expected 405 on GET)"
fi

exit "$fail"
