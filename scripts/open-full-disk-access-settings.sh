#!/usr/bin/env bash
# Open macOS Privacy → Full Disk Access (user must toggle Terminal + /bin/bash ON).
set -euo pipefail

echo "Opening System Settings → Privacy & Security → Full Disk Access"
echo ""
echo "Turn ON for:"
echo "  • Terminal (or Cursor)"
echo "  • /bin/bash  (click + → press Cmd+Shift+G → type /bin/bash → Open)"
echo ""
echo "Then run:"
echo "  bash ~/dev/TMMT/scripts/usb-write-test.sh"
echo "  bash ~/dev/TMMT/scripts/enable-powerhouse-mac.sh"

open "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_AllFiles" 2>/dev/null || \
  open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles" 2>/dev/null || \
  open "/System/Applications/System Settings.app"
