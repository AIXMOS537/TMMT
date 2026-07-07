#!/usr/bin/env bash
# install-booyah-daily.sh — run BOOYAH every morning at login + 7:00 AM local.
#
#   bash scripts/mesh/install-booyah-daily.sh install
#   bash scripts/mesh/install-booyah-daily.sh status
#   bash scripts/mesh/install-booyah-daily.sh uninstall
#
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LABEL="com.tmmt.booyah-daily"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
SCRIPT="$ROOT/scripts/booyah-daily.sh"
LOG="$HOME/.config/tmmt/booyah-daily.log"

[[ "$(uname -s)" == "Darwin" ]] || { echo "macOS only"; exit 1; }
[[ -x "$SCRIPT" ]] || { echo "missing $SCRIPT"; exit 1; }

cmd_install() {
  mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.config/tmmt"
  local brewbin=""
  [[ -x /opt/homebrew/bin/brew ]] && brewbin="/opt/homebrew/bin:"
  [[ -x /usr/local/bin/brew ]] && brewbin="${brewbin}/usr/local/bin:"
  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${SCRIPT}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>7</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>LOCAL_FIRST</key><string>1</string>
    <key>PATH</key><string>${brewbin}/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict></plist>
PLIST
  launchctl unload "$PLIST" >/dev/null 2>&1 || true
  launchctl load -w "$PLIST" 2>/dev/null \
    && printf '✓ BOOYAH daily installed — login + 7:00 AM · log: %s\n' "$LOG" \
    || { echo "load failed: launchctl load -w $PLIST"; exit 1; }
}

cmd_status() {
  if launchctl list 2>/dev/null | grep -q "$LABEL"; then
    printf '✓ BOOYAH daily LaunchAgent loaded\n'
    launchctl list | grep "$LABEL" | sed 's/^/   /'
  else
    printf '○ not installed — run: bash scripts/mesh/install-booyah-daily.sh install\n'
  fi
  [[ -f "$LOG" ]] && { echo "last log:"; tail -n 8 "$LOG" | sed 's/^/   /'; }
}

cmd_uninstall() {
  launchctl unload "$PLIST" >/dev/null 2>&1 || true
  rm -f "$PLIST"
  printf '✓ BOOYAH daily removed\n'
}

case "${1:-install}" in
  install) cmd_install ;;
  status) cmd_status ;;
  uninstall|off) cmd_uninstall ;;
  *) echo "usage: install | status | uninstall"; exit 1 ;;
esac
