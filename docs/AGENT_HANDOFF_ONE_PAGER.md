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

## Telegram / iMessage commands (allow-listed)

Same router for Telegram (`/…`) and iMessage inbound (`TMMT …`):

| Command | Effect |
|---------|--------|
| `/help` or `TMMT help` | Lists commands |
| `/pull_flash` or `TMMT pull_flash` | USB → flash inbox |
| `/sync_flash` or `TMMT sync_flash` | `~/dev` → flash drives |
| `/status` or `TMMT status` | Office services health check |
| `/ops <text>` or `TMMT ops <text>` | TMMT OS natural-language ops (`:3000/api/ops/command`) |
| `/brain <text>` or `TMMT brain <text>` | Quick BRAIN synthesis (team message in reply) |
| `/say <text>` or `TMMT say <text>` | One iMessage line to `IMESSAGE_BUDDY` |

**Cursor / Mac terminal:** `curl` to `/api/ops/command` with `OPS_COMMAND_SECRET`, or `python3 scripts/office-agent-channel/command_router.py "TMMT ops …"`. Full stack: `EXECUTION/COMMAND_ROUTER.md`.

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

| **Enable bot (after `.env` exists):** | On the **office Mac** only — see setup doc above. |

## On flash drives (after sync)

After `~/dev/TMMT/scripts/sync-all-flash-drives.sh` (or auto-sync with dock plugged in):

| Location | Contents |
|----------|----------|
| **USB root** | `AGENT_START_HERE.txt` — points to handoff doc |
| **`TMMT MANAGEMENT/docs/`** | `AGENT_HANDOFF_ONE_PAGER.md`, `AGENT_IMESSAGE_TELEGRAM_SETUP.md`, flash + machine sync docs |
| **`TMMT MANAGEMENT/scripts/office-agent-channel/`** | `.env.example` + bot scripts (**no** `.env` / tokens on USB) |

Volumes: **AIXMOS02**, **LEXAR**, **CYBORG** (aliases: AIX-CARRY, AIX-HOME-PC, AIX-INVESTORS).

---

*Last updated: 2026-05-20*
