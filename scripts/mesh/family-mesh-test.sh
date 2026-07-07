#!/usr/bin/env bash
# family-mesh-test.sh — test EVERYTHING: local AI · tailnet · prod funnel · family tier · build.
# Run on Carry (full) or any family device (partial — skips owner-only gates).
#
# Usage:
#   bash scripts/mesh/family-mesh-test.sh
#   SMOKE_BASE_URL=https://tmmt-ops.vercel.app bash scripts/mesh/family-mesh-test.sh
#
# Pass: all applicable checks green for this device's role.
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh" 2>/dev/null || true
cd "$SWARM_ROOT"

BASE="${SMOKE_BASE_URL:-https://tmmt-ops.vercel.app}"
TMMT="${TMMT:-$HOME/.config/tmmt}"
FAIL=0
PASS=0

pass(){ ok "$1"; PASS=$((PASS+1)); }
fail(){ warn "FAIL: $1"; FAIL=$((FAIL+1)); }

host="$(hostname -s 2>/dev/null | tr '[:upper:]' '[:lower:]')"
is_sovereign=0
case "$host" in macbook-pro-*|carry*) is_sovereign=1 ;; esac

say "${BOLD}=== FAMILY MESH TEST — $(swarm_machine 2>/dev/null || hostname) ===${RST}"

# ── 1. Local AI stack ─────────────────────────────────────────────────────
say "${BOLD}1. Local AI stack${RST}"
curl -sf --max-time 3 http://127.0.0.1:11434/api/tags >/dev/null 2>&1 \
  && pass "Ollama" || fail "Ollama down (ollama serve)"
curl -sf --max-time 3 http://127.0.0.1:4001/health >/dev/null 2>&1 \
  && pass "LiteLLM :4001" || fail "LiteLLM down (booyah / litellm launchd)"
curl -sf --max-time 3 http://127.0.0.1:3456/health >/dev/null 2>&1 \
  && pass "CCR :3456" || warn "CCR optional offline"

# Family tier endpoint (Tailscale magic DNS or localhost)
LITELLM_FAMILY_URL="${LITELLM_FAMILY_URL:-http://127.0.0.1:4001/v1/models}"
if [[ -n "${LITELLM_FAMILY_KEY:-}" ]]; then
  curl -sf --max-time 5 -H "Authorization: Bearer ${LITELLM_FAMILY_KEY}" "$LITELLM_FAMILY_URL" >/dev/null 2>&1 \
    && pass "Family virtual key → LiteLLM" || fail "Family key rejected"
else
  say "   (set LITELLM_FAMILY_KEY to test Enchanted tier)"
fi

# ── 2. Tailnet mesh ───────────────────────────────────────────────────────
say "${BOLD}2. Tailnet mesh${RST}"
if command -v tailscale >/dev/null 2>&1; then
  pass "Tailscale installed"
  for node in macbook-pro-2 brainiac-7 iphone171; do
    if tailscale status 2>/dev/null | grep -q "$node"; then
      if tailscale status 2>/dev/null | grep "$node" | grep -qE 'active| - '; then
        pass "node: $node reachable"
      else
        fail "node: $node offline"
      fi
    fi
  done
else
  fail "Tailscale not installed"
fi

# ── 3. Prod money funnel (all devices can probe) ───────────────────────────
say "${BOLD}3. Prod funnel (tmmt-ops)${RST}"
for spec in \
  "200:/fit-test" \
  "200:/join" \
  "200:/lp/aixmos/lead-magnet" \
  "200:/credit"; do
  want="${spec%%:*}"
  path="${spec#*:}"
  code=$(curl -sS -o /dev/null -w "%{http_code}" -L --max-time 20 "$BASE$path" 2>/dev/null || echo ERR)
  final=$(curl -sS -o /dev/null -w "%{url_effective}" -L --max-time 20 "$BASE$path" 2>/dev/null || echo "")
  if [[ "$code" == "$want" && "$final" != *"/login"* ]]; then
    pass "$code $path"
  else
    fail "$code $path (login redirect?)"
  fi
done

# Lead webhook
WH='{"phone":"5555550198","sku":"lead-magnet","source":"family-mesh-test","name":"Harness Test"}'
WH_RESP=$(curl -sS -w "\n%{http_code}" --max-time 25 \
  -X POST "$BASE/api/leads/webhook?org=aixmos" \
  -H "Content-Type: application/json" -d "$WH" 2>/dev/null || echo -e "\nERR")
WH_CODE=$(echo "$WH_RESP" | tail -1)
WH_JSON=$(echo "$WH_RESP" | sed '$d')
[[ "$WH_CODE" == "200" && "$WH_JSON" == *'"ok":true'* ]] \
  && pass "lead webhook" || fail "lead webhook → $WH_CODE"

# ── 4. Structure-first pathway config ─────────────────────────────────────
say "${BOLD}4. Structure-First Pathway${RST}"
[[ -f "$SWARM_ROOT/config/structure-first-pathway.json" ]] \
  && pass "pathway config present" || fail "structure-first-pathway.json missing"
[[ -f "$SWARM_ROOT/config/family-mesh.registry.json" ]] \
  && pass "family mesh registry present" || fail "family-mesh.registry.json missing"

# ── 5. Sovereign-only (Carry / forge) ─────────────────────────────────────
if [[ "$is_sovereign" -eq 1 ]]; then
  say "${BOLD}5. Sovereign gates (owner device)${RST}"
  [[ -d "$HOME/Sync/rick/BRAIN-FEED/compiled" ]] \
    && pass "brain corpus compiled" || warn "brain corpus missing — run compile-corpus.sh"
  [[ -f "$TMMT/carry-watchtower.env" ]] \
    && pass "carry-watchtower.env" || warn "watchtower env missing"
  if [[ -f "$SWARM_ROOT/package.json" ]]; then
    blockers="$(cd "$SWARM_ROOT" && npm run ghl:check 2>&1 | grep -c 'P0 blocker' || true)"
    if [[ "${blockers:-0}" -gt 0 ]]; then
      fail "$blockers P0 GHL checkout URL(s) — owner gate"
    else
      pass "GHL P0 checkouts configured"
    fi
  fi
  [[ -d "$HOME/Sync/rick/FLEET-INBOX" ]] \
    && pass "FLEET-INBOX exists" || warn "FLEET-INBOX missing"
fi

# ── 6. Build probe (forge) ────────────────────────────────────────────────
if [[ -d "$SWARM_ROOT/node_modules" && "$is_sovereign" -eq 1 ]]; then
  say "${BOLD}6. Build probe${RST}"
  (cd "$SWARM_ROOT" && npm run build >/dev/null 2>&1) \
    && pass "npm run build" || fail "build failed"
fi

# ── Summary ───────────────────────────────────────────────────────────────
say ""
if [[ $FAIL -eq 0 ]]; then
  ok "${BOLD}FAMILY MESH TEST PASSED ($PASS checks)${RST}"
  say "Learn → Earn → Churn: $BASE/fit-test"
  say "Family AI: Enchanted → macbook-pro-2.tailceb455.ts.net:4001 (rick-safe key)"
  exit 0
else
  warn "${BOLD}FAMILY MESH TEST FAILED ($FAIL failures, $PASS passed)${RST}"
  say "Fix on Carry: booyah · bash scripts/mesh/sovereign-heal.sh"
  say "Deploy: bash ~/projects/TMMT/scripts/ship tmmt-ops"
  exit 1
fi
