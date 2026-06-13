#!/usr/bin/env bash
# Double-click this on your Mac. Then just press a number. That's it.
cd "$(dirname "$0")"
while true; do
  clear 2>/dev/null || true
  cat <<'M'
============================================
              T M M T   C O N T R O L
============================================
   1)  Turn it ON   (go live on the mesh)
   2)  Who's online
   3)  I NEED HELP   (buzz the owner)
   4)  Do work       (start the agents)
   5)  Health check  (safe to go?)
   6)  Sync now
   0)  Quit
============================================
M
  printf 'Press a number, then Enter: '
  read -r c || exit 0
  case "$c" in
    1) bash scripts/tmmt-up.command ;;
    2) bash scripts/mesh/link.sh who; printf '\n[Enter] to go back...'; read -r _ ;;
    3) printf "What's wrong? "; read -r r; bash scripts/mesh/link.sh request "$r"; printf '\n[Enter] to go back...'; read -r _ ;;
    4) bash scripts/swarm.sh up 2; printf '\n[Enter] to go back...'; read -r _ ;;
    5) bash scripts/swarm-doctor.sh; printf '\n[Enter] to go back...'; read -r _ ;;
    6) bash scripts/sync-machine.sh; printf '\n[Enter] to go back...'; read -r _ ;;
    0|q|Q) clear 2>/dev/null || true; exit 0 ;;
    *) : ;;
  esac
done
