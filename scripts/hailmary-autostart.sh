#!/usr/bin/env bash
#
# Install HAILMARY as always-on on macOS — starts at login, restarts forever.
# Uses stable ~/.hailmary/bin/hailmary-daemon.sh (repo reset safe).
#
# Usage: bash scripts/hailmary-autostart.sh
#        bash scripts/hailmary-autostart.sh --uninstall
set -euo pipefail

[ "$(uname)" = "Darwin" ] || { echo "macOS only."; exit 1; }
REPO="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.aixmos.hailmary"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
STABLE="$HOME/.hailmary/bin/hailmary-daemon.sh"
SRC="$REPO/scripts/hailmary-daemon.sh"

if [ "${1:-}" = "--uninstall" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "✓ HAILMARY always-on removed."
  exit 0
fi

[ -f "$SRC" ] || { echo "daemon not found: $SRC"; exit 1; }
mkdir -p "$HOME/.hailmary/bin" "$HOME/.hailmary/lib" "$HOME/Library/LaunchAgents"
cp "$SRC" "$STABLE"
chmod +x "$STABLE"
[ -f "$REPO/scripts/lib/x-profile.sh" ] && cp "$REPO/scripts/lib/x-profile.sh" "$HOME/.hailmary/lib/"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string><string>-is</string>
    <string>/bin/bash</string><string>$STABLE</string>
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
echo "✓ HAILMARY always-on installed → $STABLE"
echo "  Logs: ~/.hailmary/daemon.log  ·  stop: bash scripts/hailmary-autostart.sh --uninstall"
