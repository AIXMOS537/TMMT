#!/usr/bin/env bash
# Optional: install LaunchAgent for iMessage DB watcher (off unless .env enables).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_LABEL="com.aixmos.tmmt-imessage-command-watcher"
PLIST_PATH="${HOME}/Library/LaunchAgents/${PLIST_LABEL}.plist"
WATCH="${REPO_ROOT}/scripts/office-agent-channel/imessage_command_watcher.py"
LOG_DIR="${HOME}/Library/Logs"

chmod +x "$WATCH"
mkdir -p "$LOG_DIR"
touch "${LOG_DIR}/tmmt-imessage-watcher.log"

cat >"$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>${WATCH}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${REPO_ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>TMMT_REPO_ROOT</key>
    <string>${REPO_ROOT}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/tmmt-imessage-watcher.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/tmmt-imessage-watcher.log</string>
</dict>
</plist>
EOF

echo "Installed ${PLIST_PATH}"
echo "Set IMESSAGE_WATCHER_ENABLED=1 and IMESSAGE_ALLOWED_HANDLES in office-agent-channel/.env"
echo "Enable: ${REPO_ROOT}/scripts/enable-imessage-command-watcher.sh"
