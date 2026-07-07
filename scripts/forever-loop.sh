#!/usr/bin/env bash
# forever-loop.sh — autonomous mesh orchestrator (Navy SEAL team loop).
# One KeepAlive daemon: sync · presence · heartbeat · role tasks · agent dispatch.
#
#   bash scripts/mesh/forever-loop.sh tick          # one cycle (safe to cron)
#   bash scripts/mesh/forever-loop.sh loop [secs]   # foreground forever
#   bash scripts/mesh/forever-loop.sh status
#
# Install: bash scripts/forever-up.sh  OR  bash scripts/mesh/install-forever-loop.sh install
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh" 2>/dev/null || true
cd "$SWARM_ROOT"

ROLE="${SWARM_ROLE:-}"
[[ -z "$ROLE" && -f "$SWARM_ROOT/.swarm/role" ]] && ROLE="$(tr -d '[:space:]' < "$SWARM_ROOT/.swarm/role")"
[[ -z "$ROLE" ]] && ROLE=operator
case "$ROLE" in carry|owner) ROLE=carry ;; esac

INTERVAL="${FOREVER_INTERVAL:-180}"
LOG="$SWARM_ROOT/.swarm/forever-loop.log"
NOTIFY="$SWARM_ROOT/scripts/mesh/notify-owner.sh"

log_line() {
  local msg="[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [$ROLE] $*"
  printf '%s\n' "$msg" >> "$LOG"
  bash "$NOTIFY" log "$msg" 2>/dev/null || true
}

dark() { [[ -f "$SWARM_ROOT/.swarm/DARK" ]]; }

task_sync() {
  bash "$SWARM_ROOT/scripts/sync-machine.sh" >/dev/null 2>&1 || true
}

task_presence() {
  bash "$SWARM_ROOT/scripts/mesh/presence.sh" beat "$ROLE" online >/dev/null 2>&1 || true
}

task_heartbeat() {
  bash "$SWARM_ROOT/scripts/heartbeat.sh" beat >/dev/null 2>&1 || true
}

task_dispatch() {
  bash "$SWARM_ROOT/scripts/mesh/agent-dispatch.sh" >/dev/null 2>&1 || true
}

task_ghl_audit() {
  local out blockers
  out="$(cd "$SWARM_ROOT" && npm run ghl:check 2>&1 | tail -3)" || true
  blockers="$(printf '%s' "$out" | grep -c 'P0 blocker' || true)"
  if [[ "${blockers:-0}" -gt 0 ]]; then
    log_line "ghl_audit: P0 blockers remain (owner gate — GHL checkout URLs)"
  fi
}

task_integration_probe() {
  bash "$SWARM_ROOT/scripts/mesh/go-live-integration-test.sh" >/dev/null 2>&1 \
    && log_line "integration_probe: pass" \
    || log_line "integration_probe: fail (see go-live-integration-test.sh)"
}

task_build_probe() {
  [[ -d "$SWARM_ROOT/node_modules" ]] || return 0
  (cd "$SWARM_ROOT" && npm run build >/dev/null 2>&1) \
    && log_line "build_probe: ok" \
    || log_line "build_probe: fail"
}

task_brain_ping() {
  curl -sf --max-time 3 http://127.0.0.1:11434/api/tags >/dev/null 2>&1 \
    && log_line "brain_ping: ollama ok" \
    || log_line "brain_ping: ollama down"
  curl -sf --max-time 3 -H "Authorization: Bearer ${LITELLM_MASTER_KEY:-x}" \
    "${OPENAI_BASE_URL:-http://127.0.0.1:4001/v1}/models" >/dev/null 2>&1 \
    && log_line "brain_ping: litellm ok" \
    || true
}

task_memory_once() {
  [[ -n "${HAILMARY_VAULT:-}" ]] \
    && bash "$SWARM_ROOT/scripts/mesh/memory-sync.sh" once >/dev/null 2>&1 \
    || true
}

task_rick_inbox_scan() {
  local inbox="${FOREVER_RICK_INBOX:-$HOME/Sync/rick/FLEET-INBOX}"
  [[ -d "$inbox" ]] || return 0
  local n; n="$(find "$inbox" -maxdepth 1 -name '*.md' -type f 2>/dev/null | wc -l | tr -d ' ')"
  [[ "$n" -gt 0 ]] && log_line "rick_inbox: ${n} mission(s) waiting"
}

task_empire_intake() {
  bash "$SWARM_ROOT/scripts/mesh/empire-intake.sh" >/dev/null 2>&1 || true
}

run_task() {
  case "$1" in
    sync) task_sync ;;
    presence) task_presence ;;
    heartbeat) task_heartbeat ;;
    dispatch) task_dispatch ;;
    empire_intake) task_empire_intake ;;
    ghl_audit) task_ghl_audit ;;
    integration_probe) task_integration_probe ;;
    build_probe) task_build_probe ;;
    brain_ping) task_brain_ping ;;
    memory_once) task_memory_once ;;
    rick_inbox_scan) task_rick_inbox_scan ;;
  esac
}

role_tasks() {
  case "$ROLE" in
    carry|owner) echo "sync presence heartbeat dispatch empire_intake ghl_audit integration_probe" ;;
    forge)       echo "sync presence heartbeat dispatch build_probe integration_probe" ;;
    brain)       echo "sync presence heartbeat brain_ping memory_once" ;;
    ops)         echo "sync presence heartbeat integration_probe" ;;
    rick)        echo "sync presence heartbeat rick_inbox_scan dispatch" ;;
    *)           echo "sync presence heartbeat" ;;
  esac
}

tick() {
  dark && { log_line "tick skipped — DARK"; return 0; }
  log_line "tick start"
  for t in $(role_tasks); do
    run_task "$t" || true
  done
  log_line "tick done"
}

loop() {
  local interval="${1:-$INTERVAL}"
  info "forever-loop: role=$ROLE every ${interval}s — Ctrl-C to stop"
  trap 'log_line "forever-loop stopped"; exit 0' INT TERM
  while true; do
    tick
    sleep "$interval"
  done
}

status() {
  say "${BOLD}— FOREVER LOOP —${RST}"
  say "role: $ROLE · interval: ${INTERVAL}s"
  dark && warn "DARK — ticks are skipped" || ok "clear (ticks active when daemon loaded)"
  [[ -f "$LOG" ]] && { say "last ticks:"; tail -n 8 "$LOG" | sed 's/^/   /'; }
  launchctl list 2>/dev/null | grep -E 'com.tmmt.(forever-loop|presence|router)' | sed 's/^/   /' || true
  bash "$SWARM_ROOT/scripts/heartbeat.sh" status 2>/dev/null | head -8 || true
}

case "${1:-status}" in
  tick) tick;;
  loop) shift; loop "${1:-$INTERVAL}";;
  status) status;;
  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//';;
  *) die "usage: forever-loop.sh [tick | loop [secs] | status]";;
esac
