#!/usr/bin/env bash
# fanout — 🦾 THE CROSSOVER. One word and EVERY online device powers up N agents;
# they combine into one swarm working the shared board. Reads the mesh roster
# (mesh.tsv on swarm-coord), reaches each online node over Tailscale SSH, runs
# `swarm.sh up N` there, and on this device too.
#
#   bash scripts/fanout.sh [N]            summon N agents on EVERY online device
#   bash scripts/fanout.sh [N] --dry      roll call only — show who'd be summoned
#   bash scripts/tmmt fanout 3            (one-word system)
#
# Safe: honors the DARK kill-switch; per-node SSH is bounded (8s connect timeout);
# never force-anything; no secrets touched. Coordination stays atomic via the board.
#
# INVARIANT: no data obtained solely from mesh.tsv may authorize remote execution.
# mesh.tsv lives on a shared branch that any node with push access can write, so it
# states what the mesh *claims* — liveness and topology, nothing more. Authorization
# AND the SSH destination are read from a local authority file that is not on
# swarm-coord, so a forged roster row cannot add a node or redirect execution.
# Fails closed: no authority file, unlisted node, malformed or mismatched
# destination, or unknown host key -> no SSH.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT" || exit 1
[ -f "$ROOT/scripts/lib/swarm-common.sh" ] && source "$ROOT/scripts/lib/swarm-common.sh" 2>/dev/null || true
type swarm_machine >/dev/null 2>&1 || swarm_machine(){ hostname -s 2>/dev/null | tr '[:upper:] ' '[:lower:]-'; }

COORD_BRANCH="${SWARM_COORD_BRANCH:-swarm-coord}"
REMOTE_PATH="${SWARM_REMOTE_PATH:-~/Projects/TMMT}"
SSH_USER="${SSH_ASSIST_USER:-${USER:-$(id -un)}}"
ME="$(swarm_machine)"

# Local authority for who may be executed on, and at which address. Owner-written,
# mode 600, deliberately OUTSIDE the repo and off the coordination branch.
#   format, tab-separated, '#' comments allowed:   machine<TAB>destination
MESH_AUTHZ="${MESH_AUTHZ_FILE:-$HOME/.config/tmmt/mesh-authorized.tsv}"

# Authorized destination for a machine name, or empty if it is not authorized.
authorized_dest() {
  [ -r "$MESH_AUTHZ" ] || return 0
  awk -F'\t' -v m="$1" '
    /^[[:space:]]*#/ { next }
    NF >= 2 && $1 == m { gsub(/[ \t\r]/, "", $2); print $2; exit }
  ' "$MESH_AUTHZ" 2>/dev/null
}

# A destination must be a bare host/address: no whitespace, no shell metacharacters,
# no user@ or path components that could reshape the ssh invocation.
valid_dest() { printf '%s' "$1" | grep -qE '^[A-Za-z0-9][A-Za-z0-9._:-]*$'; }

# parse args: first integer = N; --dry/--print anywhere = roll call only
N=2; DRY=0
for a in "$@"; do
  case "$a" in
    --dry|--print|--rollcall) DRY=1 ;;
    *) [[ "$a" =~ ^[0-9]+$ ]] && N="$a" ;;
  esac
done

if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; M=$'\e[35m'; BD=$'\e[1m'; X=$'\e[0m'; else G=; Y=; R=; C=; M=; BD=; X=; fi

# DARK kill-switch
[ -f "$ROOT/.swarm/DARK" ] && { printf '%s⛔ DARK — fanout is stopped. Lift: bash scripts/godark lift%s\n' "$R" "$X"; exit 1; }

# BARN DOOR: brace containment before unleashing the fleet (skip on dry roll-call).
if [ "$DRY" = 0 ] && [ -x "$ROOT/scripts/containment.sh" ]; then
  bash "$ROOT/scripts/containment.sh" --gate || { printf '%s⛔ containment failed — fanout blocked. Run: bash scripts/tmmt barn%s\n' "$R" "$X"; exit 1; }
fi

cat <<EOF
${M}${BD}
   ╔══════════════════════════════════════════════════════════╗
   ║   🦾  F A N O U T  —  IT'S MORPHIN TIME                   ║
   ║   every online device · ${N} agents each · one swarm        ║
   ╚══════════════════════════════════════════════════════════╝${X}
   board: ${COORD_BRANCH}   you: ${BD}${ME}${X}   $( [ "$DRY" = 1 ] && echo "${Y}(roll call — no launch)${X}" )
EOF

# Pull the live roster from the coordination branch.
git fetch -q origin "$COORD_BRANCH" 2>/dev/null || true
ROSTER="$(git show "origin/$COORD_BRANCH:mesh.tsv" 2>/dev/null || true)"

