#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_LABEL="com.aixmos.tmmt-imessage-watcher-login"
PLIST_PATH="${HOME}/Library/LaunchAgents/${PLIST_LABEL}.plist"
STARTER="${REPO_ROOT}/scripts/start-imessage-watcher-via-terminal.sh"
LOG="${HOME}/Library/Logs/tmmt-imessage-watcher-login.log"

chmod +x "$STARTER"
touch "$LOG"

cat >"$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${STARTER}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG}</string>
  <key>StandardErrorPath</key>
  <string>${LOG}</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/${PLIST_LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" 2>/dev/null || launchctl load "$PLIST_PATH" 2>/dev/null || true
echo "Login starter: ${PLIST_PATH}"
