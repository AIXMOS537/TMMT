#!/usr/bin/env bash
# sovereign-heal.sh — self-heal dead daemons (SEAL team stays online).
set -uo pipefail
ROOT="${TMMT_ROOT:-}"
[[ -z "$ROOT" ]] && for d in "$HOME/projects/TMMT" "$HOME/Projects/TMMT" "$HOME/TMMT"; do
  [[ -f "$d/scripts/tmmt" ]] && ROOT="$d" && break
done
ROOT="${ROOT:-$(pwd)}"
NOTIFY="$ROOT/scripts/mesh/notify-owner.sh"
UID_NUM="$(id -u 2>/dev/null || echo 501)"

heal_label() {
  local label="$1" plist="$HOME/Library/LaunchAgents/${label}.plist"
  [[ -f "$plist" ]] || return 0
  if ! launchctl list 2>/dev/null | grep -q "$label"; then
    launchctl bootstrap "gui/$UID_NUM" "$plist" 2>/dev/null \
      || launchctl load -w "$plist" 2>/dev/null \
      || true
    bash "$NOTIFY" log "sovereign_heal: reloaded $label" 2>/dev/null || true
  fi
}

kickstart_label() {
  local label="$1"
  case "$label" in
    com.hailmary.litellm-local)
      curl -sf --max-time 2 http://127.0.0.1:4001/ >/dev/null 2>&1 && return 0
      ;;
  esac
  launchctl kickstart -k "gui/$UID_NUM/$label" 2>/dev/null || true
}

# TMMT mesh daemons
for lbl in com.tmmt.forever-loop com.tmmt.router com.aixmos.hailmary com.tmmt.memory-sync com.tmmt.voice-inbox; do
  heal_label "$lbl"
done

# Project X agent stack
for lbl in com.hailmary.litellm-local com.hailmary.ccr com.aixmos.hailmary.heartbeat; do
  heal_label "$lbl"
done

# Ollama wake (macOS)
if [[ "$(uname -s)" == "Darwin" ]] && ! curl -sf --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  open -a Ollama 2>/dev/null || true
fi

# LiteLLM nudge
kickstart_label com.hailmary.litellm-local
kickstart_label com.hailmary.ccr

exit 0
