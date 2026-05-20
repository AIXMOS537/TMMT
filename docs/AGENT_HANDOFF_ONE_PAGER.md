# Agent handoff — TMMT office Mac (one page)

**Owner:** keep secrets on the office Mac only. **Agent:** use Telegram; never receive bot tokens or `.env` files.

---

## What you give the agent

| Give them | Purpose |
|-----------|---------|
| **Telegram bot link** (e.g. `t.me/YourBotName`) | Primary channel for **commands** |
| **Their numeric Telegram user ID** in `TELEGRAM_ALLOWED_CHAT_IDS` | Only allow-listed chats can run commands (owner edits `scripts/office-agent-channel/.env`) |
| **Instructions** | After the bot is running, they send `/help` for the command list |

---

## What stays on the office Mac (do not share)

| Item | Location |
|------|----------|
| Bot token | `scripts/office-agent-channel/.env` → `TELEGRAM_BOT_TOKEN` |
| Allow list | same → `TELEGRAM_ALLOWED_CHAT_IDS` |
| iMessage “buddy” for outbound status | same → `IMESSAGE_BUDDY` (work `+1…` or Apple ID email as shown in Messages) |
| Optional: auto-iMessage after each Telegram command | same → `TELEGRAM_REPLY_IMESSAGE=1` |
| Optional inbound iMessage (advanced) | same → `IMESSAGE_WATCHER_ENABLED=1`, `IMESSAGE_ALLOWED_HANDLES`, `IMESSAGE_CMD_PREFIX` (default `TMMT `) |

**Never commit** `scripts/office-agent-channel/.env` (gitignored like other secrets).

---

## Telegram commands (allow-listed)

| Command | Effect |
|---------|--------|
| `/help` | Lists commands |
| `/pull_flash` | USB drives → `~/Documents/TMMT-Flash-Inbox/current/` |
| `/sync_flash` | `~/dev` → mounted flash drives |
| `/status` | Office services health check |
| `/say <text>` | Sends one iMessage line to `IMESSAGE_BUDDY` (if set) |

**Bot log:** `~/Library/Logs/tmmt-telegram-owner-bot.log`

---

## Channel roles (bottom line)

| Channel | Role |
|---------|------|
| **Telegram** | Real **command** channel (official Bot API + allow list). |
| **iMessage** | **Human-style updates** from the Mac (outbound to your work number / Apple ID). |
| **iMessage inbound (optional)** | Prefixed commands only (`TMMT …`); uses local Messages DB + Full Disk Access — fragile; use only with a clear policy. |

---

## Setup & full detail

| Doc | Contents |
|-----|----------|
| [AGENT_IMESSAGE_TELEGRAM_SETUP.md](./AGENT_IMESSAGE_TELEGRAM_SETUP.md) | Telegram + iMessage setup, caveats, Full Disk Access |
| [OFFICE_FLASH_PULL_AND_REMOTE.md](./OFFICE_FLASH_PULL_AND_REMOTE.md) | Flash pull inbox + SSH / remote patterns |
| [MACHINE_SYNC.md](./MACHINE_SYNC.md) | Two-machine + dock + services |
| [INTEGRATION_REGISTRY.md](../INTEGRATIONS/INTEGRATION_REGISTRY.md) | Registry row for Office Mac / Telegram / iMessage |

**Enable bot (after `.env` exists):**

```bash
cd ~/dev/TMMT
cp scripts/office-agent-channel/.env.example scripts/office-agent-channel/.env
# edit .env — then:
bash scripts/install-telegram-owner-bot.sh
bash scripts/enable-telegram-owner-bot.sh
```

---

*Last updated: 2026-05-20*
