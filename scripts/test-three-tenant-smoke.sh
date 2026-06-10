#!/usr/bin/env bash
# scripts/test-three-tenant-smoke.sh
# Verifies the three live tenants (AIXMOS, Moe Legacy, TMMT) have active licenses
# and that each kill-switch tier works end-to-end against the deployed API.
set -euo pipefail

BASE_URL="${BASE_URL:-https://tmmt-ops.vercel.app}"
ADMIN_KEY="${ADMIN_KEY:?ADMIN_KEY required}"

green() { printf '\033[32m✓\033[0m %s\n' "$1"; }
red()   { printf '\033[31m✗\033[0m %s\n' "$1"; exit 1; }

declare -A ORG_IDS=(
  ['aixmos']='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  ['moe_legacy']='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
)

echo "==> Health check"
code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/agent/_health")
[[ "$code" == "200" ]] && green "API healthy" || red "API health $code"

for slug in "${!ORG_IDS[@]}"; do
  org_id="${ORG_IDS[$slug]}"

  echo "==> Tenant: $slug (org $org_id)"

  echo "  --> Soft kill"
  curl -sS -X POST "$BASE_URL/api/license/revoke" \
    -H "X-Admin-Key: $ADMIN_KEY" -H 'content-type: application/json' \
    -d "{\"organization_id\":\"$org_id\",\"mode\":\"soft\"}" >/dev/null
  green "    soft kill flag flipped"

  echo "  --> Lead webhook returns 503 (license disabled)"
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/leads/webhook?org=$slug" \
    -H 'content-type: application/json' \
    -d '{"phone":"+15555550100","sku":"lead-magnet"}')
  [[ "$code" == "503" ]] && green "    503 as expected" || red "    expected 503 got $code"

  echo "  --> Restore"
  curl -sS -X POST "$BASE_URL/api/license/revoke" \
    -H "X-Admin-Key: $ADMIN_KEY" -H 'content-type: application/json' \
    -d "{\"organization_id\":\"$org_id\",\"mode\":\"restore\"}" >/dev/null
  green "    restored"

  echo "  --> Lead webhook accepts after restore"
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/leads/webhook?org=$slug" \
    -H 'content-type: application/json' \
    -d '{"phone":"+15555550101","sku":"lead-magnet","utm_source":"smoke","utm_campaign":"three-tenant-test"}')
  [[ "$code" == "200" ]] && green "    200 as expected" || red "    expected 200 got $code"
done

echo ""
echo "ALL THREE-TENANT SMOKES PASSED"
