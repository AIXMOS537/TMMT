#!/usr/bin/env bash
# unison — bring the whole home base online as ONE coordinated system.
# This is the single switch: HAILMARY (the Owner's agent) + the memory loop
# (Phase 3) + always-on mesh presence, booted in order so everything moves in
# unison. AIXMOS (the network brain) governs the swarm/operatives; this wires the
# home base it runs on. Charters: docs/HAILMARY-CHARTER.md, docs/AIXMOS-CHARTER.md
#
#   bash scripts/mesh/unison.sh up        boot everything (the unison switch)
#   bash scripts/mesh/unison.sh status    one-glance health of the whole base
#   bash scripts/mesh/unison.sh down      stand the base down (memory kept)
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh"
R="$SWARM_ROOT"

up() {
  say "${BOLD}— UNISON: bringing the home base online —${RST}"
  # 1. HAILMARY: boot + self-audit + absorb + (macOS) always-on presence.
  info "1/3  HAILMARY booyah"
  bash "$R/scripts/hailmary" booyah || warn "hailmary boot reported issues"
  # 2. Memory loop (Phase 3): push absorbed memory → BRAINIAC's Obsidian vault.
  info "2/3  memory loop"
  if [[ "$(swarm_os)" == "macos" && -n "${HAILMARY_VAULT:-}" ]]; then
    bash "$R/scripts/mesh/memory-sync.sh" install 300 || warn "memory-sync install skipped"
  elif [[ -n "${HAILMARY_VAULT:-}" ]]; then
    bash "$R/scripts/mesh/memory-sync.sh" once || true
  else
    warn "HAILMARY_VAULT unset — memory stays local (set it to stream into Obsidian)"
  fi
  # 3. Mesh presence already ensured by booyah on macOS; confirm on the board.
  info "3/3  mesh presence"
  bash "$R/scripts/swarm.sh" beat "${SWARM_ROLE:-owner}" online >/dev/null 2>&1 \
    && ok "marked online on the mesh board" || warn "could not update mesh board"
  say
  ok "${BOLD}UNISON COMPLETE — the base is live and moving as one.${RST} 🤖⚡"
  say "   work:   bash scripts/tmmt go 2     (AIXMOS dispatches the swarm)"
  say "   check:  bash scripts/mesh/unison.sh status"
}

status() {
  say "${BOLD}— UNISON status —${RST}"
  bash "$R/scripts/hailmary" status
  say
  bash "$R/scripts/mesh/memory-sync.sh" status 2>/dev/null || true
  say
  bash "$R/scripts/swarm.sh" mesh 2>/dev/null | head -15 || warn "mesh roster unavailable"
}

down() {
  info "standing the base down (memory kept)…"
  bash "$R/scripts/hailmary" standby || true
  [[ "$(swarm_os)" == "macos" ]] && bash "$R/scripts/mesh/memory-sync.sh" uninstall || true
  ok "home base on standby."
}

case "${1:-up}" in
  up|on|boot) up;;
  status|state) status;;
  down|off|standby) down;;
  *) die "usage: unison.sh [up | status | down]";;
esac
