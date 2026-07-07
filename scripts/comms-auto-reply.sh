#!/usr/bin/env bash
# comms-auto-reply.sh — Rick Away Mode live loop (personal texts as Taha, guardrails on).
set -euo pipefail
AWAY="${RICK_AWAY_MODE:-$HOME/Sync/rick/away-mode}"
cd "$AWAY"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin"
export COMMS_AUTO_LIVE="${COMMS_AUTO_LIVE:-1}"
export COMMS_PERSONAL_AS_X="${COMMS_PERSONAL_AS_X:-1}"

PY="${COMMS_PYTHON:-/opt/homebrew/bin/python3}"
[[ -x "$PY" ]] || PY="$(command -v python3)"
INTERVAL="${COMMS_POLL_SEC:-20}"

args=(run --interval "$INTERVAL")
if [[ "${COMMS_AUTO_LIVE}" == "1" ]]; then
  args+=(--live)
fi

exec "$PY" -m rick_away.daemon "${args[@]}"
