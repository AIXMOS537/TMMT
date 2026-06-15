#!/usr/bin/env bash
# tmmt-up — the ONE thing you give a TMMT laptop. Double-click on a Mac (.command)
# or run: bash scripts/tmmt-up.command
#
# It onboards the device to the mesh (if needed), goes assistable, and then stays
# in sync + alive so you (or your team, or the agent) can reach it when things go
# down. Safe to re-run.
#
#   bash scripts/tmmt-up.command                 # asks role (owner/operator)
#   bash scripts/tmmt-up.command operator        # field laptop
#   bash scripts/tmmt-up.command owner           # your carry Mac
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
source "$ROOT/scripts/lib/swarm-common.sh"

ROLE="${1:-}"
if [[ -z "$ROLE" ]]; then
  printf 'Role for THIS machine [operator/owner] (default operator): ' >&2
  read -r ROLE || true; ROLE="${ROLE:-operator}"
fi
export SWARM_ROLE="$ROLE"

say "${BOLD}=== TMMT UP — $(swarm_machine) as '$ROLE' on $(swarm_os) ===${RST}"

# 1) Onboard if this machine isn't on the mesh yet (idempotent).
if [[ ! -f "$ROOT/.swarm/machine" ]]; then
  info "first run — onboarding this device..."
  bash "$ROOT/scripts/swarm-join.sh" || warn "join had warnings — review above"
else
  ok "already onboarded as '$(swarm_machine)'. Syncing..."
  bash "$ROOT/scripts/sync-machine.sh" >/dev/null 2>&1 || true
fi

# 2) Quick security check — never go live dirty.
bash "$ROOT/scripts/swarm-doctor.sh" --quick || { warn "doctor found FAILs — fix before going live."; exit 1; }

# 3) Operators go assistable so the owner can step in.
if [[ "$ROLE" == "operator" ]]; then
  bash "$ROOT/scripts/mesh/link.sh" serve || true
fi

# 4) Stay alive: sync + heartbeat in the foreground (close the window to stop).
say ""
ok "${BOLD}$(swarm_machine) is live on the mesh.${RST}"
say "Owner sees you with:   bash scripts/mesh/link.sh who"
say "If you need help:       bash scripts/mesh/link.sh request \"what's wrong\""
say "Run the swarm:          bash scripts/swarm.sh up 2"
say ""
info "starting presence (Ctrl-C to go offline)..."
exec bash "$ROOT/scripts/mesh/presence.sh" loop 120 "$ROLE"
