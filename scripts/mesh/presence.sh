#!/usr/bin/env bash
# Presence — keep this machine in sync and announce it's alive on the mesh, so
# the owner can see who's online and reach them when things go down.
#
#   bash scripts/mesh/presence.sh beat [role]          # one heartbeat (role: owner|operator|agent)
#   bash scripts/mesh/presence.sh loop [seconds] [role]# sync + heartbeat forever (default 120s, operator)
#   bash scripts/mesh/presence.sh who                  # who's online right now
#
# Leave `loop` running at login (or wrap it in tmmt-up.command). It does NOT need
# Tailscale — presence rides the same GitHub coordination branch as the swarm.
# Tailscale only matters for the remote-assist link (see mesh/link.sh).
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh"
cd "$SWARM_ROOT"

ROLE_DEFAULT=operator

beat() {
  local role="${1:-$ROLE_DEFAULT}" status="${2:-online}"
  bash "$SWARM_ROOT/scripts/swarm.sh" beat "$role" "$status" >/dev/null 2>&1 \
    && ok "heartbeat sent ($(swarm_machine) · $role · $status$( [[ -n "$(tailscale_self)" ]] && echo " · $(tailscale_self)" ))" \
    || warn "heartbeat failed (offline? no git write access?)"
}

loop() {
  local interval="${1:-120}" role="${2:-$ROLE_DEFAULT}"
  info "presence loop: every ${interval}s, sync + heartbeat as '$role'. Ctrl-C to stop."
  trap 'bash "$SWARM_ROOT/scripts/swarm.sh" beat "$role" offline >/dev/null 2>&1; warn "presence stopped — marked offline"; exit 0' INT TERM
  while true; do
    bash "$SWARM_ROOT/scripts/sync-machine.sh" >/dev/null 2>&1 || true
    beat "$role" online
    sleep "$interval"
  done
}

who() { bash "$SWARM_ROOT/scripts/swarm.sh" mesh; }

case "${1:-who}" in
  beat) shift; beat "${1:-}" "${2:-}";;
  loop) shift; loop "${1:-120}" "${2:-$ROLE_DEFAULT}";;
  who|status) who;;
  *) die "usage: presence.sh [beat <role> | loop [secs] [role] | who]";;
esac
