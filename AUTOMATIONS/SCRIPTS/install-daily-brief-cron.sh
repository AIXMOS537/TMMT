#!/usr/bin/env bash
# Install macOS launchd job: daily TMMT brief at 7:00 AM local time.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST_SRC="$ROOT/AUTOMATIONS/launchd/com.tmmt.daily-brief.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.tmmt.daily-brief.plist"
LOG_DIR="$ROOT/AUTOMATIONS/LOGS"

mkdir -p "$LOG_DIR"
sed "s|__TMMT_ROOT__|${ROOT}|g" "$PLIST_SRC" > "$PLIST_DST"
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"
launchctl list | grep com.tmmt.daily-brief || true

echo "Installed: $PLIST_DST"
echo "Logs: $LOG_DIR/daily-brief-launchd.log"
echo "Test now: python3 \"$ROOT/AUTOMATIONS/SCRIPTS/daily_command_center.py\""
