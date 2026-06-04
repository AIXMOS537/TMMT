#!/usr/bin/env bash
# LaunchAgent entry: load office-agent-channel/.env then run the bot.
set -euo pipefail
CHANNEL="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${CHANNEL}/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

export TMMT_REPO_ROOT="${TMMT_REPO_ROOT:-$(cd "${CHANNEL}/../.." && pwd)}"
exec /usr/bin/python3 "${CHANNEL}/telegram_owner_bot.py"
