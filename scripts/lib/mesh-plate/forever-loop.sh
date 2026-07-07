#!/usr/bin/env bash
# forever-loop.sh — M1 WORK LAW tick: route + execute highest priority mission.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ROLE="${SWARM_ROLE:-}"
[[ -z "$ROLE" && -f "$ROOT/.swarm/role" ]] && ROLE="$(tr -d '[:space:]' < "$ROOT/.swarm/role")"
[[ -z "$ROLE" ]] && ROLE=operator
case "$ROLE" in carry|owner) ROLE=carry ;; esac
LOG="$ROOT/.swarm/forever-loop.log"
log_line(){ printf '[%s] [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ROLE" "$*" >> "$LOG"; }

tick() {
  log_line "tick start"
  case "$ROLE" in
    carry|owner)
      bash "$ROOT/scripts/mesh/empire-intake.sh" >/dev/null 2>&1 || true
      bash "$ROOT/scripts/mesh/m1-work-router.sh" route >/dev/null 2>&1 || true
      ;;
    forge|rick)
      bash "$ROOT/scripts/mesh/m1-work-router.sh" route >/dev/null 2>&1 || true
      bash "$ROOT/scripts/mesh/m1-fleet-executor.sh" >/dev/null 2>&1 || true
      ;;
  esac
  log_line "tick done"
}

case "${1:-tick}" in
  tick) tick;;
  loop)
    interval="${2:-180}"
    while true; do tick; sleep "$interval"; done
    ;;
  status)
    echo "forever-loop role=$ROLE"
    [[ -f "$LOG" ]] && tail -n 6 "$LOG"
    bash "$ROOT/scripts/mesh/m1-work-router.sh" status
    ;;
  *) echo "usage: forever-loop.sh [tick|loop [secs]|status]";;
esac
