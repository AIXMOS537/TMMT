#!/usr/bin/env bash
# Quick health check for office TMMT services.

set -euo pipefail

echo "=== LaunchAgents ==="
launchctl list 2>/dev/null | grep tmmt || echo "  (none loaded — run enable-office-services.sh in Terminal.app)"

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
  echo "  Exit 126 / Operation not permitted: reinstall plists, then grant Full Disk Access"
  echo "  to /bin/bash (System Settings → Privacy & Security → Full Disk Access), or run:"
  echo "    bash ~/dev/TMMT/scripts/install-office-autopull.sh"
  echo "    bash ~/dev/TMMT/scripts/install-office-dev-server.sh"
  echo "    bash ~/dev/TMMT/scripts/enable-office-services.sh"
  echo ""
fi

echo "=== Logs (last 3 lines each) ==="
for f in tmmt-dev tmmt-git-pull; do
  echo "--- ~/${f}.log ---"
  tail -3 "${HOME}/Library/Logs/${f}.log" 2>/dev/null || echo "  (missing)"
done
