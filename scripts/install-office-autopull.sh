#!/usr/bin/env bash
# Install launchd job for periodic git pull on office Mac.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_LABEL="com.aixmos.tmmt-git-pull"
PLIST_PATH="${HOME}/Library/LaunchAgents/${PLIST_LABEL}.plist"
PULL_SCRIPT="${REPO_ROOT}/scripts/office-git-pull.sh"
LOG_DIR="${HOME}/Library/Logs"

chmod +x "${REPO_ROOT}/scripts/sync-machine.sh"
chmod +x "${REPO_ROOT}/scripts/office-git-pull.sh"
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
    <string>${PULL_SCRIPT}</string>
  </array>
  <key>StartInterval</key>
  <integer>300</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/tmmt-git-pull.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/tmmt-git-pull.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/${PLIST_LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"
launchctl enable "gui/$(id -u)/${PLIST_LABEL}"

echo "Installed ${PLIST_PATH}"
echo "Log: ${LOG_DIR}/tmmt-git-pull.log"
echo "Test: bash ${PULL_SCRIPT}"
