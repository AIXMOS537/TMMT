#!/usr/bin/env bash
# ============================================================
# PROJECT X HAILMARY — WATCHTOWER REVOKE
# Run from YOUR machine (carry Mac) to kill any operator.
# Requires: master passphrase + license ID or operator email.
# ============================================================

set -euo pipefail

SUPABASE_URL="https://uapxakmlwnpfsftfeezx.supabase.co"
RED='\033[0;31m'; GREEN='\033[0;32m'; GOLD='\033[0;33m'
BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "${GREEN}✓ $1${RESET}"; }
fail() { echo -e "${RED}✗ $1${RESET}"; exit 1; }
warn() { echo -e "${RED}⚠ $1${RESET}"; }

echo -e "${GOLD}${BOLD}PROJECT X HAILMARY — WATCHTOWER CONTROL${RESET}"
echo -e "${RED}This kills an operator's access. It is immediate and final until you restore it.${RESET}"
echo

# Verify master passphrase
read -s -p "Master passphrase: " MASTER_PASS
echo
PASS_HASH=$(echo -n "$MASTER_PASS" | shasum -a 256 | awk '{print $1}')
STORED_HASH=$(cat "$(dirname "$0")/.passhash" 2>/dev/null || echo "")
[[ "$PASS_HASH" == "$STORED_HASH" ]] || fail "Wrong passphrase."
ok "Authenticated."
echo

# Load service key
if [[ -f "$(dirname "$0")/vault.enc" ]]; then
  eval "$(bash "$(dirname "$0")/vault.sh" open)" || fail "Vault unlock failed."
else
  read -s -p "Supabase service key: " SUPABASE_SERVICE_KEY; echo
fi

# Show active operators
echo "Fetching active operators from watchtower..."
OPERATORS=$(curl -s \
  "$SUPABASE_URL/rest/v1/hailmary_licenses?active=eq.true&select=license_id,operator_name,operator_email,tier,operator_city,activated_at" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY")

echo
echo -e "${BOLD}ACTIVE OPERATORS:${RESET}"
echo "$OPERATORS" | python3 -c "
import json,sys
ops = json.load(sys.stdin)
for i,o in enumerate(ops):
    print(f\"  [{i+1}] {o.get('operator_name','?')} | {o.get('tier','?').upper()} | {o.get('operator_city','?')} | {o.get('license_id','?')[:8]}...\")
" 2>/dev/null || echo "$OPERATORS"
echo

read -p "License ID to revoke (or 'all' to list only): " TARGET_LICENSE
[[ "$TARGET_LICENSE" == "all" ]] && exit 0

echo
echo -e "${RED}${BOLD}WARNING: This will cut off $TARGET_LICENSE immediately.${RESET}"
read -p "Type REVOKE to confirm: " CONFIRM
[[ "$CONFIRM" == "REVOKE" ]] || fail "Aborted."

# Revoke
RESULT=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
  "$SUPABASE_URL/rest/v1/hailmary_licenses?license_id=eq.$TARGET_LICENSE" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": false, "revoked_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}')

if [[ "$RESULT" == "204" ]]; then
  ok "License $TARGET_LICENSE revoked. Operator will go offline on next heartbeat (within 7 days)."
  echo "  To force immediate kill: have them open their machine and the heartbeat will run."
  echo "  To restore: run restore.sh with the same license ID."
else
  warn "Revoke returned HTTP $RESULT. Check Supabase dashboard manually."
fi
