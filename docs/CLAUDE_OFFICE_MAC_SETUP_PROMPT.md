# Claude prompt — TMMT office Mac setup

Copy everything inside the **fenced block below** into Claude (Claude Code on the office Mac, or Claude with computer use / SSH to the Mac). Replace the `OWNER FILLS IN` placeholders before sending, or tell Claude to ask you for them interactively.

---

## Prompt (copy from here)

```text
You are setting up the TMMT office MacBook at ~/dev/TMMT (symlink to AIX_Command_Center/TMMT MANAGEMENT).

GOAL
- Three flash drives on the dock (AIXMOS02, CYBORG, LEXAR) copy TO the Mac inbox and stay in sync with ~/dev when mounted.
- Telegram bot lets an allow-listed agent run: /help, /pull_flash, /sync_flash, /status, /say
- Optional iMessage status to the owner's work number (outbound only unless watcher enabled).
- Do NOT commit .env files or paste secrets into chat logs after setup.

RULES
- Only one Mac should use the USB dock at a time (carry Mac must be asleep/unplugged).
- Never commit scripts/office-agent-channel/.env
- If scripts fail with "Operation not permitted", tell the owner to grant Full Disk Access to /bin/bash and /usr/bin/python3 in System Settings → Privacy & Security.

STEP A — Ask the owner for (if not already provided):
1. TELEGRAM_BOT_TOKEN (from @BotFather /newbot)
2. TELEGRAM_ALLOWED_CHAT_IDS (comma-separated; owner + agent from @userinfobot)
3. IMESSAGE_BUDDY (optional: work +1… or Apple ID email for status texts)
4. TELEGRAM_REPLY_IMESSAGE=1 if they want iMessage ping after each Telegram command
5. Confirm carry Mac is disconnected from the dock

STEP B — Run the one-shot setup script on the office Mac:

cd ~/dev/TMMT
git pull origin cursor/tmmt-management-initial-setup || true

TELEGRAM_BOT_TOKEN='OWNER_FILLS_IN' \
TELEGRAM_ALLOWED_CHAT_IDS='OWNER_FILLS_IN' \
IMESSAGE_BUDDY='OWNER_FILLS_IN' \
TELEGRAM_REPLY_IMESSAGE='1' \
bash scripts/claude-office-mac-setup.sh

(If tokens are not ready yet, run without env vars — script creates .env and prints what to fill.)

STEP C — Verify:
- ls /Volumes/  → should show AIXMOS02, CYBORG, LEXAR when dock is plugged in
- du -sh ~/Documents/TMMT-Flash-Inbox/current/*
- bash ~/dev/TMMT/scripts/verify-office-services.sh
- curl -sf http://127.0.0.1:3000 && echo "dev server OK"
- tail -20 ~/Library/Logs/tmmt-telegram-owner-bot.log

STEP D — Owner tests Telegram: /help, /status, /pull_flash

STEP E — Hand off to human agent (do NOT send bot token):
- Bot link t.me/…
- Confirm their chat ID is in TELEGRAM_ALLOWED_CHAT_IDS
- Share file: ~/dev/TMMT/docs/AGENT_HANDOFF_ONE_PAGER.md

OPTIONAL — iMessage inbound commands (skip unless owner explicitly wants):
- Set IMESSAGE_WATCHER_ENABLED=1 and IMESSAGE_ALLOWED_HANDLES in scripts/office-agent-channel/.env
- bash scripts/enable-imessage-command-watcher.sh
- Commands must start with "TMMT " e.g. TMMT pull_flash

REFERENCE DOCS (read if stuck):
- docs/AGENT_IMESSAGE_TELEGRAM_SETUP.md
- docs/AGENT_HANDOFF_ONE_PAGER.md
- docs/OFFICE_FLASH_PULL_AND_REMOTE.md
- docs/MACHINE_SYNC.md

If pull/sync fails with rsync "vanished" or SIGINT, wait for dock to settle and re-run:
  TMMT_FORCE_FLASH_PULL=1 bash ~/dev/TMMT/scripts/pull-from-flash-drives.sh
  TMMT_FORCE_DOCK_SYNC=1 bash ~/dev/TMMT/scripts/sync-all-flash-drives.sh

Report back: mounted volumes, inbox sizes, LaunchAgent status, Telegram /help result, and any errors from logs.
```

---

## Minimal version (if Claude already has repo access)

```text
On the office Mac, run ~/dev/TMMT/scripts/claude-office-mac-setup.sh with TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_CHAT_IDS, and optional IMESSAGE_BUDDY set in the environment. Then verify with verify-office-services.sh and test Telegram /help. Share AGENT_HANDOFF_ONE_PAGER.md with the agent — never the token.
```

---

## Script location

`~/dev/TMMT/scripts/claude-office-mac-setup.sh`

Make executable once:

```bash
chmod +x ~/dev/TMMT/scripts/claude-office-mac-setup.sh
```
