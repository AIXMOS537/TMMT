# TMMT: office Mac + home Windows sync

Two machines, one codebase. **GitHub is the source of truth for code.** Supabase/Vercel are the source of truth for data and deploys.

## Roles

| Machine | OS | Role |
|---------|-----|------|
| **Office** | macOS (M1 Pro Max, 32 GB) | Stays on; auto-`git pull`; backup dev server / webhooks via Tailscale |
| **Home** | Windows (AMD + discrete GPU) | Primary “big brain” — Cursor, heavy builds, `git push` |

## Canonical paths (use these in Cursor)

| OS | Path |
|----|------|
| macOS | `~/dev/TMMT` → symlink to your working tree |
| Windows | `C:\dev\TMMT` |

Do **not** edit duplicate folders on Desktop. One clone per machine.

**macOS canonical layout (after cleanup):** `~/dev/AIX_Command_Center` and `~/dev/TMMT` (symlink). Desktop should stay empty; archives live in `~/Documents/AIX-Archives/`.

## Default branch

Until `cursor/tmmt-management-initial-setup` is merged to `main`, both machines use:

```text
scripts/default-branch  →  cursor/tmmt-management-initial-setup
```

After merge, change that file to `main` on both machines and run `sync-machine`.

## Daily workflow

**Leaving any machine**

```bash
git status
git add -A && git commit -m "..."
git push
```

**Arriving at the other**

```bash
# macOS
~/dev/TMMT/scripts/sync-machine.sh

# Windows (PowerShell)
C:\dev\TMMT\scripts\windows\sync-machine.ps1
```

## Node version

