# Office Mac: flash pull + remote commands (iMessage / WhatsApp reality)

## What runs automatically

When **AIXMOS02**, **LEXAR**, and/or **CYBORG** (or aliases **AIX-CARRY**, **AIX-HOME-PC**, **AIX-INVESTORS**) are mounted on the office Mac:

- **Mac → flash** — `com.aixmos.tmmt-flash-usb-sync` runs `sync-all-flash-drives.sh` (pushes your canonical `~/dev` tree to the drives).
- **Flash → Mac** — `com.aixmos.tmmt-flash-usb-pull` runs `pull-from-flash-drives.sh` (copies drive contents into **`~/Documents/TMMT-Flash-Inbox/current/`**).

Pull uses **rsync only**. It does **not** execute binaries or scripts from the USB.

**Telegram + iMessage agent setup** (bot, allow lists, optional iMessage watcher): [AGENT_IMESSAGE_TELEGRAM_SETUP.md](./AGENT_IMESSAGE_TELEGRAM_SETUP.md) · **Agent one-pager:** [AGENT_HANDOFF_ONE_PAGER.md](./AGENT_HANDOFF_ONE_PAGER.md)

Enable both:

```bash
~/dev/TMMT/scripts/enable-office-services.sh
```

## Inbox layout

```text
~/Documents/TMMT-Flash-Inbox/
  README.txt
  current/
    AIXMOS02/TMMT_MANAGEMENT/…   (and _secrets/tmmt-os.env.local if present on drive)
    LEXAR/…
    CYBORG/…
```

Compare with canonical app before merging:

```bash
diff -rq ~/dev/TMMT/tmmt-os ~/Documents/TMMT-Flash-Inbox/current/AIXMOS02/TMMT_MANAGEMENT/tmmt-os | head -50
```

## iMessage and WhatsApp

**They cannot start Terminal jobs or copy files by themselves.** Apple does not expose “on this SMS, run a shell script” for arbitrary automation in a safe, supported way.

Practical options:

1. **SSH over Tailscale** (best for “text myself a command” style if you use a terminal app on the phone):
   - Install Tailscale on the office Mac and your phone.
   - Enable **Remote Login** on the Mac (System Settings → General → Sharing → Remote Login).
   - From the phone (e.g. Termius), run:
     ```bash
     ssh youruser@office-mac-hostname
     TMMT_FORCE_FLASH_PULL=1 bash ~/dev/TMMT/scripts/pull-from-flash-drives.sh
     ```
   - Or kick the LaunchAgent (runs the pull script with default env):
     ```bash
     launchctl kickstart -k "gui/$(id -u)/com.aixmos.tmmt-flash-usb-pull"
     ```
     (`id -u` must run **on the Mac** — e.g. put the numeric UID in the command if typing from phone.)

2. **Screen Sharing / AnyDesk / Chrome Remote Desktop** — open the Mac UI and double-click **Pull From Flash Drives.command** on the Desktop.

3. **Siri Shortcuts on the Mac** (same room) — can open an app or a file; still not a direct WhatsApp trigger unless you add a third-party bridge (not covered here).

4. **If you later want true “chat command” automation**, you typically add a small **trusted** service (e.g. Slack bot, Discord bot, or a private webhook you call with `curl`) that runs only allow-listed actions — not raw chat parsing from WhatsApp.

## Logs

| Log | Purpose |
|-----|---------|
| `~/Library/Logs/tmmt-flash-usb-sync.log` | Mac → flash |
| `~/Library/Logs/tmmt-flash-usb-pull.log` | Flash → Mac inbox |

Health check:

```bash
~/dev/TMMT/scripts/verify-office-services.sh
```

## Full Disk Access

If logs show `Operation not permitted` for these jobs, grant **Full Disk Access** to **Terminal** (and/or **/bin/bash**) under System Settings → Privacy & Security, then re-run the install/enable scripts.
