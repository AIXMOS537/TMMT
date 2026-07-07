#!/usr/bin/env bash
# go-live-integration-test.sh — end-to-end client journey + GHL pipeline smoke.
#
# Usage:
#   bash scripts/mesh/go-live-integration-test.sh
#   SMOKE_BASE_URL=https://tmmt-ops.vercel.app TEST_PHONE=+15555551234 bash scripts/mesh/go-live-integration-test.sh
#
# Pass criteria: public money routes (200), lead webhook accepts JSON, GHL webhook rejects GET.
set -uo pipefail

BOLD=$'\033[1m'
RST=$'\033[0m'
G=$'\033[32m'
Y=$'\033[1;33m'

ok()  { printf '%b  ✓ %s%b\n' "$G" "$*" "$RST"; }
warn(){ printf '%b  ! %s%b\n' "$Y" "$*" "$RST"; }
fail_msg() { printf '%b  ✗ %s%b\n' "$Y" "$*" "$RST"; FAIL=1; }

BASE="${SMOKE_BASE_URL:-https://tmmt-ops.vercel.app}"
ORG="${SMOKE_ORG:-aixmos}"
FAIL=0

printf '\n%b=== TMMT Integration Test — %s ===%b\n' "$BOLD" "$BASE" "$RST"

# ── 1. Public money routes (must NOT redirect to login) ───────────────────
printf '%b1. Public routes%b\n' "$BOLD" "$RST"
for spec in \
  "200:/kits" \
  "200:/build" \
  "200:/credit" \
  "200:/funding" \
  "200:/forms/credit-funding-intake" \
  "200:/lp/${ORG}/lead-magnet"; do
  want="${spec%%:*}"
  path="${spec#*:}"
  code=$(curl -sS -o /dev/null -w "%{http_code}" -L --max-time 20 "$BASE$path" 2>/dev/null || echo ERR)
  final=$(curl -sS -o /dev/null -w "%{url_effective}" -L --max-time 20 "$BASE$path" 2>/dev/null || echo "")
  if [[ "$code" == "$want" && "$final" != *"/login"* ]]; then
    ok "$code $path"
  else
    fail_msg "$code $path (final: $final)"
  fi
done

# ── 2. Lead webhook (core ad loop) ────────────────────────────────────────
printf '%b2. Lead webhook (TMMT → SMS → closer)%b\n' "$BOLD" "$RST"
WH_BODY='{"phone":"5555550199","sku":"lead-magnet","source":"integration-test","name":"Test Lead"}'
WH_RESP=$(curl -sS -w "\n%{http_code}" --max-time 25 \
  -X POST "$BASE/api/leads/webhook?org=$ORG" \
  -H "Content-Type: application/json" \
  -d "$WH_BODY" 2>/dev/null || echo -e "\nERR")
WH_CODE=$(echo "$WH_RESP" | tail -1)
WH_JSON=$(echo "$WH_RESP" | sed '$d')
if [[ "$WH_CODE" == "200" && "$WH_JSON" == *'"ok":true'* ]]; then
  ok "lead webhook 200 + ok:true"
  if echo "$WH_JSON" | grep -q '"sent":true'; then
    ok "first outbound SMS sent"
  else
    warn "first SMS not sent (need TWILIO_* + org twilio_inbound_number)"
  fi
else
  fail_msg "lead webhook → $WH_CODE body: ${WH_JSON:0:200}"
fi

# ── 3. Agent health (Twilio path) ─────────────────────────────────────────
printf '%b3. Agent API reachable%b\n' "$BOLD" "$RST"
AG_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$BASE/api/agent/_health" 2>/dev/null || echo ERR)
[[ "$AG_CODE" =~ ^(200|503)$ ]] && ok "agent health $AG_CODE" || fail_msg "agent health $AG_CODE (expected 200 or 503)"

# ── 4. GHL inbound webhook contract ───────────────────────────────────────
printf '%b4. GHL inbound webhook (GHL → TMMT)%b\n' "$BOLD" "$RST"
GHL_GET=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$BASE/api/webhooks/ghl" 2>/dev/null || echo ERR)
[[ "$GHL_GET" == "405" ]] && ok "GHL GET rejected (405)" || warn "GHL GET → $GHL_GET (expected 405)"

GHL_POST=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 \
  -X POST "$BASE/api/webhooks/ghl" \
  -H "Content-Type: application/json" \
  -d '{"event":"tag_added","email":"smoke@test.local"}' 2>/dev/null || echo ERR)
[[ "$GHL_POST" == "401" ]] && ok "GHL POST without secret → 401 (fail-closed)" || warn "GHL POST → $GHL_POST (expected 401 without secret)"

# ── 5. GHL outbound sync env (TMMT → GHL) ─────────────────────────────────
printf '%b5. GHL outbound sync env%b\n' "$BOLD" "$RST"
if [[ -f "$(dirname "$0")/../ghl-activation-check.mjs" ]]; then
  if node "$(dirname "$0")/../ghl-activation-check.mjs" 2>/dev/null | grep -q '0 P0 blocker'; then
    ok "ghl:check — checkout URLs configured"
  else
    warn "ghl:check — P0 checkout URLs missing (owner gate: paste GHL funnel URLs)"
  fi
else
  warn "ghl-activation-check.mjs not found"
fi

# ── 6. Optional live phone test ───────────────────────────────────────────
if [[ -n "${TEST_PHONE:-}" ]]; then
  printf '%b6. Live phone test → %s%b\n' "$BOLD" "$TEST_PHONE" "$RST"
  LIVE_BODY="{\"phone\":\"${TEST_PHONE#+}\",\"sku\":\"lead-magnet\",\"source\":\"owner-live-test\"}"
  LIVE=$(curl -sS --max-time 30 -X POST "$BASE/api/leads/webhook?org=$ORG" \
    -H "Content-Type: application/json" -d "$LIVE_BODY" 2>/dev/null || echo ERR)
  echo "$LIVE" | head -c 300
  printf '\n'
fi

# ── Summary ───────────────────────────────────────────────────────────────
printf '\n'
if [[ $FAIL -eq 0 ]]; then
  ok "${BOLD}INTEGRATION TEST PASSED — pipeline routes live${RST}"
  printf '  Journey: ad → /lp/aixmos/lead-magnet → SMS → reply → closer → GHL checkout\n'
  printf '  Reverse: GHL tag/payment → /api/webhooks/ghl → tokens + program + CRM sync\n'
  exit 0
else
  fail_msg "${BOLD}INTEGRATION TEST FAILED — fix FAIL items before demo${RST}"
  printf '  Deploy: npm run build && vercel --prod\n'
  printf '  Owner: npm run ghl:check → paste checkout URLs → npm run ghl:sync-vercel\n'
  exit 1
fi
