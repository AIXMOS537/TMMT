#!/bin/bash
# ============================================================
#  AIXMOS - INSTALL THE AGENT (macOS)
#  Double-click to run. Installs the reporting agent as a
#  LaunchAgent (auto-starts at login) + RustDesk for screens.
# ============================================================
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/AIXMOS-Agent"
mkdir -p "$DEST"
cp "$HERE/aixmos-agent-mac.sh" "$DEST/aixmos-agent-mac.sh"
chmod +x "$DEST/aixmos-agent-mac.sh"

PLIST="$HOME/Library/LaunchAgents/com.aixmos.agent.plist"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.aixmos.agent</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$DEST/aixmos-agent-mac.sh</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "Agent installed and running."

# RustDesk for live screens (needs Homebrew; skip silently if absent)
if command -v brew >/dev/null 2>&1; then
  brew install --cask rustdesk || true
else
  echo "NOTE: install RustDesk from https://rustdesk.com for live screen view."
fi

echo ""
echo "============================================================"
echo " DONE. This Mac now reports to the hub."
echo " First run: macOS will ask to allow 'osascript'/Accessibility"
echo " so it can read the active app -- click Allow."
echo " For live screens: open RustDesk, set a permanent password."
echo "============================================================"
read -n 1 -s -r -p "Press any key to close."
