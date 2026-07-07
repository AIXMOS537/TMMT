#!/usr/bin/env bash
# m1-autopilot.sh — ZERO HUMAN after BLIP · M1 WORK LAW enforced.
set -uo pipefail
MARKER="$HOME/.config/tmmt/.m1-autopilot.done"
LOG="$HOME/Library/Logs/m1-autopilot.log"
TMMT="$HOME/projects/TMMT"
[[ -d "$HOME/Projects/TMMT" ]] && TMMT="$HOME/Projects/TMMT"
mkdir -p "$HOME/.config/tmmt" "$(dirname "$LOG")"
exec >> "$LOG" 2>&1
say(){ printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
say "M1 AUTOPILOT start — M1 WORK LAW active"
if [[ -f "$TMMT/docs/M1-DOCTRINE.txt" ]]; then
  cp -f "$TMMT/docs/M1-DOCTRINE.txt" "$HOME/.config/tmmt/M1-DOCTRINE.txt" 2>/dev/null || true
fi
if [[ ! -d "$TMMT/scripts/tmmt" ]]; then
  mkdir -p "$HOME/projects"
  git clone https://github.com/AIXMOS537/TMMT.git "$TMMT" 2>/dev/null || true
fi
[[ -d "$TMMT" ]] || exit 0
cd "$TMMT"
export PATH="$HOME/.local/bin:$PATH"
ME="$(hostname -s 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-' || echo rick)"
mkdir -p "$TMMT/.swarm"
printf '%s\n' rick > "$TMMT/.swarm/role"
printf '%s\n' "$ME" > "$TMMT/.swarm/machine"
bash "$TMMT/scripts/swarm-join.sh" --name "$ME" 2>/dev/null || true
[[ -f "$HOME/Desktop/X-FOREVER/RUN-X-FOREVER.sh" ]] && bash "$HOME/Desktop/X-FOREVER/RUN-X-FOREVER.sh" 2>/dev/null || true
[[ -x "$TMMT/scripts/mesh/brainiac-via-m1.sh" ]] && bash "$TMMT/scripts/mesh/brainiac-via-m1.sh" 2>/dev/null || say "Brainiac via M1 pending"
[[ -x "$TMMT/scripts/mesh/m1-work-router.sh" ]] && bash "$TMMT/scripts/mesh/m1-work-router.sh" route 2>/dev/null || true
if [[ -f "$TMMT/scripts/mesh/install-forever-loop.sh" ]]; then
  bash "$TMMT/scripts/mesh/install-forever-loop.sh" install rick 120 2>/dev/null || true
fi
if [[ -f "$TMMT/scripts/mesh/forever-loop.sh" ]]; then
  bash "$TMMT/scripts/mesh/forever-loop.sh" tick 2>/dev/null || true
fi
bash "$TMMT/scripts/mesh/m1-fleet-executor.sh" 2>/dev/null || true
date -u +%Y-%m-%dT%H:%M:%SZ > "$MARKER"
say "M1 AUTOPILOT complete — all Taha work routed per law"