Repo pins **Node 20** (`.node-version`). Install via [fnm](https://github.com/Schniz/fnm) or [mise](https://mise.jdx.dev).

- macOS: `brew install fnm` → `fnm install` in `tmmt-os`
- Windows: `winget install Schniz.fnm` or nvm-windows

## Secrets

Never commit `.env.local`. Copy the same `tmmt-os/.env.local` to both machines from your password manager.

## Cursor / AI rules

Project rules live in **`.cursor/rules/`** in this repo. They sync when you `git pull`.

Turn on **Cursor Settings Sync** (account) for editor preferences and extensions.

## Office auto-pull (macOS only)

LaunchAgent runs every 5 minutes when the Mac is logged in:

- Script: `scripts/office-git-pull.sh`
- Log: `~/Library/Logs/tmmt-git-pull.log`
- Install: `scripts/install-office-autopull.sh`

Skips pull if the working tree is dirty.

Enable in Terminal.app:

```bash
~/dev/TMMT/scripts/enable-office-autopull.sh
```

## Office dev server 24/7 (macOS + Tailscale)

Keeps `npm run dev` running on the office M1, bound to **all interfaces** (`0.0.0.0:3000`) so your home PC can open it over Tailscale.

| Item | Value |
|------|--------|
| Script | `scripts/office-dev-server.sh` |
| Install | `scripts/install-office-dev-server.sh` |
| Enable | `scripts/enable-office-dev-server.sh` |
| Log | `~/Library/Logs/tmmt-dev.log` |
| Requires | `tmmt-os/.env.local` |

**Enable pull + dev + flash USB sync:**

```bash
~/dev/TMMT/scripts/enable-office-services.sh
```

## AIXMOS02 flash USB (auto-sync Mac → drive)

When matching USB volumes are plugged in, a LaunchAgent runs `scripts/sync-all-flash-drives.sh` (every ~2 minutes while mounted). That script updates **AIXMOS02** (`tmmt-os` + `.env.local`), and when **LEXAR** / **CYBORG** are present, refreshes those drives too (see **Three-drive dock** below).

| Item | Value |
|------|--------|
| Orchestrator | `scripts/sync-all-flash-drives.sh` |
| AIXMOS02 only (manual) | `scripts/flash-usb-sync.sh` |
| Volume name | `scripts/flash-usb-volume-name` → `AIXMOS02` |
| Install / enable | `scripts/enable-flash-usb-sync.sh` |
| Log | `~/Library/Logs/tmmt-flash-usb-sync.log` |

**Manual sync (any time USB is mounted):**

```bash
~/dev/TMMT/scripts/sync-all-flash-drives.sh
# or AIXMOS02 only:
~/dev/TMMT/scripts/flash-usb-sync.sh
```

Syncs app source + `.env.local`, removes bad `intake/intake` and `webhooks/webhooks` duplicates on the USB, runs typecheck on the drive. Does **not** overwrite `node_modules` or `.next` on the USB (faster, offline-ready).

## Three-drive dock (work MacBook)

When **AIXMOS02**, **CYBORG**, and **LEXAR** are on the same hub (or alternate labels **AIX-CARRY**, **AIX-INVESTORS**, **AIX-HOME-PC**), the LaunchAgent runs `scripts/sync-all-flash-drives.sh` every ~2 minutes:

| Volume | Role |
|--------|------|
| AIXMOS02 (or AIX-CARRY) | Full `tmmt-os` + `.env.local` — same as `flash-usb-sync.sh` |
| LEXAR (or AIX-HOME-PC) | Command-center bundle from `~/dev/AIX_Command_Center` (no secrets) |
| CYBORG (or AIX-INVESTORS) | Merges into `HOME_AI_PC/01_AIX_Command_Center` and `APP_BUILD_FILES_*/01_AIX_Command_Center` if those folders exist |

**Rule:** only one Mac should be connected to the dock while drives are syncing. Sleep or disconnect the carry MacBook before plugging the hub into the work MacBook.

**Manual sync all mounted drives:**

```bash
~/dev/TMMT/scripts/sync-all-flash-drives.sh
```

Force immediate LEXAR/CYBORG pass (bypasses their 5-minute throttle): `TMMT_FORCE_DOCK_SYNC=1 ~/dev/TMMT/scripts/sync-all-flash-drives.sh`

**From home (Windows)** — after Tailscale is on both machines:

```text
http://<office-mac-tailscale-name>:3000
```

Example: `http://tmmts-macbook-pro:3000` (use the name from Tailscale admin → Machines).

**Stop dev server:**

```bash
launchctl bootout gui/$(id -u)/com.aixmos.tmmt-dev-server
```

Security: only expose port 3000 on your **Tailscale mesh**, not public port-forwarding. Next dev is not hardened for the open internet.

After `git pull` updates dependencies, restart dev:

```bash
launchctl kickstart -k gui/$(id -u)/com.aixmos.tmmt-dev-server
```

## Tailscale + SSH (home → office)

1. Install [Tailscale](https://tailscale.com) on both machines; same account.
2. Note office Mac hostname in Tailscale admin (e.g. `office-mbp`).
3. On **Windows home**, generate a key:
   ```powershell
   ssh-keygen -t ed25519 -C "home-windows"
   ```
4. Copy `~/.ssh/id_ed25519.pub` (Windows: `%USERPROFILE%\.ssh\id_ed25519.pub`) to office Mac:
   ```bash
   # on office Mac
   mkdir -p ~/.ssh && chmod 700 ~/.ssh
   echo "PASTE_PUBLIC_KEY" >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```
5. From home:
   ```powershell
   ssh projectaixmos01@office-mbp
   cd ~/dev/TMMT/tmmt-os && npm run dev
   ```

Optional: **Cursor Remote SSH** to the office Mac when you need the always-on box without running everything locally on Windows.

## What not to sync

- `node_modules/`, `.next/`, `.vercel/`
- `.env.local` (use 1Password)
- Whole project folders via Dropbox/iCloud

## Windows first-time setup

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
cd C:\dev
git clone https://github.com/AIXMOS537/TMMT.git TMMT
cd TMMT
.\scripts\windows\setup-home.ps1
```

Or run `scripts/windows/setup-home.ps1` after cloning.

## Dotfiles (optional)

Shared shell snippets: `~/dev/dotfiles` on Mac (see `install-macos.sh`). Windows can mirror aliases in your PowerShell profile.

## Duplicate Desktop folder

Archive `Desktop/BROTHER I/TMMT MANAGEMENT` — the canonical repo is under `AIX_Command_Center` / `~/dev/TMMT`.
