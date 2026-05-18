#!/usr/bin/env bash
# Install launchd KeepAlive job for office dev server (Next.js on 0.0.0.0:3000).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_LABEL="com.aixmos.tmmt-dev-server"
PLIST_PATH="${HOME}/Library/LaunchAgents/${PLIST_LABEL}.plist"
DEV_SCRIPT="${REPO_ROOT}/scripts/office-dev-server.sh"
LOG_DIR="${HOME}/Library/Logs"

chmod +x "${REPO_ROOT}/scripts/office-dev-server.sh"
mkdir -p "$LOG_DIR"

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
    <string>${DEV_SCRIPT}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${REPO_ROOT}/tmmt-os</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>TMMT_DEV_PORT</key>
    <string>3000</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/tmmt-dev.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/tmmt-dev.log</string>
</dict>
</plist>
EOF

echo "Installed ${PLIST_PATH}"
echo "Log: ${LOG_DIR}/tmmt-dev.log"
echo "Enable: ${REPO_ROOT}/scripts/enable-office-dev-server.sh"
echo "Requires: tmmt-os/.env.local"
