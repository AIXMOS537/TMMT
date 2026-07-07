#!/usr/bin/env bash
# ghl-paste-watch.sh — auto-apply GHL URLs when paste file is complete. Zero middleman.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASTE="$HOME/.config/tmmt/ghl-paste.env"
LOG="$HOME/Library/Logs/ghl-paste-watch.log"
REQUIRED=(
  NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT
  NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT
  NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE
  NEXT_PUBLIC_GHL_CHECKOUT_97
  NEXT_PUBLIC_GHL_UPSELL_PIPELINE_URL
)

log(){ printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*" >> "$LOG"; }

count_ready() {
  local n=0 k v
  [[ -f "$PASTE" ]] || return 0
  for k in "${REQUIRED[@]}"; do
    v="$(grep "^${k}=" "$PASTE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' "'\''')"
    [[ -n "$v" && "$v" == http* ]] && n=$((n + 1))
  done
  printf '%s' "$n"
}

apply_if_ready() {
  local ready
  ready="$(count_ready)"
  [[ "$ready" -ge 5 ]] || return 1
  log "all 5 URLs ready — applying"
  bash "$ROOT/scripts/deal.sh" apply >> "$LOG" 2>&1 || return 1
  (cd "$ROOT" && npm run ghl:sync-vercel >> "$LOG" 2>&1) || log "sync-vercel failed"
  log "done — run ship manually or tmmt work 'ship prod'"
  return 0
}

log "watching $PASTE"
command -v open >/dev/null && open -e "$PASTE" 2>/dev/null || true
command -v open >/dev/null && open "https://app.gohighlevel.com/" 2>/dev/null || true

for _ in $(seq 1 120); do
  apply_if_ready && exit 0
  sleep 10
done
log "timeout — paste 5 URLs and run: x --money apply"
exit 0
