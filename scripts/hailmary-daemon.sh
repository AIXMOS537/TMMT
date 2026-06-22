#!/usr/bin/env bash
#
# HAILMARY always-on daemon — owner-proxy heartbeat + local AI keepalive.
# Stable copy lives at ~/.hailmary/bin/hailmary-daemon.sh (survives repo resets).
set -uo pipefail

CONFIG="${HAILMARY_CONFIG:-$HOME/.hailmary/config.env}"
# shellcheck disable=SC1090
[ -f "$CONFIG" ] && . "$CONFIG"
mkdir -p "$HOME/.hailmary"
LOG="$HOME/.hailmary/daemon.log"
INTERVAL="${HAILMARY_DAEMON_INTERVAL:-900}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
NODE="${HAILMARY_NODE:-home-mac}"

# X profile (stable lib copy, fallback to repo if present).
if [ -f "$HOME/.hailmary/lib/x-profile.sh" ]; then
  # shellcheck source=/dev/null
  . "$HOME/.hailmary/lib/x-profile.sh"
else
  for d in "$HOME/Projects/TMMT" "$HOME/projects/TMMT" "$HOME/TMMT"; do
    [ -f "$d/scripts/lib/x-profile.sh" ] && . "$d/scripts/lib/x-profile.sh" && break
  done
fi

log() { echo "$(date '+%F %T') $*" >>"$LOG"; }
CALLSIGN="$(x_callsign 2>/dev/null || echo "PROJECT X")"
log "daemon start (node=$NODE callsign=$CALLSIGN interval=${INTERVAL}s)"

while true; do
  if ! curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
    command -v ollama >/dev/null 2>&1 && (ollama serve >/dev/null 2>&1 &) || true
  fi
  if [ -n "${MEMORY_API_URL:-}" ] && [ -n "${MEMORY_API_TOKEN:-}" ]; then
    body="$(python3 - "$CALLSIGN" "$NODE" <<'PY'
import json, os, sys
callsign, node = sys.argv[1:3]
label = f"HAILMARY@{callsign} owner-proxy @ {node}"
print(json.dumps({
  "op": "remember",
  "action": "heartbeat",
  "source": "agent",
  "actorKind": "owner",
  "actorLabel": label,
  "summary": f"owner-proxy alive ({callsign})",
  "details": {"node": node, "callsign": callsign},
}))
PY
)"
    [ -n "$body" ] && curl -fsS -X POST "$MEMORY_API_URL" \
      -H "authorization: Bearer $MEMORY_API_TOKEN" -H 'content-type: application/json' \
      -d "$body" >/dev/null 2>&1 || true
  fi
  log "heartbeat ($CALLSIGN)"
  sleep "$INTERVAL"
done
