#!/usr/bin/env bash
# rick-autostart — make Rick come up automatically at EVERY login (zero commands after this).
# Installs a macOS LaunchAgent that runs office-up-rick at load. Run once:
#   bash scripts/rick-autostart.sh              install (idempotent)
#   bash scripts/rick-autostart.sh --uninstall  remove
set -euo pipefail
[ "$(uname)" = "Darwin" ] || { echo "macOS only — this wires login autostart on the M1."; exit 1; }
REPO="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.aixmos.rick"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$REPO/.hailmary/rick-boot.log"

if [ "${1:-}" = "--uninstall" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "✓ Rick login-autostart removed."
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents" "$REPO/.hailmary"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string><string>$REPO/scripts/office-up-rick.sh</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "✓ Rick login-autostart installed → office-up-rick runs at every login."
echo "  Log: $LOG  ·  remove: bash scripts/rick-autostart.sh --uninstall"
