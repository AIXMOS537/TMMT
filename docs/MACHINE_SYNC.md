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

**Enable both pull + dev:**

```bash
~/dev/TMMT/scripts/enable-office-services.sh
```

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
