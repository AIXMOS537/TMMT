#!/usr/bin/env bash
# LaunchAgent entrypoint — use the same python3 as interactive Terminal (needs FDA on this binary).
set -euo pipefail
REPO_ROOT="${TMMT_REPO_ROOT:-$HOME/dev/TMMT}"
PY="${TMMT_PYTHON:-/Library/Frameworks/Python.framework/Versions/3.14/bin/python3}"
if [[ ! -x "$PY" ]]; then
  PY="$(command -v python3)"
fi
exec "$PY" "${REPO_ROOT}/scripts/office-agent-channel/imessage_command_watcher.py"
