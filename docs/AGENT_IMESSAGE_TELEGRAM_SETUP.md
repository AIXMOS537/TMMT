# Agent channels: Telegram (recommended) + iMessage (how it really works on macOS)

**One-page handoff (share with agent):** [AGENT_HANDOFF_ONE_PAGER.md](./AGENT_HANDOFF_ONE_PAGER.md)

Your goal: an **authorized human agent** can text your **work phone / email**, and your **office Mac** (signed into your Apple ID) should **run allow-listed office tasks** (flash pull, flash push, health check) and optionally **reply on iMessage** so it feels like you or your assistant.

---

## 1) Telegram — use this first (reliable, official API)

Telegram gives a real **Bot API**. Your agent uses Telegram (or you forward instructions there); only **allow-listed numeric chat IDs** can run commands.

### Setup

1. In Telegram, open **@BotFather** → `/newbot` → copy the **token**.
2. Message **@userinfobot** from the account that should control the bot → copy your **numeric user id** (and your agent’s id if they should also run commands).
3. On the office Mac:

   ```bash
   cd ~/dev/TMMT
   cp scripts/office-agent-channel/.env.example scripts/office-agent-channel/.env
   # Edit .env: TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_CHAT_IDS (comma-separated)
   bash scripts/install-telegram-owner-bot.sh
   bash scripts/enable-telegram-owner-bot.sh
   ```

4. **System Settings → Privacy & Security → Full Disk Access** — enable for **/usr/bin/python3** (or the Terminal you use to test), if macOS blocks the bot or scripts from reading logs / Documents.

### Commands (allow-listed)

| Command | What it does |
|---------|----------------|
| `/help` | Lists commands |
| `/pull_flash` | USB → `~/Documents/TMMT-Flash-Inbox/current/` |
| `/sync_flash` | `~/dev` → mounted flash drives |
| `/status` | Runs `verify-office-services.sh` |
| `/say <text>` | Sends an **iMessage** to `IMESSAGE_BUDDY` (see below) |

**Log:** `~/Library/Logs/tmmt-telegram-owner-bot.log`

### Optional: Telegram actions also text your iPhone on iMessage

In `.env`:

```text
IMESSAGE_BUDDY=+15551234567
TELEGRAM_REPLY_IMESSAGE=1
```

`IMESSAGE_BUDDY` must match how that person appears for **iMessage** in the Mac Messages app (phone in E.164 or Apple ID email). The Mac sends **short confirmations** (e.g. “TMMT: pull_flash completed.”) so your work line sees activity. This is **outbound only** from the Mac; it does not read iMessage automatically.

---

## 2) iMessage — there is **no** official “iMessage Bot API” for third parties

Apple does **not** publish a supported way for arbitrary apps to **receive** iMessage/SMS and run shell commands the way Telegram does.

What **is** possible on a Mac you control:

### A) **Outbound “assistant voice”** (supported pattern)

- Use **`imessage_send.sh`** or Telegram’s `/say` to send messages **as this Mac’s Messages identity** (your Apple ID / phone when iMessage is enabled).
- Good for: “the Mac texted me that the pull finished.”

### B) **Inbound commands via iMessage** (advanced / fragile)

We ship an **optional** watcher, **`imessage_command_watcher.py`**, that **read-only** polls the local SQLite store `~/Library/Messages/chat.db` for new lines from **allow-listed handles** that start with a prefix (default `TMMT `), e.g. `TMMT pull_flash`.

**Caveats (read before enabling):**

- Requires **Full Disk Access** for **`/usr/bin/python3`** (or whichever interpreter runs the plist job).
- Apple can **change the database schema** without notice; this may break on OS upgrades.
- **Privacy:** the process can see message metadata; only enable on a **dedicated office Mac** you own, with an **explicit written policy** for your agent (work device, authorized senders only).
- **Compliance / trust:** Your agent should use an **agreed prefix** and **short allow-listed verbs** only — not free-form “run anything.”

Enable in `.env`:

```text
IMESSAGE_WATCHER_ENABLED=1
IMESSAGE_ALLOWED_HANDLES=+15551234567,agent@company.com
IMESSAGE_CMD_PREFIX=TMMT
```

Then:

```bash
bash scripts/install-imessage-command-watcher.sh
bash scripts/enable-imessage-command-watcher.sh
```

**Log:** `~/Library/Logs/tmmt-imessage-watcher.log`

If you need **production-grade** “chat to automation,” prefer **Telegram + n8n** (see `EXECUTION/COMMAND_ROUTER.md`) and use iMessage only for **human confirmations**.

---

## 3) Operational model for “act as me or my assistant”

| Channel | Best use |
|---------|----------|
| **Telegram** | Agent sends **commands**; tight allow list; audit log on Mac |
| **iMessage outbound** | Short **status / FYI** to your work number from the office Mac |
| **iMessage inbound (watcher)** | Optional; same prefix discipline; monitor logs |

**WhatsApp** still has no first-party Mac automation API for this pattern; route WhatsApp → Telegram or email if the vendor must stay on WhatsApp.

---

## 4) Giving your agent credentials

- **Telegram:** share the **bot link** and tell them their chat ID must be in `TELEGRAM_ALLOWED_CHAT_IDS` (you add it).
- **Work phone / email:** for **iMessage**, add the agent’s handle to **IMESSAGE_ALLOWED_HANDLES** only if you enable the watcher; otherwise they use **Telegram** and you use iMessage only for **your** confirmations via `/say` or `TELEGRAM_REPLY_IMESSAGE`.
- **Never** commit `.env` — it holds the bot token.

---

## 5) Quick test

```bash
# iMessage smoke test (opens Messages; sends one line)
IMESSAGE_BUDDY="+1yourwork" bash ~/dev/TMMT/scripts/office-agent-channel/imessage_send.sh "TMMT office Mac online"
```

Telegram: after the bot is running, send `/help` from an allow-listed account.
