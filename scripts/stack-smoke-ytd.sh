#!/usr/bin/env bash
# stack-smoke-ytd.sh — Year-to-date full-stack smoke battery
# Covers: local mesh · Vercel apps · GHL bidirectional · three-tenant · dispatch
#
# Usage:
#   bash scripts/stack-smoke-ytd.sh           # quick (~3 min)
#   bash scripts/stack-smoke-ytd.sh full      # full battery (~20 min)
set -uo pipefail

MODE="${1:-quick}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMMT_CFG="${TMMT_CFG:-$HOME/.config/tmmt}"
RICK="$HOME/Sync/rick"
LOG="$HOME/Library/Logs/stack-smoke-ytd.log"
REPORT="$RICK/OUTBOUND/STACK-SMOKE-YTD.md"
CARD="$HOME/Desktop/★ STACK-SMOKE-YTD.txt"
mkdir -p "$(dirname "$LOG")" "$RICK/OUTBOUND"

G=$'\033[32m' Y=$'\033[1;33m' R=$'\033[31m' C=$'\033[36m' X=$'\033[0m'
pass=0; fail=0; warn=0
ok(){ pass=$((pass+1)); printf '  %s✓%s %s\n' "$G" "$X" "$*"; log "PASS: $*"; }
bad(){ fail=$((fail+1)); printf '  %sx%s %s\n' "$R" "$X" "$*"; log "FAIL: $*"; }
wrn(){ warn=$((warn+1)); printf '  %s!%s %s\n' "$Y" "$X" "$*"; log "WARN: $*"; }
hdr(){ printf '\n%s▶ %s%s\n' "$C" "$*" "$X"; log "=== $* ==="; }
log(){ printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*" >> "$LOG"; }

run_check(){
  local label="$1"; shift
  if "$@" >>"$LOG" 2>&1; then ok "$label"
  else bad "$label"; fi
}

{
  printf '\n%s╔══════════════════════════════════════════════════════════════╗%s\n' "$C" "$X"
  printf '%s║  STACK SMOKE YTD — full pipeline · mode=%s%-8s%s           ║%s\n' "$C" "$X" "$MODE" "$C" "$X"
  printf '%s╚══════════════════════════════════════════════════════════════╝%s\n' "$C" "$X"

  hdr "A · Local mesh (Rick + Brainiac)"
  command -v ollama >/dev/null && ollama list >/dev/null 2>&1 && ok "Ollama models" || bad "Ollama"
  curl -sf --max-time 3 http://127.0.0.1:11434/api/tags >/dev/null && ok "Ollama :11434" || bad "Ollama :11434"
  curl -sf --max-time 3 http://127.0.0.1:4001/health/liveliness >/dev/null && ok "LiteLLM M1 :4001" || bad "LiteLLM M1"
  command -v tailscale >/dev/null && tailscale status >/dev/null 2>&1 && ok "Tailscale" || bad "Tailscale"
  curl -sf --max-time 3 http://100.117.163.93:11434/api/tags >/dev/null && ok "Brainiac Ollama" || bad "Brainiac Ollama"
  pgrep -x syncthing >/dev/null 2>&1 && ok "Syncthing" || wrn "Syncthing not running"

  hdr "B · TMMT code gates"
  run_check "health.sh" bash "$ROOT/scripts/health.sh"
  run_check "launch-check" bash "$ROOT/scripts/launch-check.sh"
  run_check "protective-sweep" bash "$ROOT/scripts/protective-sweep.sh"
  if [[ "$MODE" == "full" ]]; then
    run_check "npm verify" bash -c "cd '$ROOT' && npm run verify"
    run_check "selftest" bash "$ROOT/scripts/selftest.sh"
  else
  bash -n "$ROOT/scripts/smoke-prod.sh" && ok "smoke-prod syntax" || bad "smoke-prod syntax"
  bash -n "$ROOT/scripts/mesh/go-live-integration-test.sh" && ok "integration-test syntax" || bad "integration-test syntax"
  fi

  hdr "C · Production apps (3-app ecosystem)"
  run_check "smoke-prod" bash "$ROOT/scripts/smoke-prod.sh"
  run_check "smoke-dispatch" bash "$ROOT/scripts/smoke-dispatch.sh"

  hdr "D · Money funnel + GHL pipeline (bidirectional)"
  run_check "go-live-integration-test" bash "$ROOT/scripts/mesh/go-live-integration-test.sh"

  hdr "E · GHL env + webhook auth"
  if bash -c "cd '$ROOT' && npm run ghl:check" >>"$LOG" 2>&1; then
    ok "ghl:check — P0 checkout URLs set"
  else
    wrn "ghl:check — P0 blockers (owner gate: paste GHL checkout URLs in Vercel)"
  fi
  # Webhook secret present locally (no value printed)
  _ghl_var="GHL_WEBHOOK_SECRET"
  if [[ -n "${!_ghl_var:-}" ]] || grep -q '^GHL_WEBHOOK_' "$ROOT/.env" 2>/dev/null; then
    ok "GHL webhook secret configured"
  else
    wrn "GHL_WEBHOOK_SECRET not in .env"
  fi

  hdr "F · Unit tests (GHL payment sync + token ledger)"
  if (cd "$ROOT" && npx vitest run src/lib/ghl-payment-sync.test.ts src/lib/token-ledger.test.ts --reporter=dot) >>"$LOG" 2>&1; then
    ok "GHL payment + token ledger tests"
  else
    bad "GHL/token unit tests failed"
  fi

  if [[ "$MODE" == "full" && -n "${ADMIN_KEY:-}" ]]; then
    hdr "G · Three-tenant kill-switch (destructive — needs ADMIN_KEY)"
    run_check "three-tenant-smoke" bash "$ROOT/scripts/test-three-tenant-smoke.sh"
  elif [[ "$MODE" == "full" ]]; then
    wrn "three-tenant-smoke skipped (set ADMIN_KEY to run)"
  fi

  if [[ -x "$TMMT_CFG/smoke-test-all.sh" ]]; then
    hdr "H · Empire battery (M1 Rick automations)"
    if bash "$TMMT_CFG/smoke-test-all.sh" quick >>"$LOG" 2>&1; then
      ok "smoke-test-all quick"
    else
      wrn "smoke-test-all had failures (see log)"
    fi
  fi

  hdr "SCOREBOARD"
  printf '  %sPASS: %d  WARN: %d  FAIL: %d%s\n' "$G" "$pass" "$warn" "$fail" "$X"

  cat > "$REPORT" <<MD
# Stack Smoke YTD — $(date -u +%FT%TZ)
mode: $MODE · pass: $pass · warn: $warn · fail: $fail
log: $LOG

## Pipeline map (what this tests)

| Direction | Route | Purpose |
|-----------|-------|---------|
| Ad → TMMT | \`/lp/{org}/{sku}\` | Landing page capture |
| TMMT → SMS | \`POST /api/leads/webhook\` | First outbound text |
| SMS → Agent | \`POST /api/agent/sms/inbound\` | Twilio reply handler |
| GHL → TMMT | \`POST /api/webhooks/ghl\` | Tags, payments, CRM events |
| TMMT → GHL | \`sync-outbound.ts\` | Stage push on case verify |
| GHL checkout | \`NEXT_PUBLIC_GHL_CHECKOUT_*\` | Money funnel URLs |

## Re-run
\`\`\`bash
bash ~/projects/TMMT/scripts/stack-smoke-ytd.sh
bash ~/projects/TMMT/scripts/stack-smoke-ytd.sh full
bash ~/projects/TMMT/scripts/mesh/go-live-integration-test.sh
bash ~/.config/tmmt/smoke-test-all.sh full
\`\`\`
MD

  cat > "$CARD" <<CARD
★ STACK SMOKE YTD — $(date)
================================
PASS: $pass  ·  WARN: $warn  ·  FAIL: $fail  ·  mode: $MODE

FULL STACK RE-RUN:
  bash ~/projects/TMMT/scripts/stack-smoke-ytd.sh
  bash ~/projects/TMMT/scripts/stack-smoke-ytd.sh full

GHL PIPELINE ONLY:
  bash ~/projects/TMMT/scripts/mesh/go-live-integration-test.sh
  cd ~/projects/TMMT && npm run ghl:check

REPORT: ~/Sync/rick/OUTBOUND/STACK-SMOKE-YTD.md
LOG:    ~/Library/Logs/stack-smoke-ytd.log
CARD

  printf '\n%s  Desktop → ★ STACK-SMOKE-YTD.txt%s\n' "$G" "$X"

} 2>&1 | tee -a "$LOG"

(( fail == 0 )) && exit 0 || exit 1
