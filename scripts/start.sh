#!/usr/bin/env bash
# START HERE — the ONE front door for everything TMMT.
# Anyone can use this: pick a number, press Enter. You cannot break anything.
#
# How to open it:
#   Mac:      double-click  START-HERE.command
#   Windows:  double-click  START-HERE.cmd
#   Any:      bash scripts/start.sh
#
# Under the hood it just calls the proven `scripts/tmmt` router with plain words,
# so there is nothing new to maintain — this is only a friendly face on it.
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
cd "$ROOT"
TMMT="$ROOT/scripts/tmmt"

# Colors, with a plain fallback so it looks fine on any device.
if [ -t 1 ] && command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
  B="$(tput bold)"; D="$(tput dim)"; G="$(tput setaf 2)"; Y="$(tput setaf 3)"; C="$(tput setaf 6)"; R="$(tput sgr0)"
else
  B=""; D=""; G=""; Y=""; C=""; R=""
fi

pause(){ printf '\n%s' "${D}Press Enter to go back to the menu...${R}"; read -r _ || true; }

run(){ # run a tmmt word in a friendly way
  printf '\n%s\n\n' "${C}Working on it...${R}"
  if [ ! -f "$TMMT" ]; then
    printf '%s\n' "${Y}Setup files are missing. Please ask the owner, or use option 3 (Get help).${R}"
  else
    bash "$TMMT" "$@" || printf '\n%s\n' "${Y}That did not fully finish. Try option 7 (Check), or option 3 (Get help).${R}"
  fi
  pause
}

# Gentle, one-time checks (we only warn — never block).
NEED=""
command -v git >/dev/null 2>&1 || NEED="git"
FIRST="no"; [ -f "$ROOT/.swarm/machine" ] || FIRST="yes"

while true; do
  clear 2>/dev/null || true
  printf '%s\n'   "${B}${C}==================================================${R}"
  printf '%s\n'   "${B}${C}        T M M T   —   S T A R T   H E R E         ${R}"
  printf '%s\n'   "${B}${C}==================================================${R}"
  printf '\n%s\n' "  ${D}Pick a number and press Enter. You cannot break anything.${R}"
  [ "$FIRST" = "yes" ] && printf '%s\n' "  ${Y}* New device? Press 1 first to set it up.${R}"
  printf '\n'
  printf '%s\n' "   ${G}1${R})   ${B}TURN IT ON${R}       set up this device and connect it"
  printf '%s\n' "   ${G}2${R})   ${B}SEE EVERYONE${R}     which devices are online right now"
  printf '%s\n' "   ${G}3${R})   ${B}GET HELP${R}         buzz the owner to come help you"
  printf '%s\n' "   ${G}4${R})   ${B}DO WORK${R}          start the helper agents"
  printf '%s\n' "   ${G}5${R})   ${B}OPEN THE APP${R}     run the TMMT app on this device"
  printf '%s\n' "   ${G}6${R})   ${B}UPDATE${R}           get the very latest"
  printf '%s\n' "   ${G}7${R})   ${B}CHECK${R}            is everything okay and safe?"
  printf '%s\n' "   ${G}0${R})   ${B}DONE${R}             close this menu"
  printf '\n'
  [ -n "$NEED" ] && printf '%s\n\n' "  ${Y}Heads up: '${NEED}' is not installed yet. Option 7 (Check) will guide you.${R}"
  printf '%s' "  ${B}Your pick:${R} "
  read -r pick || exit 0
  case "$pick" in
    1) FIRST="no"; run up ;;
    2) run who ;;
    3) printf "\n  What is wrong? (say it in your own words): "; read -r why || why="help needed"; run help "${why:-help needed}" ;;
    4) run go 2 ;;
    5) run local ;;
    6) run sync ;;
    7) run fix ;;
    0|q|Q|"") clear 2>/dev/null || true; printf '%s\n' "${G}All good. See you next time!${R}"; exit 0 ;;
    *) : ;;
  esac
done
