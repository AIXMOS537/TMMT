#!/usr/bin/env bash
# Install LaunchAgent: sync TMMT OS + docked LEXAR/CYBORG when USB volumes are mounted.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_LABEL="com.aixmos.tmmt-flash-usb-sync"
PLIST_PATH="${HOME}/Library/LaunchAgents/${PLIST_LABEL}.plist"
SYNC_SCRIPT="${REPO_ROOT}/scripts/sync-all-flash-drives.sh"
LOG_DIR="${HOME}/Library/Logs"

chmod +x "${SYNC_SCRIPT}"
xattr -dr com.apple.quarantine "${REPO_ROOT}/scripts" 2>/dev/null || true
mkdir -p "$LOG_DIR" "${HOME}/Library/Application Support/TMMT"
touch "${LOG_DIR}/tmmt-flash-usb-sync.log"

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
    <string>${SYNC_SCRIPT}</string>
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
  <integer>120</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/tmmt-flash-usb-sync.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/tmmt-flash-usb-sync.log</string>
</dict>
</plist>
EOF

echo "Installed ${PLIST_PATH}"
echo "Log: ${LOG_DIR}/tmmt-flash-usb-sync.log"
echo "Enable: ${REPO_ROOT}/scripts/enable-flash-usb-sync.sh"
