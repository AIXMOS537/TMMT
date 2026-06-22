#!/usr/bin/env bash
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ARIA_DIR="$ROOT/aria"
PLIST="$HOME/Library/LaunchAgents/com.aixmos.aria.plist"
NODE=$(command -v node || /opt/homebrew/bin/node)
NPM=$(command -v npm || /opt/homebrew/bin/npm)
mkdir -p "$HOME/.config/tmmt/logs"
launchctl bootout "gui/$(id -u)/com.aixmos.aria" 2>/dev/null || true
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.aixmos.aria</string>
  <key>ProgramArguments</key><array>
    <string>${NPM}</string><string>run</string><string>start</string>
  </array>
  <key>WorkingDirectory</key><string>${ARIA_DIR}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>${HOME}/.config/tmmt/logs/aria.log</string>
  <key>StandardErrorPath</key><string>${HOME}/.config/tmmt/logs/aria.err</string>
  <key>ThrottleInterval</key><integer>10</integer>
</dict></plist>
PLIST
launchctl bootstrap "gui/$(id -u)" "$PLIST" && echo "ARIA LaunchAgent installed"
