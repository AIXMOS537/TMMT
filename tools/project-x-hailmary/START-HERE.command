#!/usr/bin/env bash
# ============================================================
# PROJECT X HAILMARY — START HERE
# Double-click this on any Mac to begin.
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RED='\033[0;31m'; GREEN='\033[0;32m'; GOLD='\033[0;33m'; BOLD='\033[1m'; RESET='\033[0m'
clear
echo -e "${GOLD}${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║         PROJECT X — H A I L M A R Y            ║"
echo "  ║         Powered by AIXMOS / Muhammad Taha        ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo "  What do you need to do?"
echo
echo "  [1] Scan this machine (run FIRST on any new machine)"
echo "  [2] Activate this machine as an operator"
echo "  [3] Revoke an operator (owner only)"
echo "  [4] Restore an operator (owner only)"
echo "  [5] Exit"
echo
read -p "  Choice: " CHOICE
case "$CHOICE" in
  1) bash "$SCRIPT_DIR/scan/scan-machine.sh" ;;
  2) bash "$SCRIPT_DIR/activate/activate.command" ;;
  3) bash "$SCRIPT_DIR/master/revoke.sh" ;;
  4) bash "$SCRIPT_DIR/master/restore.sh" ;;
  5) exit 0 ;;
  *) echo "Invalid choice."; exit 1 ;;
esac
