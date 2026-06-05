#!/usr/bin/env bash
# Open macOS Privacy → Full Disk Access (user must toggle Terminal + /bin/bash ON).
set -euo pipefail

echo "Opening System Settings → Privacy & Security → Full Disk Access"
echo ""
echo "Turn ON for:"
echo "  • Cursor (this IDE)"
echo "  • Terminal"
PY="/Library/Frameworks/Python.framework/Versions/3.14/bin/python3"
echo "  • ${PY}"
echo "    (iMessage watcher — click + → Cmd+Shift+G → paste path → Open)"
echo "  • /bin/bash  (flash USB sync — Cmd+Shift+G → type /bin/bash → Open)"
echo ""
echo "Also: Privacy → Automation → allow Cursor/Terminal to control Messages"
echo ""
echo "Then run:"
echo "  launchctl kickstart -k gui/\$(id -u)/com.aixmos.tmmt-imessage-command-watcher"
echo "  bash ~/dev/TMMT/scripts/usb-write-test.sh"

open "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_AllFiles" 2>/dev/null || \
  open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles" 2>/dev/null || \
  open "/System/Applications/System Settings.app"
