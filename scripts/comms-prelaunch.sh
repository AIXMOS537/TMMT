#!/usr/bin/env bash
# comms-prelaunch.sh — wait for relay + LiteLLM, then hand off to auto-reply loop.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AWAY="${RICK_AWAY_MODE:-$HOME/Sync/rick/away-mode}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin"
export COMMS_AUTO_LIVE="${COMMS_AUTO_LIVE:-1}"
export COMMS_PERSONAL_AS_X="${COMMS_PERSONAL_AS_X:-1}"

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

uid="$(id -u)"
launchctl kickstart -k "gui/${uid}/com.tmmt.imessage-relay" 2>/dev/null || true
launchctl kickstart -k "gui/${uid}/com.hailmary.litellm-local" 2>/dev/null || true

wait_http "http://127.0.0.1:8787/health" "imessage-relay"
wait_http "http://127.0.0.1:4001/" "litellm-local" 60

cd "$AWAY"
exec bash "$ROOT/scripts/comms-auto-reply.sh"
