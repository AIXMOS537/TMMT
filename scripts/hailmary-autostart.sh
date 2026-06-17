#!/usr/bin/env bash
#
# Install HAILMARY as always-on on the home M1 Mac — starts at login, restarts
# forever (KeepAlive), and keeps the Mac awake (caffeinate). This is what makes
# the M1 "be the owner, forever and always."
#
# Usage: bash scripts/hailmary-autostart.sh        (run once on the home Mac)
#        bash scripts/hailmary-autostart.sh --uninstall
set -euo pipefail

[ "$(uname)" = "Darwin" ] || { echo "macOS only (the home M1)."; exit 1; }
REPO="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.aixmos.hailmary"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DAEMON="$REPO/scripts/hailmary-daemon.sh"

if [ "${1:-}" = "--uninstall" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "✓ HAILMARY always-on removed."
  exit 0
fi

[ -f "$DAEMON" ] || { echo "daemon not found: $DAEMON"; exit 1; }
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.hailmary"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string><string>-is</string>
    <string>/bin/bash</string><string>$DAEMON</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$HOME/.hailmary/daemon.out.log</string>
  <key>StandardErrorPath</key><string>$HOME/.hailmary/daemon.err.log</string>
</dict></plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "✓ HAILMARY always-on installed: $PLIST"
echo "  Runs at login, restarts forever, keeps the Mac awake (caffeinate)."
echo "  Logs: ~/.hailmary/daemon.log  ·  stop: bash scripts/hailmary-autostart.sh --uninstall"
