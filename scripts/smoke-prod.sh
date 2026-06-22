#!/usr/bin/env bash
# HTTP smoke test against production command center.
set -euo pipefail

BASE="${SMOKE_BASE_URL:-https://tmmt-command-center.vercel.app}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local url="$2"
  local expect="${3:-200}"
  local code
  code=$(curl -sS -o /tmp/smoke-body.html -w "%{http_code}" -L --max-redirs 0 "$url" 2>/dev/null || echo "000")
  if [[ "$code" == "$expect" ]] || [[ "$expect" == "2xx" && "$code" =~ ^2 ]]; then
    echo "  OK  [$code] $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL [$code] $name (expected $expect)"
    FAIL=$((FAIL + 1))
  fi
}

check_redirect_login() {
  local name="$1"
  local path="$2"
  local loc code
  loc=$(curl -sS -o /dev/null -w "%{redirect_url}" "$BASE$path" 2>/dev/null || true)
  code=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE$path" 2>/dev/null || echo "000")
  if [[ "$code" == "307" || "$code" == "308" ]] && [[ "$loc" == *"/login"* ]]; then
    echo "  OK  [$code->login] $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL [$code] $name (redirect=$loc)"
    FAIL=$((FAIL + 1))
  fi
}

check_body() {
  local name="$1"
  local path="$2"
  local needle="$3"
  curl -sS "$BASE$path" -o /tmp/smoke-body.html
  if grep -q "$needle" /tmp/smoke-body.html; then
    echo "  OK  [body] $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL [body] $name (missing: $needle)"
    FAIL=$((FAIL + 1))
  fi
}

echo "Smoke: $BASE"
echo ""

check_body "Lead intake form" "/forms/lead-intake" "Vehicle Rental"
check_body "Appointment form" "/forms/appointment" "Appointment"
check_body "Ticket form" "/forms/ticket" "issue_type"
check_body "Login page" "/login" "Sign in"

check_redirect_login "Home requires auth" "/"
check_redirect_login "Rentals venture requires auth" "/v/tmmt-rentals"
check_redirect_login "Partner portal requires auth" "/partner"

echo ""
echo "Result: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
