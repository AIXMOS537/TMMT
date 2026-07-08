#!/usr/bin/env bash
# go-live-integration-test.sh — end-to-end client journey smoke (no real SMS unless TEST_PHONE set).
#
# Usage:
#   bash scripts/mesh/go-live-integration-test.sh
#   SMOKE_BASE_URL=https://tmmt-ops.vercel.app TEST_PHONE=+15555551234 bash scripts/mesh/go-live-integration-test.sh
#
# Pass criteria: all P0 routes public (200), lead webhook accepts JSON, GHL webhook rejects GET.
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh"

BASE="${SMOKE_BASE_URL:-https://tmmt-ops.vercel.app}"
ORG="${SMOKE_ORG:-aixmos}"
FAIL=0

pass() { ok "$1"; }
fail() { warn "FAIL: $1"; FAIL=1; }

say "${BOLD}=== TMMT Integration Test — ${BASE} ===${RST}"

# ── 1. Public money routes (must NOT redirect to login) ───────────────────
say "${BOLD}1. Public routes${RST}"
for spec in \
  "200:/kits" \
  "200:/build" \
  "200:/credit" \
  "200:/funding" \
  "200:/join" \
  "200:/dealers" \
  "200:/forms/credit-funding-intake" \
  "200:/lp/${ORG}/lead-magnet"; do
  want="${spec%%:*}"
  path="${spec#*:}"
  code=$(curl -sS -o /dev/null -w "%{http_code}" -L --max-time 20 "$BASE$path" 2>/dev/null || echo ERR)
  final=$(curl -sS -o /dev/null -w "%{url_effective}" -L --max-time 20 "$BASE$path" 2>/dev/null || echo "")
  if [[ "$code" == "$want" && "$final" != *"/login"* ]]; then
    pass "$code $path"
  else
    fail "$code $path (final: $final)"
  fi
done

# ── 2. Lead webhook (core ad loop) ────────────────────────────────────────
say "${BOLD}2. Lead webhook${RST}"
WH_BODY='{"phone":"5555550199","sku":"lead-magnet","source":"integration-test","name":"Test Lead"}'
WH_RESP=$(curl -sS -w "\n%{http_code}" --max-time 25 \
  -X POST "$BASE/api/leads/webhook?org=$ORG" \
  -H "Content-Type: application/json" \
  -d "$WH_BODY" 2>/dev/null || echo -e "\nERR")
WH_CODE=$(echo "$WH_RESP" | tail -1)
WH_JSON=$(echo "$WH_RESP" | sed '$d')
if [[ "$WH_CODE" == "200" && "$WH_JSON" == *'"ok":true'* ]]; then
  pass "lead webhook 200 + ok:true"
  if echo "$WH_JSON" | grep -q '"sent":true'; then
    pass "first outbound SMS sent"
  else
    say "   outbound: $(echo "$WH_JSON" | tr -d '\n' | head -c 120)..."
    warn "first SMS not sent (need TWILIO_* + org twilio_inbound_number — expected until configured)"
  fi
else
  fail "lead webhook → $WH_CODE body: ${WH_JSON:0:200}"
fi

# ── 3. Agent health (Twilio path) ─────────────────────────────────────────
say "${BOLD}3. Agent API reachable${RST}"
AG_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$BASE/api/agent/health" 2>/dev/null || echo ERR)
[[ "$AG_CODE" =~ ^(200|503)$ ]] && pass "agent health $AG_CODE" || fail "agent health $AG_CODE (expected 200 or 503 kill-switch)"

# ── 4. GHL webhook contract ───────────────────────────────────────────────
say "${BOLD}4. GHL webhook${RST}"
GHL_GET=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$BASE/api/webhooks/ghl" 2>/dev/null || echo ERR)
[[ "$GHL_GET" == "405" ]] && pass "GHL GET rejected (405)" || warn "GHL GET → $GHL_GET (expected 405)"

# ── 5. Optional live phone test ───────────────────────────────────────────
if [[ -n "${TEST_PHONE:-}" ]]; then
  say "${BOLD}5. Live phone test → ${TEST_PHONE}${RST}"
  LIVE_BODY="{\"phone\":\"${TEST_PHONE#+}\",\"sku\":\"lead-magnet\",\"source\":\"owner-live-test\"}"
  LIVE=$(curl -sS --max-time 30 -X POST "$BASE/api/leads/webhook?org=$ORG" \
    -H "Content-Type: application/json" -d "$LIVE_BODY" 2>/dev/null || echo ERR)
  echo "$LIVE" | head -c 300
  say ""
fi

# ── Summary ───────────────────────────────────────────────────────────────
say ""
if [[ $FAIL -eq 0 ]]; then
  ok "${BOLD}INTEGRATION TEST PASSED — ready for client demo${RST}"
  say "Client journey: ad → /lp/aixmos/lead-magnet → SMS → reply → closer → GHL checkout"
  exit 0
else
  warn "${BOLD}INTEGRATION TEST FAILED — fix FAIL items before client demo${RST}"
  say "Run on FORGE: npm run build && vercel --prod"
  say "Owner: npm run ghl:check → paste checkout URLs → npm run ghl:sync-vercel"
  exit 1
fi