summoned=0; reached=0; total_agents=0
if [ -z "$ROSTER" ]; then
  printf '%s• no mesh roster yet — have devices run: bash scripts/tmmt serve%s\n' "$Y" "$X"
else
  if [ ! -r "$MESH_AUTHZ" ]; then
    printf '\n   %s⛔ FAIL CLOSED — no mesh authority file at %s%s\n' "$R" "$MESH_AUTHZ" "$X"
    printf '   %sRemote execution is disabled: mesh.tsv alone cannot authorize SSH.%s\n' "$Y" "$X"
    printf '   %sCreate it (owner only, chmod 600), one authorized node per line:%s\n' "$Y" "$X"
    printf '       machine<TAB>destination\n'
  fi
  printf '\n%s   RANGERS ONLINE%s\n' "$BD" "$X"
  # mesh.tsv columns: 1=name 2=os 3=role 4=tailscale 5=status
  # NOTE: tab is IFS *whitespace*, so `IFS=$'\t' read` collapses runs of tabs and an
  # empty column silently shifts every field after it (an empty address made `status`
  # parse as the timestamp). Translate to a non-whitespace separator so empty columns
  # are preserved and each field keeps its meaning.
  while IFS=$'\037' read -r name os role ts status rest; do
    [ -z "$name" ] && continue
    [ "$name" = "$ME" ] && continue                  # this device handled below
    case "$status" in *online*|*assistable*|*assisting*) : ;; *) continue ;; esac
    # ── AUTHORITY FENCE ── the roster proposes; the local authority file decides.
    dest="$(authorized_dest "$name")"
    if [ -z "$dest" ]; then
      printf '   %s⛔ %-14s REFUSED — not authorized in %s%s\n' "$R" "$name" "$MESH_AUTHZ" "$X"; continue
    fi
    if ! valid_dest "$dest"; then
      printf '   %s⛔ %-14s REFUSED — malformed authorized destination%s\n' "$R" "$name" "$X"; continue
    fi
    if [ -n "$ts" ] && [ "$ts" != "$dest" ]; then
      printf '   %s⛔ %-14s REFUSED — roster claims %s, authority says %s (possible spoof)%s\n' \
        "$R" "$name" "$ts" "$dest" "$X"; continue
    fi
    printf '   ⚡ %s%-14s%s %s@ %s%s → up %s\n' "$BD" "$name" "$X" "${role:+($role) }" "$dest" "" "$N"
    if [ "$DRY" = 0 ]; then
      # StrictHostKeyChecking=yes (was accept-new): an unknown host key must fail,
      # not be silently trusted, when the destination is externally influenced.
      if ssh -o StrictHostKeyChecking=yes -o ConnectTimeout=8 -o BatchMode=yes \
            "${SSH_USER}@${dest}" "cd ${REMOTE_PATH} 2>/dev/null && bash scripts/swarm.sh up ${N}" \
            </dev/null >/dev/null 2>&1; then
        printf '      %s✓ %s powered up (+%s agents)%s\n' "$G" "$name" "$N" "$X"
        summoned=$((summoned+1)); reached=$((reached+1)); total_agents=$((total_agents+N))
      else
        printf '      %s✗ %s unreachable — needs: tmmt serve + tailscale up --ssh%s\n' "$R" "$name" "$X"
      fi
    else
      summoned=$((summoned+1)); total_agents=$((total_agents+N))
    fi
  done <<< "$(printf '%s\n' "$ROSTER" | tr '\t' '\037')"
fi

# This device joins the megazord.
printf '\n   ⚡ %s%-14s%s (this device) → up %s\n' "$BD" "$ME" "$X" "$N"
if [ "$DRY" = 0 ]; then
  if bash "$ROOT/scripts/swarm.sh" up "$N"; then
    printf '      %s✓ %s powered up (+%s agents)%s\n' "$G" "$ME" "$N" "$X"; total_agents=$((total_agents+N)); summoned=$((summoned+1))
  else
    printf '      %s✗ local launch failed%s\n' "$R" "$X"
  fi
else
  total_agents=$((total_agents+N)); summoned=$((summoned+1))
fi

cat <<EOF

${G}${BD}   🦾 MEGAZORD ASSEMBLED.${X}
   devices summoned: ${BD}${summoned}${X}   $( [ "$DRY" = 0 ] && echo "remote reached: ${reached}" )   agents in play: ${BD}${total_agents}${X}
   watch them: ${BD}bash scripts/tmmt watchtower${X}   ·   on a node: ${BD}tmux attach -t swarm${X}
   they claim atomic tasks from the board — no two agents touch the same job.
EOF
