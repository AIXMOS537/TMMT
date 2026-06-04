#!/usr/bin/env bash
# One-time: paste BotFather token + chat IDs, then enable the bot.
set -euo pipefail

CHANNEL="$(cd "$(dirname "$0")/office-agent-channel" && pwd)"
ENV_FILE="${CHANNEL}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "${CHANNEL}/.env.example" "$ENV_FILE"
fi

echo "TMMT Telegram setup (office Mac)"
echo "1) Telegram → @BotFather → /newbot → copy token"
echo "2) Message @userinfobot → copy your numeric id"
echo ""
read -r -p "Paste TELEGRAM_BOT_TOKEN: " TOKEN
read -r -p "Paste TELEGRAM_ALLOWED_CHAT_IDS (comma-separated): " CHATS
read -r -p "IMESSAGE_BUDDY for status texts (+1… or email, or Enter to skip): " BUDDY

python3 <<PY
from pathlib import Path
p = Path("$ENV_FILE")
lines = p.read_text().splitlines()
out = []
keys = {"TELEGRAM_BOT_TOKEN": "$TOKEN", "TELEGRAM_ALLOWED_CHAT_IDS": "$CHATS"}
if "$BUDDY":
    keys["IMESSAGE_BUDDY"] = "$BUDDY"
for line in lines:
    k = line.split("=", 1)[0] if "=" in line and not line.strip().startswith("#") else None
    if k in keys and keys[k]:
        out.append(f"{k}={keys[k]}")
    else:
        out.append(line)
p.write_text("\n".join(out) + "\n")
PY

if [[ -z "$TOKEN" || -z "$CHATS" ]]; then
  echo "Token and chat IDs are required."
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "${REPO_ROOT}/scripts/enable-telegram-owner-bot.sh"
echo "Done. Test in Telegram: /help"
