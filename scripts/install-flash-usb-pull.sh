#!/usr/bin/env bash
# Install LaunchAgent: pull from docked flash drives into ~/Documents/TMMT-Flash-Inbox/current

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_LABEL="com.aixmos.tmmt-flash-usb-pull"
PLIST_PATH="${HOME}/Library/LaunchAgents/${PLIST_LABEL}.plist"
PULL_SCRIPT="${REPO_ROOT}/scripts/pull-from-flash-drives.sh"
LOG_DIR="${HOME}/Library/Logs"

chmod +x "${PULL_SCRIPT}"
mkdir -p "$LOG_DIR" "${HOME}/Library/Application Support/TMMT"
touch "${LOG_DIR}/tmmt-flash-usb-pull.log"

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
    <string>${PULL_SCRIPT}</string>
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
  <key>StartInterval</key>
  <integer>300</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/tmmt-flash-usb-pull.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/tmmt-flash-usb-pull.log</string>
</dict>
</plist>
EOF

echo "Installed ${PLIST_PATH}"
echo "Log: ${LOG_DIR}/tmmt-flash-usb-pull.log"
echo "Enable: ${REPO_ROOT}/scripts/enable-flash-usb-pull.sh"
