#!/usr/bin/env bash
#
# HAILMARY always-on daemon — the home M1 acting AS the owner, forever.
# Started/kept-alive by launchd (see scripts/hailmary-autostart.sh). Lightweight
# and SAFE: it keeps the local AI alive and heartbeats the brain so the rest of
# the mesh knows the owner-proxy is up. It does NOT take autonomous destructive
# action — guarded work runs through the gated executor/routing paths.
set -uo pipefail

CONFIG="${HAILMARY_CONFIG:-$HOME/.hailmary/config.env}"
# shellcheck disable=SC1090
[ -f "$CONFIG" ] && . "$CONFIG"
mkdir -p "$HOME/.hailmary"
LOG="$HOME/.hailmary/daemon.log"
INTERVAL="${HAILMARY_DAEMON_INTERVAL:-900}"   # seconds (default 15 min)
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
NODE="${HAILMARY_NODE:-home-mac}"

log() { echo "$(date '+%F %T') $*" >>"$LOG"; }
log "daemon start (node=$NODE interval=${INTERVAL}s)"

while true; do
  # 1) keep local AI alive (free, no token dependence)
  if ! curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
    command -v ollama >/dev/null 2>&1 && (ollama serve >/dev/null 2>&1 &) || true
  fi
  # 2) heartbeat to the shared brain so the mesh knows the proxy is alive
  if [ -n "${MEMORY_API_URL:-}" ] && [ -n "${MEMORY_API_TOKEN:-}" ]; then
    body="$(python3 -c 'import json,os;print(json.dumps({"op":"remember","action":"heartbeat","source":"agent","actorKind":"owner","actorLabel":"HAILMARY owner-proxy @ "+os.uname().nodename,"summary":"home M1 owner-proxy alive"}))' 2>/dev/null || echo '')"
    [ -n "$body" ] && curl -fsS -X POST "$MEMORY_API_URL" \
      -H "authorization: Bearer $MEMORY_API_TOKEN" -H 'content-type: application/json' \
      -d "$body" >/dev/null 2>&1 || true
  fi
  log "heartbeat"
  sleep "$INTERVAL"
done
