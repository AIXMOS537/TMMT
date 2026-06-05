#!/usr/bin/env bash
# Start iMessage watcher under Terminal.app (inherits Terminal Full Disk Access).
set -euo pipefail
REPO="${TMMT_REPO_ROOT:-$HOME/dev/TMMT}"
PY="/Library/Frameworks/Python.framework/Versions/3.14/bin/python3"
[[ -x "$PY" ]] || PY="$(command -v python3)"
LOG="${HOME}/Library/Logs/tmmt-imessage-watcher.log"
WATCH="${REPO}/scripts/office-agent-channel/imessage_command_watcher.py"

pkill -f imessage_command_watcher.py 2>/dev/null || true
launchctl bootout "gui/$(id -u)/com.aixmos.tmmt-imessage-command-watcher" 2>/dev/null || true

RUNNER="${HOME}/Library/Application Support/TMMT/run-imessage-watcher-inner.sh"
mkdir -p "$(dirname "$RUNNER")"
cat >"$RUNNER" <<EOF
#!/bin/bash
export TMMT_REPO_ROOT='${REPO}'
nohup '${PY}' '${WATCH}' >>'${LOG}' 2>&1 &
disown
exit
EOF
chmod +x "$RUNNER"

/usr/bin/osascript -e "tell application \"Terminal\" to do script \"${RUNNER}\""

sleep 3
if pgrep -f imessage_command_watcher.py >/dev/null; then
  echo "iMessage watcher running under Terminal (pid $(pgrep -f imessage_command_watcher.py | head -1))"
  exit 0
fi
echo "Watcher start may have failed — check ${LOG}" >&2
exit 1
