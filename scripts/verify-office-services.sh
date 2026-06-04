#!/usr/bin/env bash
# Quick health check for office TMMT services.

set -euo pipefail

echo "=== LaunchAgents ==="
launchctl list 2>/dev/null | grep -E 'tmmt|aixmos' || echo "  (none loaded — run enable-office-services.sh in Terminal.app)"

echo ""
echo "=== Port 3000 ==="
if curl -sf -o /dev/null --max-time 3 http://127.0.0.1:3000; then
  echo "  OK  http://127.0.0.1:3000"
  lsof -nP -iTCP:3000 -sTCP:LISTEN 2>/dev/null | tail -1 || true
else
  echo "  DOWN — no response on :3000"
fi

echo ""
if launchctl list 2>/dev/null | grep -q 'com.aixmos.tmmt.*126'; then
  echo "=== LaunchAgent EPERM hint ==="
  echo "  Exit -15 / 126 / Operation not permitted: grant Full Disk Access to /bin/bash + Terminal:"
  echo "    bash ~/dev/TMMT/scripts/open-full-disk-access-settings.sh"
  echo "    bash ~/dev/TMMT/scripts/usb-write-test.sh"
  echo "    bash ~/dev/TMMT/scripts/enable-office-services.sh"
  echo ""
fi

echo "=== Logs (last 3 lines each) ==="
echo ""
echo "=== Flash USB (/Volumes/$(tr -d '[:space:]' <"$(dirname "$0")/flash-usb-volume-name" 2>/dev/null || echo AIXMOS02)) ==="
if [[ -d "/Volumes/$(tr -d '[:space:]' <"$(dirname "$0")/flash-usb-volume-name" 2>/dev/null || echo AIXMOS02)" ]]; then
  echo "  Mounted"
  tail -2 "${HOME}/Library/Logs/tmmt-flash-usb-sync.log" 2>/dev/null || echo "  (no sync log yet)"
else
  echo "  Not mounted"
fi

echo "=== Flash → Mac pull inbox ==="
if [[ -d "$HOME/Documents/TMMT-Flash-Inbox/current" ]]; then
  du -sh "$HOME/Documents/TMMT-Flash-Inbox/current" 2>/dev/null || true
  tail -2 "${HOME}/Library/Logs/tmmt-flash-usb-pull.log" 2>/dev/null || echo "  (no pull log yet)"
else
  echo "  (no inbox yet — plug flash drives or run Pull From Flash Drives)"
fi

echo ""
for f in tmmt-dev tmmt-git-pull tmmt-flash-usb-sync tmmt-flash-usb-pull; do
  echo "--- ~/${f}.log ---"
  tail -3 "${HOME}/Library/Logs/${f}.log" 2>/dev/null || echo "  (missing)"
done
