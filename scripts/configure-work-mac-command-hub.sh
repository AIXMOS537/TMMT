#!/usr/bin/env bash
# Wire this Mac as the TMMT command hub: iMessage in/out + optional Telegram.
# Run on the work Mac (Messages signed in, Full Disk Access for python3).
#
#   bash ~/dev/TMMT/scripts/configure-work-mac-command-hub.sh
#
# Non-interactive (auto-detect iPhone handle from Messages DB):
#   TMMT_CMDHUB_AUTO=1 bash ~/dev/TMMT/scripts/configure-work-mac-command-hub.sh

set -euo pipefail

REPO="${TMMT_REPO:-$HOME/dev/TMMT}"
CHANNEL="${REPO}/scripts/office-agent-channel"
ENV_FILE="${CHANNEL}/.env"
ENV_EXAMPLE="${CHANNEL}/.env.example"

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }

[[ -d "$REPO" ]] || { echo "Repo missing at $REPO"; exit 1; }
mkdir -p "$(dirname "$ENV_FILE")"
[[ -f "$ENV_FILE" ]] || cp "$ENV_EXAMPLE" "$ENV_FILE"

detect_handles() {
  python3 <<'PY'
import sqlite3
from pathlib import Path

db = Path.home() / "Library/Messages/chat.db"
if not db.is_file():
    print("")
    raise SystemExit(0)

uri = f"file:{db}?mode=ro"
conn = sqlite3.connect(uri, uri=True)
cur = conn.cursor()
cur.execute(
    """
    SELECT h.id, COUNT(*) AS n
    FROM message m
    JOIN handle h ON m.handle_id = h.ROWID
    WHERE m.is_from_me = 0
      AND h.id LIKE '+%'
      AND LENGTH(h.id) >= 11
    GROUP BY h.id
    ORDER BY n DESC
    LIMIT 3
    """
)
rows = [r[0] for r in cur.fetchall()]
conn.close()
print(",".join(rows))
PY
}

set_env() {
  local key="$1" val="$2"
  python3 - "$ENV_FILE" "$key" "$val" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
key, val = sys.argv[2], sys.argv[3]
lines = path.read_text(encoding="utf-8").splitlines() if path.is_file() else []
out, found = [], False
for line in lines:
    if line.startswith(f"{key}="):
        out.append(f"{key}={val}")
        found = True
    else:
        out.append(line)
if not found:
    out.append(f"{key}={val}")
path.write_text("\n".join(out).rstrip() + "\n", encoding="utf-8")
PY
}

SUGGESTED="$(detect_handles 2>/dev/null || true)"
PRIMARY="${SUGGESTED%%,*}"

if [[ -n "${TMMT_CMDHUB_AUTO:-}" ]]; then
  HANDLES="${TMMT_IMESSAGE_HANDLES:-$SUGGESTED}"
elif [[ -t 0 ]]; then
  echo "Work Mac command hub setup"
  echo "Detected iPhone handles from Messages (newest inbound): ${SUGGESTED:-none}"
  read -r -p "IMESSAGE_ALLOWED_HANDLES (comma-separated, Enter=detected): " HANDLES
  HANDLES="${HANDLES:-$SUGGESTED}"
else
  HANDLES="$SUGGESTED"
fi

if [[ -z "$HANDLES" ]]; then
  log "No phone handles detected. Sign into Messages, send yourself a test text, re-run."
  exit 1
fi

PRIMARY="${PRIMARY:-${HANDLES%%,*}}"
log "Allowed command senders: $HANDLES"
log "Status texts (IMESSAGE_BUDDY): $PRIMARY"

set_env "IMESSAGE_WATCHER_ENABLED" "1"
set_env "IMESSAGE_ALLOWED_HANDLES" "$HANDLES"
set_env "IMESSAGE_BUDDY" "$PRIMARY"
set_env "IMESSAGE_CMD_PREFIX" "TMMT"
set_env "IMESSAGE_REPLY_ENABLED" "1"
set_env "TELEGRAM_REPLY_IMESSAGE" "1"

chmod +x "${CHANNEL}"/*.sh "${CHANNEL}"/*.py 2>/dev/null || true
bash "${REPO}/scripts/install-imessage-command-watcher.sh"
bash "${REPO}/scripts/enable-imessage-command-watcher.sh" || true

# Office spine services (flash sync, TMMT OS dev server, git pull)
bash "${REPO}/scripts/enable-office-autopull.sh" 2>/dev/null || log "WARN: office-autopull"
bash "${REPO}/scripts/enable-office-dev-server.sh" 2>/dev/null || log "WARN: office-dev-server"
bash "${REPO}/scripts/enable-flash-usb-sync.sh" 2>/dev/null || true
bash "${REPO}/scripts/enable-flash-usb-pull.sh" 2>/dev/null || true

if grep -q '^TELEGRAM_BOT_TOKEN=.\+' "$ENV_FILE" 2>/dev/null; then
  bash "${REPO}/scripts/enable-telegram-owner-bot.sh" 2>/dev/null || true
  log "Telegram bot: enabled (token present)"
else
  log "Telegram bot: skipped (paste token — bash scripts/configure-telegram-interactive.sh)"
fi

log "Smoke test (CLI)…"
python3 "${CHANNEL}/command_router.py" "TMMT help" || true

if [[ -n "${TMMT_CMDHUB_SKIP_IMESSAGE_TEST:-}" ]]; then
  log "Skipped iMessage send test."
else
  log "Sending test iMessage to ${PRIMARY}…"
  if IMESSAGE_BUDDY="$PRIMARY" bash "${CHANNEL}/imessage_send.sh" "TMMT: work Mac command hub online. Text: TMMT help"; then
    log "iMessage send OK"
  else
    log "iMessage send failed — grant Automation for Terminal/Cursor → Messages, and Full Disk Access for python3"
  fi
fi

log "Done. iPhone: text this Mac TMMT help | TMMT status | TMMT ops what's pending"
log "Log: ~/Library/Logs/tmmt-imessage-watcher.log"
