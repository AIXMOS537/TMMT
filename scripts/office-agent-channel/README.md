# Office agent channels — Telegram + iMessage

| File | Role |
|------|------|
| `.env.example` | Copy to `.env`; set tokens and allow lists |
| `telegram_owner_bot.py` | Long-poll Telegram; allow-listed `/commands` |
| `imessage_send.sh` | Send one line via Messages (AppleScript) |
| `imessage_command_watcher.py` | **Optional** — reads `~/Library/Messages/chat.db` (Full Disk Access) |

Install / enable from repo root (`TMMT MANAGEMENT/`):

```bash
cp scripts/office-agent-channel/.env.example scripts/office-agent-channel/.env
# edit .env — BotFather token, Telegram chat IDs, optional IMESSAGE_BUDDY

bash scripts/install-telegram-owner-bot.sh
bash scripts/enable-telegram-owner-bot.sh
```

Full guide: [AGENT_IMESSAGE_TELEGRAM_SETUP.md](../../docs/AGENT_IMESSAGE_TELEGRAM_SETUP.md) · **Share with agent:** [AGENT_HANDOFF_ONE_PAGER.md](../../docs/AGENT_HANDOFF_ONE_PAGER.md)
