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
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT" || exit 1
[ -f "$ROOT/scripts/lib/swarm-common.sh" ] && source "$ROOT/scripts/lib/swarm-common.sh" 2>/dev/null || true
type swarm_machine >/dev/null 2>&1 || swarm_machine(){ hostname -s 2>/dev/null | tr '[:upper:] ' '[:lower:]-'; }

COORD_BRANCH="${SWARM_COORD_BRANCH:-swarm-coord}"
REMOTE_PATH="${SWARM_REMOTE_PATH:-~/Projects/TMMT}"
SSH_USER="${SSH_ASSIST_USER:-${USER:-$(id -un)}}"
ME="$(swarm_machine)"

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
  printf '\n%s   RANGERS ONLINE%s\n' "$BD" "$X"
  # mesh.tsv columns: 1=name 2=os 3=role 4=tailscale 5=status
  while IFS=$'\t' read -r name os role ts status rest; do
    [ -z "$name" ] && continue
    [ "$name" = "$ME" ] && continue                  # this device handled below
    case "$status" in *online*|*assistable*|*assisting*) : ;; *) continue ;; esac
    if [ -z "$ts" ]; then printf '   %s• %s — no Tailscale address (skip; run: tmmt serve)%s\n' "$Y" "$name" "$X"; continue; fi
    printf '   ⚡ %s%-14s%s %s@ %s%s → up %s\n' "$BD" "$name" "$X" "${role:+($role) }" "$ts" "" "$N"
    if [ "$DRY" = 0 ]; then
      if ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=8 -o BatchMode=yes \
            "${SSH_USER}@${ts}" "cd ${REMOTE_PATH} 2>/dev/null && bash scripts/swarm.sh up ${N}" \
            </dev/null >/dev/null 2>&1; then
        printf '      %s✓ %s powered up (+%s agents)%s\n' "$G" "$name" "$N" "$X"
        summoned=$((summoned+1)); reached=$((reached+1)); total_agents=$((total_agents+N))
      else
        printf '      %s✗ %s unreachable — needs: tmmt serve + tailscale up --ssh%s\n' "$R" "$name" "$X"
      fi
    else
      summoned=$((summoned+1)); total_agents=$((total_agents+N))
    fi
  done <<< "$ROSTER"
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
