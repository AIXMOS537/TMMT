#!/usr/bin/env bash
# ============================================================
# PROJECT X HAILMARY — RESTORE OPERATOR ACCESS
# Re-activates a revoked license. Muhammad Taha only.
# ============================================================

set -euo pipefail

SUPABASE_URL="https://uapxakmlwnpfsftfeezx.supabase.co"
GREEN='\033[0;32m'; GOLD='\033[0;33m'; RED='\033[0;31m'
BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "${GREEN}✓ $1${RESET}"; }
fail() { echo -e "${RED}✗ $1${RESET}"; exit 1; }

echo -e "${GOLD}${BOLD}PROJECT X HAILMARY — RESTORE ACCESS${RESET}"
echo

read -s -p "Master passphrase: " MASTER_PASS
echo
PASS_HASH=$(echo -n "$MASTER_PASS" | shasum -a 256 | awk '{print $1}')
STORED_HASH=$(cat "$(dirname "$0")/.passhash" 2>/dev/null || echo "")
[[ "$PASS_HASH" == "$STORED_HASH" ]] || fail "Wrong passphrase."
ok "Authenticated."

SUPABASE_SERVICE_KEY=$(cat "$(dirname "$0")/.supabase-service-key" 2>/dev/null)
[[ -n "$SUPABASE_SERVICE_KEY" ]] || { read -s -p "Supabase service key: " SUPABASE_SERVICE_KEY; echo; }

read -p "License ID to restore: " TARGET_LICENSE

RESULT=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
  "$SUPABASE_URL/rest/v1/hailmary_licenses?license_id=eq.$TARGET_LICENSE" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": true, "revoked_at": null}')

[[ "$RESULT" == "204" ]] && ok "License $TARGET_LICENSE restored." || echo "HTTP $RESULT — check manually."
