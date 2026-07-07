#!/usr/bin/env bash
# control-board.sh — owner one-screen commands (grant · heartbeat · onboard pack)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for d in "$HOME/Projects/TMMT" "$HOME/projects/TMMT" "$HOME/TMMT"; do
  [[ -f "$d/scripts/grant.sh" ]] && ROOT="$d" && break
done
D='' X=''
if [[ -t 1 ]]; then D=$'\e[2m'; X=$'\e[0m'; fi

clear 2>/dev/null || true
printf '\033[1m'
cat <<'B'

   ╔══════════════════════════════════════════════════╗
   ║   👑  T M M T  —  YOUR CONTROL BOARD              ║
   ║       transportation · academy · the engine      ║
   ╚══════════════════════════════════════════════════╝
B
printf '\033[0m'
printf "\033[42;30m  📤 ONBOARD          \033[0m  files to send someone  →  \033[1mopen %s/dist\033[0m\n" "$ROOT"
printf "\033[44;97m  🪪 GRANT            \033[0m  say YES to a card      →  \033[1mbash %s/scripts/grant.sh <card.txt>\033[0m\n" "$ROOT"
printf "\033[44;97m  👥 WHO'S IN         \033[0m  see your operators     →  \033[1mbash %s/scripts/grant.sh list\033[0m\n" "$ROOT"
printf "\033[46;30m  ❤️  WHO'S ONLINE     \033[0m  device heartbeats      →  \033[1mbash %s/scripts/heartbeat.sh status\033[0m\n" "$ROOT"
printf "\033[43;30m  🔐 SECURE MY STUFF  \033[0m  lock top accounts      →  \033[1mbash %s/scripts/account-hardening.sh top\033[0m\n" "$ROOT"
printf "\033[45;97m  🔎 SCAN THIS MAC    \033[0m  is it clean?           →  \033[1mbash %s/scripts/device-integrity.sh\033[0m\n" "$ROOT"
printf "\033[42;97m  ⚡ FOREVER LOOP     \033[0m  agents run as a team   →  \033[1mbash %s/scripts/forever-up.sh\033[0m\n" "$ROOT"
printf "\033[41;97m  👑 APEX             \033[0m  THE sovereign stack    →  \033[1mapex\033[0m  ${D}(sovereign · seals)${X}\n"
echo
printf "\033[2m  the gate: nobody gets in without your YES. everyone starts in DEV.\033[0m\n"
printf "\033[1m  one step at a time. you got this. 🔒\033[0m\n"
echo
