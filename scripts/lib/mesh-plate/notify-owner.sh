#!/usr/bin/env bash
# notify-owner.sh — owner alerts ONLY for urgent/emergency (never routine swarm noise).
#
# Usage:
#   bash scripts/mesh/notify-owner.sh log "task finished"
#   bash scripts/mesh/notify-owner.sh urgent "🆘 operator needs help"
#   bash scripts/mesh/notify-owner.sh emergency "HARD STOP — adversarial brief"
#
# Routine work → watchtower inbox log only. Taha reads via: watchtower
set -uo pipefail

LEVEL="${1:-log}"; shift || true
MSG="${*:-(no message)}"
ROOT="${TMMT_ROOT:-}"
if [[ -z "$ROOT" ]]; then
  for d in "$HOME/projects/TMMT" "$HOME/Projects/TMMT" "$HOME/TMMT"; do
    [[ -f "$d/scripts/tmmt" ]] && { ROOT="$d"; break; }
  done
fi
ROOT="${ROOT:-$(pwd)}"

INBOX="$HOME/Brain/vault/03-Systems/watchtower-inbox"
mkdir -p "$INBOX"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
HOST="$(hostname -s 2>/dev/null || echo device)"
LOG_LINE="[$STAMP] [$LEVEL] [$HOST] $MSG"
printf '%s\n' "$LOG_LINE" >> "$INBOX/events.log"

case "$LEVEL" in
  log|info) exit 0 ;;
  urgent|emergency) ;;
  *) LEVEL="log"; exit 0 ;;
esac

NOTIFY_ENV="$ROOT/scripts/phase9-notify/.env.notify"
[[ -f "$NOTIFY_ENV" ]] || NOTIFY_ENV="$HOME/.config/tmmt/notify.env"
[[ -f "$NOTIFY_ENV" ]] && { set -a; source "$NOTIFY_ENV"; set +a; }

json_str() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk 'BEGIN{printf "\""} {printf "%s", $0} END{printf "\""}'; }

PREFIX="🚨"; [[ "$LEVEL" == "urgent" ]] && PREFIX="🆘"
FULL="${PREFIX} TMMT ${LEVEL^^} · ${HOST}: ${MSG}"

sent=0
if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
  curl -fsS -X POST -H 'Content-type: application/json' \
    --data "$(printf '{"text":%s}' "$(json_str "$FULL")")" "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 && sent=1
fi
if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_OWNER_CHAT_ID:-}" ]]; then
  curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_OWNER_CHAT_ID}" \
    --data-urlencode "text=${FULL}" >/dev/null 2>&1 && sent=1
fi
if [[ -n "${IMESSAGE_RELAY_URL:-}" && -n "${IMESSAGE_NOTIFY_TO:-}" ]]; then
  curl -fsS -X POST "${IMESSAGE_RELAY_URL%/send}/send" \
    -H 'Content-Type: application/json' \
    ${IMESSAGE_RELAY_TOKEN:+ -H "Authorization: Bearer $IMESSAGE_RELAY_TOKEN"} \
    --data "$(printf '{"to":%s,"text":%s}' "$(json_str "$IMESSAGE_NOTIFY_TO")" "$(json_str "$FULL")")" \
    >/dev/null 2>&1 && sent=1
fi

[[ $sent -eq 1 ]] && echo "✓ owner notified ($LEVEL)" || echo "⚠ logged to watchtower-inbox (no notify channels configured)"
