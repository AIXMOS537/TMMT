#!/usr/bin/env bash
# comms-prelaunch.sh — wait for relay; soft-check LiteLLM; start auto-reply loop.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AWAY="${RICK_AWAY_MODE:-$HOME/Sync/rick/away-mode}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin"
export COMMS_AUTO_LIVE="${COMMS_AUTO_LIVE:-1}"
export COMMS_PERSONAL_AS_X="${COMMS_PERSONAL_AS_X:-1}"

uid="$(id -u)"
domain="gui/${uid}"

wait_http() {
  local url="$1" label="$2" tries="${3:-45}"
  local i=0
  while (( i < tries )); do
    if curl -sf --max-time 3 "$url" >/dev/null 2>&1; then
      return 0
    fi
    ((i++))
    sleep 2
  done
  echo "comms-prelaunch: $label not ready ($url)" >&2
  exit 1
}

if ! curl -sf --max-time 2 "http://127.0.0.1:8787/health" >/dev/null 2>&1; then
  launchctl kickstart -k "${domain}/com.tmmt.imessage-relay" 2>/dev/null \
    || launchctl bootstrap "$domain" "$HOME/Library/LaunchAgents/com.tmmt.imessage-relay.plist" 2>/dev/null \
    || true
fi
wait_http "http://127.0.0.1:8787/health" "imessage-relay"

if ! curl -sf --max-time 2 "http://127.0.0.1:4001/" >/dev/null 2>&1; then
  echo "comms-prelaunch: litellm-local not up yet — continuing (brain fallback)" >&2
fi

cd "$AWAY"
exec bash "$ROOT/scripts/comms-auto-reply.sh"
