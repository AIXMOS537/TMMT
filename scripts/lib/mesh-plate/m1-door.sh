#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SYNC_INBOX="$HOME/Sync/rick/FLEET-INBOX"
ok(){ printf '\033[32m✓\033[0m %s\n' "$*"; }
warn(){ printf '\033[33m!\033[0m %s\n' "$*"; }
send_mission() {
  mkdir -p "$SYNC_INBOX"
  local f="$SYNC_INBOX/mission-$(date +%Y%m%d-%H%M%S).md"
  printf '# RICK MISSION\n%s\nRun: bash ~/Sync/rick/RUN-FLEET-UP.sh\n' "$*" > "$f"
  ok "Mission → $f"
}
case "${1:-status}" in
  send|mission) shift; send_mission "$*" ;;
  *) warn "Rick M1 — Syncthing only"; ok "~/Sync/rick mirror"; echo "  On M1: bash ~/Sync/rick/RUN-FLEET-UP.sh" ;;
esac
