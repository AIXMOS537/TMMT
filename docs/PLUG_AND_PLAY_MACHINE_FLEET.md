# TMMT Plug-and-Play — Machine Fleet & AI Brain

**Owner:** Muhammad Taha / AIXMOS  
**Updated:** May 2026  
**Repos:** [github.com/AIXMOS537/TMMT](https://github.com/AIXMOS537/TMMT) · [github.com/AIXMOS537/AIX-Command-Center](https://github.com/AIXMOS537/AIX-Command-Center)

---

## 1. Your machines (one page)

| Machine | Role | What runs |
|---------|------|-----------|
| **MacBook(s)** — office + portable | **Dev** | Cursor, code, `git push`, Vercel deploy |
| **Home PC (Windows, powerful)** | **24/7 AI Brain hub** | Ollama, Open WebUI, n8n, daily automations, AIX command system |
| **i5 workstation** | Worker | Git sync only |
| **2× AMD workstations** | Worker (+ optional remote GPU via Tailscale) | Git sync; heavy AI calls `home-pc` |
| **Surface Pro 4 (i7 / 16GB)** | Light worker | Git sync only — no models, no Docker brain |
| **Production app** | Vercel | https://tmmt-ops.vercel.app — not duplicated on every PC |

**Golden rule:** One brain (`home-pc`). MacBooks ship code. Workers pull code; they do not all run `npm run dev`.

---

## 2. Canonical paths

| OS | Command Center | TMMT app |
|----|----------------|----------|
| **macOS** | `~/dev/AIX-Command-Center` | `~/dev/TMMT` (app in `tmmt-os/`) |
| **Windows** | `C:\Users\<you>\dev\AIX-Command-Center` | `C:\Users\<you>\dev\TMMT` |

**Retire:** `Desktop/AIX_Command_Center/TMMT MANAGEMENT` and `Desktop/TMMT MANAGEMENT` after `~/dev` or `C:\dev` works.

**Git branch:** `main` (merge off `cursor/tmmt-management-initial-setup` when ready).

---

## 3. Tailscale (do this first on every machine)

1. Install: https://tailscale.com/download  
2. Same account on all machines.  
3. Suggested names:

| Machine | Hostname |
|---------|----------|
| Office MacBook | `mac-office` |
| Home MacBook | `mac-home` |
| Home PC 24/7 | `home-pc` |
| Surface | `surface-worker` |

4. On home PC hub, set n8n webhooks: `N8N_WEBHOOK_URL=http://home-pc:5678/`  
5. MacBooks can use remote Ollama: `OLLAMA_HOST=http://home-pc:11434`

---

## 4. MacBook — dev setup (plug and play)

```bash
# One-time
mkdir -p ~/dev
git clone -b main https://github.com/AIXMOS537/AIX-Command-Center.git ~/dev/AIX-Command-Center
git clone -b main https://github.com/AIXMOS537/TMMT.git ~/dev/TMMT

# Node 20
brew install fnm && fnm install 20 && fnm use 20

# App deps
cd ~/dev/TMMT/tmmt-os && npm ci

# Secrets (copy manually — never commit)
cp "/path/to/old/tmmt-os/.env.local" ~/dev/TMMT/tmmt-os/.env.local

# Open in Cursor
cursor ~/dev/TMMT/tmmt-os
```

**Optional auto-pull when Mac is on:**

```bash
cd ~/dev/TMMT
TMMT_ROOT=~/dev/TMMT GIT_BRANCH=main ./ops/dev-machine/install-launchd.sh
```

**Deploy production:**

```bash
cd ~/dev/TMMT/tmmt-os && npx vercel --prod
```

---

## 5. Home PC (Windows) — full AI Brain 24/7

### Prerequisites

- Windows 10/11  
- **Docker Desktop**  
- **Python 3.11+**  
- **Git**  
- **Tailscale**  
- PowerShell **Run as Administrator** for first install  

### One-command install

```powershell
cd C:\dev\TMMT\ops\dev-machine
# If not cloned yet:
git clone -b main https://github.com/AIXMOS537/TMMT.git C:\dev\TMMT
git clone -b main https://github.com/AIXMOS537/AIX-Command-Center.git C:\dev\AIX-Command-Center

.\install-hub-brain-windows.ps1
```

**Faster first run (skip large model download):**

```powershell
.\install-hub-brain-windows.ps1 -SkipModels
```

**Without Docker yet:**

```powershell
.\install-hub-brain-windows.ps1 -SkipDocker
```

### What gets installed

| Service | URL | Purpose |
|---------|-----|---------|
| Ollama (GPU) | http://localhost:11434 | Local LLM |
| Open WebUI | http://localhost:3080 | Chat / workbench |
| n8n | http://localhost:5678 | Automations + GHL webhooks |
| CHUMMO portal | http://localhost:3000 | Agent portal (at logon) |
| Python automations | Scheduled 7:00 & 9:00 | Daily ops, follow-ups, maintenance |

### Secrets to copy from MacBook

| File | Contents |
|------|----------|
| `TMMT\AUTOMATIONS\.env` | `SUPABASE_URL`, keys, `TMMT_OPS_URL`, `GHL_WEBHOOK_SECRET` |
| `AIX-Command-Center\AIX_AI_COMMAND_SYSTEM\.env` | Airtable, OpenAI, Supabase |
| Windows user environment | `ANTHROPIC_API_KEY` for CHUMMO |

### Manual test

```powershell
cd C:\dev\TMMT
.\ops\dev-machine\hub-brain\run-brain-cycle.ps1
ollama list
docker ps
```

### Scheduled tasks created

- `TMMT-Hub-Sync` — git pull every 15 min  
- `TMMT-Daily-Command-Center` — 7:00 AM  
- `TMMT-Brain-Cycle-AM` — 9:00 AM  
- `AIX-Morning-Operator` — 7:30 AM  
- `AIX-Chummo-Portal` — at logon  

---

## 6. Windows workers (i5, AMD×2, Surface)

**Do not** run `install-hub-brain-windows.ps1` on Surface.

```powershell
cd C:\dev\TMMT\ops\dev-machine
git clone -b main https://github.com/AIXMOS537/TMMT.git C:\dev\TMMT
.\set-machine-role.ps1 -Role worker
```

This clones (if needed) and registers **code-only** sync every 15 minutes.

**AMD boxes — use home GPU over Tailscale:**

```powershell
$env:OLLAMA_HOST = "http://home-pc:11434"
ollama list
```

---

## 7. GHL ↔ TMMT OS verification (5 min)

1. **GHL:** Open real contact → copy **email** + **contact ID** from URL (`…/contacts/detail/ID`).  
2. **TMMT OS:** https://tmmt-ops.vercel.app → Internal → Cases → open case or create via intake with same email.  
3. **Link:** Amber card **“Link GHL contact (verification)”** → paste email + ID → **Save & sync portal fields to GHL**.  
4. **Test:** Post update to client or Advance status.  
5. **GHL check:** `tmmt_case_ref`, `tmmt_track_url`, `tmmt_portal_url`, tag `tmmt-portal-alert`.

Reply format: `fields filled: yes/no | tag/workflow fired: yes/no`

**If fields empty:** custom field keys match, real contact ID (not `demo-ghl-contact`), `GHL_API_KEY` on Vercel production.

---

## 8. Secrets checklist (never commit)

- [ ] `tmmt-os/.env.local` (Mac + Vercel env)  
- [ ] `AUTOMATIONS/.env` (hub automations)  
- [ ] `AIX_AI_COMMAND_SYSTEM/.env` (morning operator)  
- [ ] Vercel production: `GHL_API_KEY`, `GHL_LOCATION_ID`, Supabase keys  
- [ ] `ANTHROPIC_API_KEY` on Windows hub (CHUMMO)  

---

## 9. Script cheat sheet

| Task | macOS | Windows |
|------|-------|---------|
| First-time setup | `ops/dev-machine/bootstrap-macos.sh` | `install-hub-brain-windows.ps1` (hub) or `set-machine-role.ps1 -Role worker` |
| Manual sync | `sync-machine.sh` | `sync-windows.ps1` |
| Auto sync | `install-launchd.sh` | `install-scheduled-task.ps1` or hub installer |
| Brain cycle | — | `hub-brain/run-brain-cycle.ps1` |

**In repo:** `TMMT/ops/dev-machine/` · `hub-brain/README.md` · `FLEET.md` · `TAILSCALE-SSH.md`

---

## 10. Cleanup duplicates on Desktop

After `~/dev` or `C:\dev` works:

```bash
# macOS — archive old copy
mv ~/Desktop/AIX_Command_Center/TMMT\ MANAGEMENT ~/Archive/TMMT-MANAGEMENT-backup
rm -rf ~/Desktop/TMMT\ MANAGEMENT   # empty stub only
```

Do **not** delete `BROTHER I` / `PLUG_AND_PLAY_MASTER` copies until you confirm nothing unique lives there.

---

## 11. Dotfiles (optional next step)

Private repo for: `~/.zshrc`, Cursor snippets, `fnm` / `mise` config — symlink on each Mac.

---

*Print this file or open in Word: File → Open → select this `.md` or the `.rtf` on your Desktop.*
