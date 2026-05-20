# Carrying MacBook — full local mirror + remote machines

This Mac is **AIX-CARRY** (walk-around). Flash drives map:

| USB volume | Label | Role |
|------------|--------|------|
| AIXMOS02 | AIX-CARRY | Daily carry (this Mac) |
| LEXAR | AIX-HOME-PC | Office / always-on PC |
| CYBORG | AIX-INVESTORS | Investor handoff (no secrets) |

## What was merged onto this laptop (2026-05-20)

| Path | Contents |
|------|----------|
| `~/Documents/TMMT` | **Canonical app** — git `master`, production funnel code |
| `~/TMMT` | Mirror of `Documents/TMMT` (same tree, no `.git` overwrite) |
| `~/dev/TMMT` | Symlink → `~/Documents/TMMT` (Cursor / scripts) |
| `~/Documents/TMMT/business-ops/` | Fleet, finance, rentals, SOPs from all USBs |
| `~/Documents/TMMT/imports/from-drives-2026-05-20/` | Drive-only venture/multi-tenant source (not live `src/`) |
| `~/Documents/TMMT/secrets/from-drives/` | Env backups from LEXAR + AIXMOS02 (do not commit) |
| `~/Documents/TMMT/docs/` | Operator team, mentorship, MACHINE_SYNC |
| `~/AIX-Ecosystem/` | Full USB bundles (AI-OPS, AIX Command, Brain Mesh, build files, etc.) |
| `~/AIX-Command-Center/` | Synced from `AIXMOSXTMMT-OPS` on drives |
| `~/AI-OPS-STARTER/` | Synced from carry + LEXAR drives |

**App code rule:** Live `src/` stays the **GitHub/Vercel** copy (`8a8a3f3+). USB-only features live under `imports/` until you cherry-pick them.

## Connect to office Mac or home PC

### 1. Tailscale (recommended)

Install on **all three** machines (carrying Mac, office Mac, home Windows):

```bash
# macOS carrying Mac
brew install --cask tailscale
# Open Tailscale from Applications, sign in with same account as office/home
```

After install, open [Tailscale Admin → Machines](https://login.tailscale.com/admin/machines) and note each hostname, e.g.:

- Office Mac: `office-mbp` or `tmmts-macbook-pro`
- Home PC: `home-windows`

**TMMT dev server on office Mac** (if enabled):

```text
http://<office-mac-tailscale-name>:3000
```

Enable on office Mac only:

```bash
~/dev/TMMT/scripts/enable-office-services.sh
```

### 2. SSH (office Mac from here)

```bash
# One-time: generate key on carrying Mac if needed
ssh-keygen -t ed25519 -C "carrying-macbook"

# Add pubkey to office Mac ~/.ssh/authorized_keys (paste from carrying Mac)
cat ~/.ssh/id_ed25519.pub

# Connect (replace host with your Tailscale machine name)
ssh projectaixmos01@<office-mac-tailscale-name>
cd ~/dev/TMMT && git pull && npm run dev
```

**Cursor Remote SSH:** Command Palette → “Remote-SSH: Connect to Host…” → same `user@tailscale-host`.

### 3. Home Windows PC

From Tailscale admin, use the Windows machine name. Typical flow:

```powershell
# On home PC after git pull
cd C:\dev\TMMT
.\scripts\windows\sync-machine.ps1
npm run dev
```

From carrying Mac browser (Tailscale):

```text
http://<home-pc-tailscale-name>:3000
```

(Only if dev server is running on Windows.)

### 4. Git is always the code sync layer

```bash
cd ~/dev/TMMT
git status
git add -A && git commit -m "..." && git push   # leaving any machine
git pull                                         # arriving
~/dev/TMMT/scripts/sync-machine.sh               # macOS helper
```

Supabase + Vercel stay cloud truth for data and deploys.

## Secrets on this Mac

- `~/Documents/TMMT/.env` and `.env.local` — merged with missing keys from LEXAR `tmmt-os/.env.local`
- Full backups: `~/Documents/TMMT/secrets/from-drives/`
- **Never commit** `.env`, `.env.local`, or `secrets/`

Run:

```bash
cd ~/dev/TMMT && node scripts/check-env.mjs
```

## Daily carry workflow

1. Work in `~/dev/TMMT` or `~/Documents/TMMT`
2. `git push` before switching machines
3. Plug **AIXMOS02** only when you need to refresh USB mirror (optional)
4. Use Tailscale + SSH when you need the always-on office box or home GPU machine

## USB refresh (optional)

To update AIX-CARRY from this Mac later:

```bash
rsync -a --exclude=node_modules --exclude=.git --exclude=.next \
  ~/Documents/TMMT/ "/Volumes/AIXMOS02/TMMT MANAGEMENT/"
```

Do not copy `secrets/` or `.env.local` to CYBORG (investor drive).
