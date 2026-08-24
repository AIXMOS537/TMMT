# Operator Portable Kit (OPK) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `AIXMOS537/aixmos-kit` orchestrator repo plus the physical USB build process that lets one universal flash drive deploy the AIXMOS/TMMT operations stack onto owner Macs (M5 Pro carry, M1 Max work), the Brainiac 7 Windows AI brain, and any operator workstation (Mac or Windows) — with auto-pull updates from GitHub and zero secrets in the operator kit.

**Architecture:** New thin orchestrator repo (`AIXMOS537/aixmos-kit`, ~50MB checked out) composes the 5 existing AIXMOS537 repos per role via cross-platform installers. Role detected by first-run wizard (always confirmed by user). Operator role = thin client (browser + Tailscale + 3 bookmarks). Owner roles = full dev stacks. Brainiac 7 delegates to existing `AI-OPS-STARTER` repo for the Docker/Ollama/Open WebUI/n8n/Qdrant setup, never duplicating it. Auto-pull runs on every login + every 30 minutes via launchd (Mac) and Task Scheduler (Windows).

**Tech Stack:**
- **Shell:** bash 5.x (macOS via Homebrew) — installers, auto-pull, daily-driver
- **PowerShell:** 7.x (Windows) — installers, auto-pull, Task Scheduler XML
- **JSON manifest:** `repos.json`, `packages.json`, `shortcuts.json`
- **CI:** GitHub Actions — shellcheck, bash -n, PSScriptAnalyzer, JSON lint, secret scan
- **Distribution:** FAT32 USB drives, prepared via `build-master-usb.sh`
- **External tools relied on:** `git`, `gh` (GitHub CLI), Tailscale, Brave portable, Homebrew (Mac), winget/scoop (Windows), Node.js + npm (owner-work + owner-brain), Ollama (owner-work + owner-brain), Docker Desktop (owner-brain, via AI-OPS-STARTER), nssm (owner-brain, for Windows service)

**Spec:** [`docs/superpowers/specs/2026-05-26-operator-portable-kit-design.md`](../specs/2026-05-26-operator-portable-kit-design.md)

---

## File Structure

The `aixmos-kit` repo built by this plan looks like this. **Every file listed below is created or modified by a specific task.** Tasks below reference files by their final path inside `aixmos-kit/`.

```
aixmos-kit/
├── README.md                                # Task 1
├── LICENSE                                  # Task 1
├── .gitignore                               # Task 1
├── START_HERE.command                       # Task 3
├── START_HERE.bat                           # Task 3
├── bootstrap/
│   ├── detect.sh                            # Task 3
│   ├── detect.ps1                           # Task 3
│   ├── mac.sh                               # Task 3
│   └── win.ps1                              # Task 3
├── roles/
│   ├── operator/
│   │   ├── install-mac.sh                   # Task 5
│   │   ├── install-win.ps1                  # Task 6
│   │   └── shortcuts/
│   │       ├── tmmt-admin.webloc            # Task 5
│   │       ├── chummo-chat.webloc           # Task 5
│   │       └── update-now.webloc            # Task 5
│   ├── owner-carry/
│   │   ├── install-mac.sh                   # Task 12
│   │   └── shortcuts/                       # Task 12
│   ├── owner-work/
│   │   ├── install-mac.sh                   # Task 13
│   │   └── shortcuts/                       # Task 13
│   └── owner-brain/
│       ├── install-win.ps1                  # Task 15
│       └── shortcuts/                       # Task 15
├── scripts/
│   ├── auto-pull.sh                         # Task 9
│   ├── auto-pull.ps1                        # Task 10
│   ├── daily-driver-operator.sh             # Task 7
│   ├── daily-driver-operator.ps1            # Task 8
│   ├── owner-brief.sh                       # Task 14
│   ├── build-master-usb.sh                  # Task 16
│   └── revoke-kit.sh                        # Task 17
├── shortcuts/                               # Source-of-truth bookmark files
│   ├── tmmt-admin.webloc                    # Task 3 (used by operator + all)
│   ├── chummo-chat.webloc                   # Task 3
│   ├── update-now.webloc                    # Task 3
│   └── helpdesk.webloc                      # Task 3
├── manifest/
│   ├── repos.json                           # Task 2
│   ├── packages.json                        # Task 2
│   └── shortcuts.json                       # Task 2
├── system/
│   ├── launchd/
│   │   └── com.aixmos.auto-pull.plist.tmpl  # Task 9
│   └── task-scheduler/
│       └── aixmos-auto-pull.xml.tmpl        # Task 10
├── revoked-kits.txt                         # Task 17
├── docs/
│   ├── OPERATOR_QUICKSTART.md               # Task 18
│   ├── OWNER_RUNBOOK.md                     # Task 18
│   ├── BRAINIAC_7_RUNBOOK.md                # Task 18
│   ├── three-machine-setup.md               # Task 22 (moved from ~/projects/portable-setup)
│   ├── tailscale-setup.md                   # Task 22
│   ├── nas-ugreen-setup.md                  # Task 22
│   └── wake-on-lan.md                       # Task 22
├── tests/
│   ├── lint-shell.sh                        # Task 4
│   ├── lint-powershell.sh                   # Task 4
│   ├── lint-json.sh                         # Task 4
│   ├── scan-secrets.sh                      # Task 19
│   └── acceptance/
│       ├── AT-1-operator-mac.sh             # Task 20
│       ├── AT-2-operator-windows.md         # Task 20 (manual checklist)
│       ├── AT-3-autopull-propagation.sh     # Task 20
│       ├── AT-4-gate-blocks-bad.sh          # Task 20
│       ├── AT-5-revoked-aborts.sh           # Task 20
│       ├── AT-6-brainiac-offline-indicator.sh # Task 20
│       ├── AT-7-owner-work-fresh.md         # Task 20 (manual checklist)
│       └── AT-8-no-secrets-in-kit.sh        # Task 20
└── .github/
    └── workflows/
        └── gate-main.yml                    # Task 4
```

---

## Preconditions (owner-only, before agent starts)

These steps require the owner's GitHub credentials and cannot be done by the implementation agent.

- [ ] **P1: Create the GitHub repo.**

The owner runs (or does via web UI):

```bash
gh repo create AIXMOS537/aixmos-kit --private --description "Universal OPK orchestrator — deploys AIXMOS/TMMT stack to any owner or operator machine"
```

Expected: `https://github.com/AIXMOS537/aixmos-kit.git` is created and empty.

- [ ] **P2: Clone the empty repo locally.**

```bash
cd ~/projects
gh repo clone AIXMOS537/aixmos-kit
cd aixmos-kit
```

Expected: `~/projects/aixmos-kit/.git/` exists. `git remote -v` shows `origin` = `https://github.com/AIXMOS537/aixmos-kit.git`.

- [ ] **P3: Set default branch to `main`.**

```bash
cd ~/projects/aixmos-kit
git checkout -b main
echo "# aixmos-kit (placeholder)" > README.md
git add README.md
git commit -m "chore: initial commit"
git push -u origin main
gh repo edit --default-branch main
```

Expected: `gh repo view AIXMOS537/aixmos-kit --json defaultBranchRef` returns `"name":"main"`.

After P1-P3 complete, the implementation agent starts at Task 1.

---

## Phase 1: Repo Scaffold (Tasks 1-4)

### Task 1: Repo skeleton, README, LICENSE, .gitignore

**Files:**
- Create: `~/projects/aixmos-kit/README.md`
- Create: `~/projects/aixmos-kit/LICENSE`
- Create: `~/projects/aixmos-kit/.gitignore`
- Create: `~/projects/aixmos-kit/CODEOWNERS`

- [ ] **Step 1: Branch off main.**

Run:
```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-1-scaffold
```

Expected: `git branch --show-current` outputs `feat/task-1-scaffold`.

- [ ] **Step 2: Write the README.**

Create `README.md` with this exact content:

```markdown
# AIXMOS Operator Portable Kit (OPK)

Universal orchestrator that deploys the AIXMOS/TMMT operations stack to any owner or operator machine.

**Spec:** [`AIXMOS537/TMMT` → docs/superpowers/specs/2026-05-26-operator-portable-kit-design.md](https://github.com/AIXMOS537/TMMT/blob/master/docs/superpowers/specs/2026-05-26-operator-portable-kit-design.md)

**Plan:** [`AIXMOS537/TMMT` → docs/superpowers/plans/2026-05-26-operator-portable-kit.md](https://github.com/AIXMOS537/TMMT/blob/master/docs/superpowers/plans/2026-05-26-operator-portable-kit.md)

## What is this?

A single USB flash drive that, plugged into any Mac or Windows machine, installs the right stack for the right role (owner / operator / Brainiac 7) and keeps that machine updated from GitHub.

## First-time use

Plug the USB drive into your computer, then double-click:
- **macOS:** `START_HERE.command`
- **Windows:** `START_HERE.bat`

The wizard takes ~15 minutes for operators, ~30 minutes for owners.

## Roles

| Role | Profile | Purpose |
|------|---------|---------|
| OWNER | `owner-carry` | M5 Pro carry MacBook — minimal remote terminal |
| OWNER | `owner-work` | M1 Max work MacBook — full dev stack, all 5 repos |
| OWNER | `owner-brain` | Brainiac 7 Windows PC — always-on AI brain |
| OPERATOR | `operator` | Office workstation or operator laptop — thin client (browser + Tailscale) |

## Updates

Auto-pulls from this repo on every login and every 30 minutes. Owners push to `main`; operators see changes within 30 minutes.

## Help

Operators: click "Help" on your daily-driver brief.
Owner: see `docs/OWNER_RUNBOOK.md`.
```

- [ ] **Step 3: Write the LICENSE.**

Create `LICENSE` with the standard MIT text (substituting copyright):

```
MIT License

Copyright (c) 2026 AIXMOS / Muhammad Taha

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Write the .gitignore.**

Create `.gitignore`:

```
# OS junk
.DS_Store
._*
Thumbs.db
desktop.ini

# Local state — never commit
.last-pull.log
.last-brief.md
kit-id.txt
.env
.env.local

# Editor noise
.vscode/
.idea/
*.swp
*.swo

# Build artifacts
*.dmg
*.iso
build/
dist/
```

- [ ] **Step 5: Write the CODEOWNERS.**

Create `CODEOWNERS` (note: no leading dot — this is a top-level file):

```
* @AIXMOS537
```

This makes every PR require owner review.

- [ ] **Step 6: Commit.**

```bash
git add README.md LICENSE .gitignore CODEOWNERS
git commit -m "chore: scaffold repo (README, LICENSE, .gitignore, CODEOWNERS)"
```

- [ ] **Step 7: Push and open PR.**

```bash
git push -u origin feat/task-1-scaffold
gh pr create --title "Task 1: scaffold" --body "Scaffold repo per implementation plan, Task 1."
```

Expected: PR opened. Will not auto-merge (gate doesn't exist yet); owner merges manually.

---

### Task 2: Manifest files (repos.json, packages.json, shortcuts.json)

**Files:**
- Create: `~/projects/aixmos-kit/manifest/repos.json`
- Create: `~/projects/aixmos-kit/manifest/packages.json`
- Create: `~/projects/aixmos-kit/manifest/shortcuts.json`

These three JSON files are the single source of truth for what each role gets. Role installers read them.

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-2-manifests
mkdir -p manifest
```

- [ ] **Step 2: Write `manifest/repos.json`.**

Each role lists which of the 5 AIXMOS537 repos it clones, with the branch and target path.

```json
{
  "schemaVersion": "1.0",
  "roles": {
    "owner-carry": {
      "required": [
        { "owner": "AIXMOS537", "repo": "aixmos-kit",         "branch": "main",   "targetPath": "~/projects/aixmos-kit" },
        { "owner": "AIXMOS537", "repo": "ai-command-center",  "branch": "main",   "targetPath": "~/projects/ai-command-center" }
      ],
      "optional": [
        { "owner": "AIXMOS537", "repo": "TMMT",                "branch": "master", "targetPath": "~/projects/TMMT" },
        { "owner": "AIXMOS537", "repo": "AIXMOS-AGENTS",       "branch": "main",   "targetPath": "~/projects/AIXMOS-AGENTS" },
        { "owner": "AIXMOS537", "repo": "AIX-Command-Center",  "branch": "main",   "targetPath": "~/projects/AIX-Command-Center" },
        { "owner": "AIXMOS537", "repo": "PROJECTAIXMOS",       "branch": "main",   "targetPath": "~/projects/PROJECTAIXMOS" },
        { "owner": "AIXMOS537", "repo": "TMMT-AI-RUNTIME",     "branch": "main",   "targetPath": "~/projects/TMMT-AI-RUNTIME" },
        { "owner": "AIXMOS537", "repo": "AI-OPS-STARTER",      "branch": "main",   "targetPath": "~/projects/AI-OPS-STARTER" }
      ]
    },
    "owner-work": {
      "required": [
        { "owner": "AIXMOS537", "repo": "aixmos-kit",         "branch": "main",   "targetPath": "~/projects/aixmos-kit" },
        { "owner": "AIXMOS537", "repo": "TMMT",                "branch": "master", "targetPath": "~/projects/TMMT" },
        { "owner": "AIXMOS537", "repo": "AIXMOS-AGENTS",       "branch": "main",   "targetPath": "~/projects/AIXMOS-AGENTS" },
        { "owner": "AIXMOS537", "repo": "AIX-Command-Center",  "branch": "main",   "targetPath": "~/projects/AIX-Command-Center" },
        { "owner": "AIXMOS537", "repo": "ai-command-center",   "branch": "main",   "targetPath": "~/projects/ai-command-center" },
        { "owner": "AIXMOS537", "repo": "PROJECTAIXMOS",       "branch": "main",   "targetPath": "~/projects/PROJECTAIXMOS" },
        { "owner": "AIXMOS537", "repo": "TMMT-AI-RUNTIME",     "branch": "main",   "targetPath": "~/projects/TMMT-AI-RUNTIME" }
      ],
      "optional": []
    },
    "owner-brain": {
      "required": [
        { "owner": "AIXMOS537", "repo": "aixmos-kit",         "branch": "main", "targetPath": "%USERPROFILE%/projects/aixmos-kit" },
        { "owner": "AIXMOS537", "repo": "AIXMOS-AGENTS",       "branch": "main", "targetPath": "%USERPROFILE%/projects/AIXMOS-AGENTS" },
        { "owner": "AIXMOS537", "repo": "AIX-Command-Center",  "branch": "main", "targetPath": "%USERPROFILE%/projects/AIX-Command-Center" },
        { "owner": "AIXMOS537", "repo": "ai-command-center",   "branch": "main", "targetPath": "%USERPROFILE%/projects/ai-command-center" },
        { "owner": "AIXMOS537", "repo": "AI-OPS-STARTER",      "branch": "main", "targetPath": "%USERPROFILE%/projects/AI-OPS-STARTER" }
      ],
      "optional": []
    },
    "operator": {
      "required": [
        { "owner": "AIXMOS537", "repo": "aixmos-kit", "branch": "main", "targetPath": "~/aixmos-kit" }
      ],
      "optional": []
    }
  }
}
```

- [ ] **Step 3: Write `manifest/packages.json`.**

Packages installed per OS per role:

```json
{
  "schemaVersion": "1.0",
  "macos": {
    "owner-carry": {
      "brewFormulas": ["git", "gh"],
      "brewCasks": ["brave-browser"],
      "ollamaModels": []
    },
    "owner-work": {
      "brewFormulas": ["git", "gh", "node@20", "python@3.12", "ollama"],
      "brewCasks": ["brave-browser", "visual-studio-code"],
      "ollamaModels": ["llama3.2:3b"]
    },
    "operator": {
      "brewFormulas": ["git"],
      "brewCasks": ["brave-browser"],
      "ollamaModels": []
    }
  },
  "windows": {
    "owner-brain": {
      "wingetIds": ["Git.Git", "GitHub.cli", "OpenJS.NodeJS.LTS", "Ollama.Ollama", "Tailscale.Tailscale", "Docker.DockerDesktop"],
      "scoopApps": ["nssm"],
      "ollamaModels": ["llama3.2:3b", "qwen2.5:7b", "nomic-embed-text"]
    },
    "operator": {
      "wingetIds": ["Tailscale.Tailscale", "Brave.Brave"],
      "scoopApps": [],
      "ollamaModels": []
    }
  }
}
```

- [ ] **Step 4: Write `manifest/shortcuts.json`.**

Maps each role to the shortcut files it gets on desktop:

```json
{
  "schemaVersion": "1.0",
  "shortcuts": {
    "tmmt-admin":    { "label": "TMMT Admin",     "url": "https://allinonemanagementsolutions.net",  "icon": "tmmt-admin.png" },
    "chummo-chat":   { "label": "CHUMMO Chat",    "url": "https://brainiac-7:3000",                  "icon": "chummo.png" },
    "update-now":    { "label": "Update Now",     "url": "file:///%PATH_TO_AUTOPULL_SCRIPT%",        "icon": "update.png" },
    "helpdesk":      { "label": "Help",           "url": "file:///%PATH_TO_HELP_SCRIPT%",            "icon": "help.png" },
    "tmmt-dev":      { "label": "TMMT Dev",       "url": "http://localhost:3000",                    "icon": "dev.png" },
    "open-webui":    { "label": "Open WebUI",     "url": "http://127.0.0.1:3000",                    "icon": "webui.png" },
    "n8n":           { "label": "n8n",            "url": "http://127.0.0.1:5678",                    "icon": "n8n.png" }
  },
  "rolePackages": {
    "owner-carry": ["tmmt-admin", "chummo-chat", "helpdesk"],
    "owner-work":  ["tmmt-admin", "tmmt-dev", "chummo-chat", "open-webui", "n8n", "helpdesk"],
    "owner-brain": ["open-webui", "n8n", "helpdesk"],
    "operator":    ["tmmt-admin", "chummo-chat", "update-now", "helpdesk"]
  }
}
```

- [ ] **Step 5: Validate JSON files parse cleanly.**

Run:
```bash
for f in manifest/*.json; do echo "$f:"; jq empty "$f" && echo "  OK"; done
```

Expected: each file prints `OK`. If any prints a parse error, fix the JSON.

- [ ] **Step 6: Commit, push, PR.**

```bash
git add manifest/
git commit -m "feat: add manifest/{repos,packages,shortcuts}.json (single source of truth for role composition)"
git push -u origin feat/task-2-manifests
gh pr create --title "Task 2: manifests" --body "Manifest JSON files for repos / packages / shortcuts per role."
```

---

### Task 3: Bootstrap entry points (`START_HERE` + `bootstrap/`)

**Files:**
- Create: `~/projects/aixmos-kit/START_HERE.command`
- Create: `~/projects/aixmos-kit/START_HERE.bat`
- Create: `~/projects/aixmos-kit/bootstrap/detect.sh`
- Create: `~/projects/aixmos-kit/bootstrap/detect.ps1`
- Create: `~/projects/aixmos-kit/bootstrap/mac.sh`
- Create: `~/projects/aixmos-kit/bootstrap/win.ps1`
- Create: `~/projects/aixmos-kit/shortcuts/tmmt-admin.webloc`
- Create: `~/projects/aixmos-kit/shortcuts/chummo-chat.webloc`
- Create: `~/projects/aixmos-kit/shortcuts/update-now.webloc`
- Create: `~/projects/aixmos-kit/shortcuts/helpdesk.webloc`

The user double-clicks `START_HERE.command` or `START_HERE.bat`. That entry point calls `bootstrap/mac.sh` or `bootstrap/win.ps1`. That bootstrap script: (1) sources `detect.sh` / `detect.ps1` to suggest a role, (2) prompts the user to confirm role + (if owner) profile, (3) delegates to the matching `roles/<role>/install-<os>.{sh,ps1}` (which will be created in Tasks 5, 6, 12, 13, 15).

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-3-bootstrap
mkdir -p bootstrap shortcuts
```

- [ ] **Step 2: Write `START_HERE.command` (Mac entry point).**

```bash
#!/usr/bin/env bash
# OPK first-run entry point for macOS.
# Double-clickable in Finder. Opens Terminal automatically.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec /bin/bash "$DIR/bootstrap/mac.sh"
```

Make executable:
```bash
chmod +x START_HERE.command
```

- [ ] **Step 3: Write `START_HERE.bat` (Windows entry point).**

```batch
@echo off
REM OPK first-run entry point for Windows.
REM Double-clickable in File Explorer. Opens PowerShell automatically.
setlocal
set "SCRIPT_DIR=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%bootstrap\win.ps1"
endlocal
```

- [ ] **Step 4: Write `bootstrap/detect.sh` (POSIX shell role-suggestion).**

```bash
#!/usr/bin/env bash
# Suggest a role based on hostname + env. Used by bootstrap/mac.sh.
# Outputs ONE token: owner-work | owner-carry | owner-brain | operator
detect_role() {
  local hn os
  hn="$(hostname -s 2>/dev/null || hostname)"
  os="$(uname -s)"
  case "$os" in
    Darwin)
      # Owner Mac heuristics
      if [[ "$hn" == *MacBook-Pro* && -d "$HOME/projects/AIXMOS-AGENTS" ]]; then
        echo "owner-work"
        return
      fi
      if [[ "$hn" == *MacBook-Pro* || "$hn" == *MacBook-Air* ]]; then
        echo "owner-carry"
        return
      fi
      echo "operator"
      ;;
    *)
      echo "operator"
      ;;
  esac
}
detect_role
```

Make executable:
```bash
chmod +x bootstrap/detect.sh
```

- [ ] **Step 5: Write `bootstrap/detect.ps1` (PowerShell role-suggestion).**

```powershell
# Suggest a role based on hostname. Used by bootstrap/win.ps1.
# Outputs ONE token: owner-brain | operator
function Get-SuggestedRole {
  $hn = [System.Net.Dns]::GetHostName()
  if ($hn -match 'brainiac' -or $hn -match 'BRAINIAC') { return 'owner-brain' }
  return 'operator'
}
Get-SuggestedRole
```

- [ ] **Step 6: Write `bootstrap/mac.sh` (the wizard).**

```bash
#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIT_ROOT="$(cd "$HERE/.." && pwd)"

echo
echo "==============================================="
echo "  AIXMOS Operator Portable Kit — first run"
echo "==============================================="
echo

suggested="$("$HERE/detect.sh")"
echo "Suggested role for this machine: $suggested"
echo
echo "Pick a role:"
echo "  1) operator     (browser + Tailscale, no dev tools)"
echo "  2) owner-carry  (M5 Pro carry MacBook — minimal owner)"
echo "  3) owner-work   (M1 Max work MacBook — full dev stack)"
echo
read -r -p "Number [1-3, Enter for suggested]: " choice
choice="${choice:-_suggested}"
case "$choice" in
  1) role="operator" ;;
  2) role="owner-carry" ;;
  3) role="owner-work" ;;
  _suggested) role="$suggested" ;;
  *) echo "Unknown choice. Aborting." >&2; exit 1 ;;
esac

# owner-brain is Windows-only; reject on Mac
if [[ "$role" == "owner-brain" ]]; then
  echo "ERROR: owner-brain is Brainiac 7 (Windows). Use START_HERE.bat on the Brainiac 7 machine." >&2
  exit 1
fi

echo
echo "Installing role: $role"
echo
installer="$KIT_ROOT/roles/$role/install-mac.sh"
if [[ ! -x "$installer" ]]; then
  echo "ERROR: installer not found or not executable: $installer" >&2
  exit 1
fi
exec /bin/bash "$installer"
```

Make executable:
```bash
chmod +x bootstrap/mac.sh
```

- [ ] **Step 7: Write `bootstrap/win.ps1` (the wizard).**

```powershell
$ErrorActionPreference = 'Stop'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$KitRoot = Resolve-Path "$Here\.."

Write-Host ""
Write-Host "==============================================="
Write-Host "  AIXMOS Operator Portable Kit - first run"
Write-Host "==============================================="
Write-Host ""

. "$Here\detect.ps1" | Out-Null
$suggested = Get-SuggestedRole
Write-Host "Suggested role for this machine: $suggested"
Write-Host ""
Write-Host "Pick a role:"
Write-Host "  1) operator     (browser + Tailscale, no dev tools)"
Write-Host "  2) owner-brain  (Brainiac 7 - always-on AI brain)"
Write-Host ""

$choice = Read-Host "Number [1-2, Enter for suggested]"
if ([string]::IsNullOrWhiteSpace($choice)) {
  $role = $suggested
} elseif ($choice -eq '1') {
  $role = 'operator'
} elseif ($choice -eq '2') {
  $role = 'owner-brain'
} else {
  Write-Error "Unknown choice. Aborting."
  exit 1
}

# owner-carry / owner-work are Mac-only; reject on Windows
if ($role -eq 'owner-carry' -or $role -eq 'owner-work') {
  Write-Error "$role is a Mac profile. Use START_HERE.command on a Mac."
  exit 1
}

Write-Host ""
Write-Host "Installing role: $role"
Write-Host ""

$installer = Join-Path $KitRoot "roles\$role\install-win.ps1"
if (-not (Test-Path $installer)) {
  Write-Error "Installer not found: $installer"
  exit 1
}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer
```

- [ ] **Step 8: Write the 4 source-of-truth `.webloc` shortcut files.**

These are Apple's plist-XML format and work on macOS by double-click; the Mac installers copy them to `~/Desktop/`. Windows installers will translate the URLs into `.url` files at install time (no .webloc support on Windows).

`shortcuts/tmmt-admin.webloc`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>URL</key>
  <string>https://allinonemanagementsolutions.net</string>
</dict>
</plist>
```

`shortcuts/chummo-chat.webloc`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>URL</key>
  <string>https://brainiac-7:3000</string>
</dict>
</plist>
```

`shortcuts/update-now.webloc` (points to a local file the installer will create on the machine — placeholder URL here, installers rewrite it):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>URL</key>
  <string>file:///REWRITTEN_BY_INSTALLER</string>
</dict>
</plist>
```

`shortcuts/helpdesk.webloc`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>URL</key>
  <string>file:///REWRITTEN_BY_INSTALLER</string>
</dict>
</plist>
```

- [ ] **Step 9: Validate shell syntax.**

```bash
bash -n bootstrap/mac.sh
bash -n bootstrap/detect.sh
bash -n START_HERE.command
```

Expected: no output (silence = success).

- [ ] **Step 10: Validate PowerShell syntax.**

If `pwsh` is available locally, run:
```bash
pwsh -NoProfile -Command "[void](Get-Command Test-Path); \$null = [scriptblock]::Create((Get-Content -Raw 'bootstrap/win.ps1'))"
pwsh -NoProfile -Command "\$null = [scriptblock]::Create((Get-Content -Raw 'bootstrap/detect.ps1'))"
```

Expected: no errors. If `pwsh` is not installed locally, skip this step — the GitHub Action gate (Task 4) will catch it.

- [ ] **Step 11: Commit, push, PR.**

```bash
git add START_HERE.command START_HERE.bat bootstrap/ shortcuts/
git commit -m "feat: bootstrap entry points (START_HERE + bootstrap/{mac.sh,win.ps1,detect.{sh,ps1}}) and source-of-truth shortcuts"
git push -u origin feat/task-3-bootstrap
gh pr create --title "Task 3: bootstrap" --body "Entry points + role-detection wizard + shortcut templates."
```

---

### Task 4: GitHub Action gate (shellcheck + bash -n + PSScriptAnalyzer + JSON lint)

**Files:**
- Create: `~/projects/aixmos-kit/.github/workflows/gate-main.yml`
- Create: `~/projects/aixmos-kit/tests/lint-shell.sh`
- Create: `~/projects/aixmos-kit/tests/lint-powershell.sh`
- Create: `~/projects/aixmos-kit/tests/lint-json.sh`

After this task, every PR to `main` must pass these checks. One bad push could break every operator next morning; this gate is the guardrail.

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-4-gate
mkdir -p .github/workflows tests
```

- [ ] **Step 2: Write `tests/lint-shell.sh`.**

```bash
#!/usr/bin/env bash
# Lint all shell scripts in the repo.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

failed=0
while IFS= read -r -d '' f; do
  echo "shellcheck: $f"
  if ! shellcheck "$f"; then failed=1; fi
  echo "bash -n:    $f"
  if ! bash -n "$f"; then failed=1; fi
done < <(find . -type f \( -name "*.sh" -o -name "*.command" -o -name "*.bash" \) -not -path "./.git/*" -print0)

if [[ $failed -ne 0 ]]; then
  echo "Shell lint FAILED" >&2
  exit 1
fi
echo "Shell lint PASSED"
```

Make executable:
```bash
chmod +x tests/lint-shell.sh
```

- [ ] **Step 3: Write `tests/lint-powershell.sh`.**

```bash
#!/usr/bin/env bash
# Lint all PowerShell scripts via PSScriptAnalyzer.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if ! command -v pwsh >/dev/null 2>&1; then
  echo "pwsh not installed; skipping" >&2
  exit 0
fi

ps_files=()
while IFS= read -r -d '' f; do
  ps_files+=("$f")
done < <(find . -type f -name "*.ps1" -not -path "./.git/*" -print0)

if [[ ${#ps_files[@]} -eq 0 ]]; then
  echo "No .ps1 files; skipping"
  exit 0
fi

pwsh -NoProfile -Command "
  if (-not (Get-Module -ListAvailable -Name PSScriptAnalyzer)) {
    Install-Module PSScriptAnalyzer -Force -Scope CurrentUser
  }
  \$failed = \$false
  foreach (\$f in @($(printf '"%s",' "${ps_files[@]}" | sed 's/,$//'))) {
    Write-Host \"PSScriptAnalyzer: \$f\"
    \$issues = Invoke-ScriptAnalyzer -Path \$f -Severity Error
    if (\$issues) { \$issues | Format-Table; \$failed = \$true }
    \$null = [scriptblock]::Create((Get-Content -Raw \$f))
  }
  if (\$failed) { exit 1 }
"
echo "PowerShell lint PASSED"
```

Make executable:
```bash
chmod +x tests/lint-powershell.sh
```

- [ ] **Step 4: Write `tests/lint-json.sh`.**

```bash
#!/usr/bin/env bash
# Validate every .json file parses cleanly.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

failed=0
while IFS= read -r -d '' f; do
  echo "jq:         $f"
  if ! jq empty "$f"; then failed=1; fi
done < <(find . -type f -name "*.json" -not -path "./.git/*" -not -path "./node_modules/*" -print0)

if [[ $failed -ne 0 ]]; then
  echo "JSON lint FAILED" >&2
  exit 1
fi
echo "JSON lint PASSED"
```

Make executable:
```bash
chmod +x tests/lint-json.sh
```

- [ ] **Step 5: Write `.github/workflows/gate-main.yml`.**

```yaml
name: gate-main
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install shellcheck + jq
        run: sudo apt-get update && sudo apt-get install -y shellcheck jq

      - name: Install PowerShell
        run: |
          sudo apt-get install -y wget apt-transport-https
          wget -q "https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb"
          sudo dpkg -i packages-microsoft-prod.deb
          sudo apt-get update
          sudo apt-get install -y powershell

      - name: Lint shell
        run: ./tests/lint-shell.sh

      - name: Lint PowerShell
        run: ./tests/lint-powershell.sh

      - name: Lint JSON
        run: ./tests/lint-json.sh
```

- [ ] **Step 6: Commit, push, PR.**

```bash
git add tests/ .github/
git commit -m "ci: add gate-main workflow (shellcheck + PSScriptAnalyzer + JSON lint)"
git push -u origin feat/task-4-gate
gh pr create --title "Task 4: CI gate" --body "GitHub Action that lints shell, PowerShell, and JSON. Required check for merge to main."
```

- [ ] **Step 7: After merge, mark `gate-main` as required check.**

In GitHub UI: Settings → Branches → main → Edit → Require status checks → select `lint`.

Expected: subsequent PRs cannot merge to main without `lint` passing.

---

## Phase 2: Operator Role (Tasks 5-8)

### Task 5: `roles/operator/install-mac.sh`

**Files:**
- Create: `~/projects/aixmos-kit/roles/operator/install-mac.sh`
- Create: `~/projects/aixmos-kit/roles/operator/shortcuts/` (directory placeholder via `.gitkeep`)

After this task, an operator on macOS can plug the USB, run `START_HERE.command`, and end up at the daily-driver brief (Task 7 will render that brief).

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-5-operator-mac
mkdir -p roles/operator/shortcuts
touch roles/operator/shortcuts/.gitkeep
```

- [ ] **Step 2: Write `roles/operator/install-mac.sh`.**

```bash
#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIT_ROOT="$(cd "$HERE/../.." && pwd)"
ROLE="operator"

log() { echo "[operator/mac] $*"; }
die() { echo "[operator/mac] ERROR: $*" >&2; exit 1; }

# --- 1. Verify macOS ---
[[ "$(uname -s)" == "Darwin" ]] || die "Not macOS"

# --- 2. Install Homebrew if missing ---
if ! command -v brew >/dev/null 2>&1; then
  log "Installing Homebrew..."
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
fi
brew --version >/dev/null || die "Homebrew install failed"

# --- 3. Install packages per manifest/packages.json ---
formulas=$(jq -r '.macos.operator.brewFormulas[]' "$KIT_ROOT/manifest/packages.json")
casks=$(jq -r '.macos.operator.brewCasks[]' "$KIT_ROOT/manifest/packages.json")
for f in $formulas; do log "brew install $f"; brew install "$f" || true; done
for c in $casks;    do log "brew install --cask $c"; brew install --cask "$c" || true; done

# --- 4. Install Tailscale (macOS App Store version preferred; brew fallback) ---
if [[ ! -d "/Applications/Tailscale.app" ]]; then
  log "Installing Tailscale via brew cask..."
  brew install --cask tailscale || true
fi
log "Open Tailscale once to sign in (you should see the invitation email)."
open -a Tailscale || true

# --- 5. Clone aixmos-kit to ~/aixmos-kit (the operator's working copy for auto-pull) ---
target="$HOME/aixmos-kit"
if [[ ! -d "$target/.git" ]]; then
  log "Cloning AIXMOS537/aixmos-kit to $target..."
  git clone https://github.com/AIXMOS537/aixmos-kit.git "$target"
fi

# --- 6. Write kit-id (per-machine identifier for revoke logic) ---
if [[ ! -s "$target/kit-id.txt" ]]; then
  printf '%s\n' "$(uuidgen)" > "$target/kit-id.txt"
fi

# --- 7. Install desktop shortcuts ---
DESKTOP="$HOME/Desktop"
mkdir -p "$DESKTOP"
# Copy the static shortcuts (TMMT Admin, CHUMMO Chat) from kit
cp "$KIT_ROOT/shortcuts/tmmt-admin.webloc" "$DESKTOP/TMMT Admin.webloc"
cp "$KIT_ROOT/shortcuts/chummo-chat.webloc" "$DESKTOP/CHUMMO Chat.webloc"
# Rewrite the file:// shortcuts to point at local scripts in $target
cat > "$DESKTOP/Update Now.webloc" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>URL</key>
  <string>file://$target/scripts/auto-pull.sh</string>
</dict>
</plist>
EOF
cat > "$DESKTOP/Daily Brief.webloc" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>URL</key>
  <string>file://$target/.last-brief.html</string>
</dict>
</plist>
EOF

# --- 8. Install launchd plist for auto-pull (installed by Task 9; placeholder here) ---
# (Auto-pull plist installation handled in Task 9's installer hook; here we just ensure
#  the launchd directory exists and skip if the plist hasn't been added to the repo yet.)
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_AGENTS"
plist_tmpl="$target/system/launchd/com.aixmos.auto-pull.plist.tmpl"
if [[ -f "$plist_tmpl" ]]; then
  sed "s|__HOME__|$HOME|g; s|__KIT__|$target|g" "$plist_tmpl" > "$LAUNCH_AGENTS/com.aixmos.auto-pull.plist"
  launchctl unload "$LAUNCH_AGENTS/com.aixmos.auto-pull.plist" 2>/dev/null || true
  launchctl load   "$LAUNCH_AGENTS/com.aixmos.auto-pull.plist"
  log "Installed and loaded launchd auto-pull agent."
else
  log "auto-pull plist template not present yet; will be installed on next auto-pull cycle after Task 9 merges."
fi

# --- 9. Run the daily-driver renderer once so the brief exists ---
if [[ -x "$target/scripts/daily-driver-operator.sh" ]]; then
  "$target/scripts/daily-driver-operator.sh" || log "Daily-driver render failed (Task 7 may not be merged yet)."
fi

# --- 10. Open the daily brief in the browser ---
open "$target/.last-brief.html" 2>/dev/null || open "https://allinonemanagementsolutions.net"

log "Done. You are ready to start working."
log "If anything broke: text Taha what's on screen, and click Help on the brief."
```

Make executable:
```bash
chmod +x roles/operator/install-mac.sh
```

- [ ] **Step 3: Validate shell syntax.**

```bash
bash -n roles/operator/install-mac.sh
shellcheck roles/operator/install-mac.sh
```

Expected: clean exit. Fix any shellcheck warnings (especially SC2086 unquoted vars).

- [ ] **Step 4: Commit, push, PR.**

```bash
git add roles/operator/
git commit -m "feat(operator): install-mac.sh — installs Homebrew, Tailscale, Brave, clones kit, drops desktop shortcuts, loads launchd auto-pull"
git push -u origin feat/task-5-operator-mac
gh pr create --title "Task 5: operator install-mac" --body "Mac operator installer: Tailscale + Brave + 4 desktop shortcuts + kit clone + launchd hook."
```

---

### Task 6: `roles/operator/install-win.ps1`

**Files:**
- Create: `~/projects/aixmos-kit/roles/operator/install-win.ps1`

Mirrors Task 5 but for Windows. Uses `winget` for installs, `.url` files for shortcuts (no `.webloc` support), Task Scheduler for auto-pull (Task 10 owns the actual scheduling).

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-6-operator-win
```

- [ ] **Step 2: Write `roles/operator/install-win.ps1`.**

```powershell
$ErrorActionPreference = 'Stop'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$KitRoot = Resolve-Path "$Here\..\.."
$Role = 'operator'

function Log($msg) { Write-Host "[operator/win] $msg" }
function Die($msg) { Write-Host "[operator/win] ERROR: $msg" -ForegroundColor Red; exit 1 }

# --- 1. Verify Windows ---
if ($PSVersionTable.Platform -and $PSVersionTable.Platform -ne 'Win32NT') { Die "Not Windows" }

# --- 2. Confirm winget available ---
try { winget --version | Out-Null } catch { Die "winget not available - install App Installer from Microsoft Store first" }

# --- 3. Install packages per manifest/packages.json ---
$packages = Get-Content "$KitRoot\manifest\packages.json" | ConvertFrom-Json
foreach ($id in $packages.windows.operator.wingetIds) {
  Log "winget install $id"
  winget install --id $id --silent --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
}

# --- 4. Tailscale: open it once for sign-in ---
$tsExe = Join-Path ${env:ProgramFiles} "Tailscale IPN\tailscale-ipn.exe"
if (-not (Test-Path $tsExe)) {
  $tsExe = Join-Path ${env:ProgramFiles(x86)} "Tailscale IPN\tailscale-ipn.exe"
}
if (Test-Path $tsExe) {
  Log "Open Tailscale to sign in (you should see the invitation email)."
  Start-Process $tsExe
} else {
  Log "Tailscale install may have failed; install manually from tailscale.com."
}

# --- 5. Clone aixmos-kit to %USERPROFILE%\aixmos-kit ---
$target = Join-Path $env:USERPROFILE "aixmos-kit"
if (-not (Test-Path "$target\.git")) {
  Log "Cloning AIXMOS537/aixmos-kit to $target..."
  git clone https://github.com/AIXMOS537/aixmos-kit.git "$target"
}

# --- 6. Write kit-id ---
$kitIdFile = Join-Path $target "kit-id.txt"
if (-not (Test-Path $kitIdFile) -or (Get-Item $kitIdFile).Length -eq 0) {
  [guid]::NewGuid().ToString() | Out-File -Encoding ascii -FilePath $kitIdFile
}

# --- 7. Install desktop shortcuts (.url format on Windows) ---
$Desktop = [Environment]::GetFolderPath('Desktop')
$shortcuts = @(
  @{ Name = 'TMMT Admin';    Url = 'https://allinonemanagementsolutions.net' },
  @{ Name = 'CHUMMO Chat';   Url = 'https://brainiac-7:3000' },
  @{ Name = 'Update Now';    Url = "file:///$($target -replace '\\','/')/scripts/auto-pull.ps1" },
  @{ Name = 'Daily Brief';   Url = "file:///$($target -replace '\\','/')/.last-brief.html" }
)
foreach ($s in $shortcuts) {
  $path = Join-Path $Desktop "$($s.Name).url"
  @"
[InternetShortcut]
URL=$($s.Url)
"@ | Set-Content -Encoding ascii -Path $path
}

# --- 8. Register Task Scheduler entry (Task 10 owns the XML; skip if not yet present) ---
$xmlTmpl = Join-Path $target "system\task-scheduler\aixmos-auto-pull.xml.tmpl"
if (Test-Path $xmlTmpl) {
  $xml = (Get-Content -Raw $xmlTmpl).Replace('__HOME__', $env:USERPROFILE).Replace('__KIT__', $target)
  $tmp = New-TemporaryFile
  Set-Content -Path $tmp -Value $xml
  schtasks /Create /TN "AIXMOS Auto Pull" /XML $tmp /F | Out-Null
  Remove-Item $tmp
  Log "Registered Task Scheduler entry for auto-pull."
} else {
  Log "Task Scheduler template not present yet; will register on next push after Task 10 merges."
}

# --- 9. Render daily brief once and open ---
$brief = Join-Path $target ".last-brief.html"
$driver = Join-Path $target "scripts\daily-driver-operator.ps1"
if (Test-Path $driver) { & powershell -NoProfile -File $driver }
if (Test-Path $brief) { Start-Process $brief } else { Start-Process 'https://allinonemanagementsolutions.net' }

Log "Done. You are ready to start working."
Log "If anything broke: text Taha what's on screen, and click Help on the brief."
```

- [ ] **Step 3: Lint PowerShell locally if possible.**

```bash
if command -v pwsh >/dev/null 2>&1; then
  pwsh -NoProfile -Command "Invoke-ScriptAnalyzer -Path roles/operator/install-win.ps1 -Severity Error"
fi
```

Expected: no errors. Warnings OK.

- [ ] **Step 4: Commit, push, PR.**

```bash
git add roles/operator/install-win.ps1
git commit -m "feat(operator): install-win.ps1 — installs Tailscale + Brave via winget, clones kit, drops desktop .url shortcuts, registers Task Scheduler auto-pull"
git push -u origin feat/task-6-operator-win
gh pr create --title "Task 6: operator install-win" --body "Windows operator installer mirroring Task 5."
```

---

### Task 7: `scripts/daily-driver-operator.sh` (Mac brief renderer)

**Files:**
- Create: `~/projects/aixmos-kit/scripts/daily-driver-operator.sh`

Generates `~/aixmos-kit/.last-brief.html` from live Supabase + GHL + ClickUp data. Operator opens this HTML in browser.

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-7-daily-driver-mac
```

- [ ] **Step 2: Write `scripts/daily-driver-operator.sh`.**

This script REQUIRES per-operator credentials (read-only Supabase anon key, scoped). Per the spec, operators authenticate via TMMT login — we'll pull data using their session cookies, NOT raw API keys.

For v1, the brief uses operator's TMMT session via a small companion endpoint we add to the TMMT app in a separate plan. For NOW, the script renders a STATIC brief with hardcoded sections + instructs the operator to click through to TMMT for live data.

```bash
#!/usr/bin/env bash
# Render the operator's daily brief to ~/aixmos-kit/.last-brief.html
# v1: static brief with link-throughs. v2 (separate plan): live Supabase queries
# via the operator's authenticated TMMT session.
set -euo pipefail
KIT_ROOT="${KIT_ROOT:-$HOME/aixmos-kit}"
out="$KIT_ROOT/.last-brief.html"
today="$(date +%Y-%m-%d)"
operator_name="${OPERATOR_NAME:-Operator}"

mkdir -p "$KIT_ROOT"
cat > "$out" <<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Daily Brief — $today</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 720px; margin: 24px auto; padding: 0 16px; color: #1a1a1a; }
h1 { font-size: 22px; margin-bottom: 4px; }
.date { color: #666; margin-bottom: 24px; }
.section { background: #f5f5f7; border-radius: 8px; padding: 16px; margin: 12px 0; }
.section h2 { margin: 0 0 8px 0; font-size: 16px; }
.section p { margin: 0; color: #444; }
.actions { display: flex; gap: 12px; flex-wrap: wrap; margin: 24px 0; }
.actions a { background: #0070f3; color: white; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: 600; }
.actions a.secondary { background: #6b7280; }
.help { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 14px; color: #666; }
</style>
</head>
<body>
<h1>GOOD MORNING, $operator_name</h1>
<div class="date">$today</div>

<div class="section">
  <h2>🔥 Hot leads — open TMMT to see live</h2>
  <p>Leads stuck &gt;24h in your pipeline. Work these first.</p>
</div>

<div class="section">
  <h2>📞 Today's follow-ups</h2>
  <p>Per GHL stage, customers expecting outreach today.</p>
</div>

<div class="section">
  <h2>💳 AIXMOS membership candidates</h2>
  <p>Customers with completed rentals + tag <code>ready-for-aixmos</code>. Pitch the \$97 membership today.</p>
</div>

<div class="section">
  <h2>⚠ Overdue payments</h2>
  <p>Open in TMMT → Payments for the live list.</p>
</div>

<div class="actions">
  <a href="https://allinonemanagementsolutions.net">Open TMMT Admin</a>
  <a href="https://brainiac-7:3000" class="secondary">Open CHUMMO Chat</a>
  <a href="file://$KIT_ROOT/scripts/auto-pull.sh" class="secondary">Update Now</a>
</div>

<div class="help">
  <strong>Need help?</strong> Text Taha what's on this page and the error from your terminal.<br>
  Brief regenerated: $(date "+%Y-%m-%d %H:%M:%S")
</div>
</body>
</html>
HTML

echo "Brief written: $out"
```

Make executable:
```bash
chmod +x scripts/daily-driver-operator.sh
```

- [ ] **Step 3: Test render locally.**

```bash
KIT_ROOT=/tmp/opk-test OPERATOR_NAME=TestOp ./scripts/daily-driver-operator.sh
test -s /tmp/opk-test/.last-brief.html && echo OK || (echo FAIL && exit 1)
grep -q "TestOp" /tmp/opk-test/.last-brief.html && echo "Name interpolated" || (echo "MISS" && exit 1)
rm -rf /tmp/opk-test
```

Expected: prints `OK` and `Name interpolated`.

- [ ] **Step 4: Validate shell syntax.**

```bash
bash -n scripts/daily-driver-operator.sh
shellcheck scripts/daily-driver-operator.sh
```

- [ ] **Step 5: Commit, push, PR.**

```bash
git add scripts/daily-driver-operator.sh
git commit -m "feat(operator): daily-driver-operator.sh renders ~/aixmos-kit/.last-brief.html (v1 static; v2 to query live Supabase via TMMT session)"
git push -u origin feat/task-7-daily-driver-mac
gh pr create --title "Task 7: operator daily brief (Mac)" --body "Renders HTML brief with 4 sections + 3 action buttons. v1 is static link-through; v2 (separate plan) wires live data."
```

---

### Task 8: `scripts/daily-driver-operator.ps1` (Windows brief renderer)

**Files:**
- Create: `~/projects/aixmos-kit/scripts/daily-driver-operator.ps1`

Mirror of Task 7 for Windows.

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-8-daily-driver-win
```

- [ ] **Step 2: Write `scripts/daily-driver-operator.ps1`.**

```powershell
$ErrorActionPreference = 'Stop'
$KitRoot = if ($env:KIT_ROOT) { $env:KIT_ROOT } else { Join-Path $env:USERPROFILE "aixmos-kit" }
$out = Join-Path $KitRoot ".last-brief.html"
$today = Get-Date -Format 'yyyy-MM-dd'
$operatorName = if ($env:OPERATOR_NAME) { $env:OPERATOR_NAME } else { 'Operator' }
$now = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

if (-not (Test-Path $KitRoot)) { New-Item -ItemType Directory -Path $KitRoot | Out-Null }

$html = @"
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Daily Brief - $today</title>
<style>
body { font-family: Segoe UI, sans-serif; max-width: 720px; margin: 24px auto; padding: 0 16px; color: #1a1a1a; }
h1 { font-size: 22px; margin-bottom: 4px; }
.date { color: #666; margin-bottom: 24px; }
.section { background: #f5f5f7; border-radius: 8px; padding: 16px; margin: 12px 0; }
.section h2 { margin: 0 0 8px 0; font-size: 16px; }
.section p { margin: 0; color: #444; }
.actions { display: flex; gap: 12px; flex-wrap: wrap; margin: 24px 0; }
.actions a { background: #0070f3; color: white; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: 600; }
.actions a.secondary { background: #6b7280; }
.help { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 14px; color: #666; }
</style>
</head>
<body>
<h1>GOOD MORNING, $operatorName</h1>
<div class="date">$today</div>

<div class="section">
  <h2>Hot leads - open TMMT to see live</h2>
  <p>Leads stuck &gt;24h in your pipeline. Work these first.</p>
</div>

<div class="section">
  <h2>Today's follow-ups</h2>
  <p>Per GHL stage, customers expecting outreach today.</p>
</div>

<div class="section">
  <h2>AIXMOS membership candidates</h2>
  <p>Customers with completed rentals + tag ready-for-aixmos. Pitch the `$97 membership today.</p>
</div>

<div class="section">
  <h2>Overdue payments</h2>
  <p>Open in TMMT > Payments for the live list.</p>
</div>

<div class="actions">
  <a href="https://allinonemanagementsolutions.net">Open TMMT Admin</a>
  <a href="https://brainiac-7:3000" class="secondary">Open CHUMMO Chat</a>
  <a href="file:///$($KitRoot.Replace('\','/'))/scripts/auto-pull.ps1" class="secondary">Update Now</a>
</div>

<div class="help">
  <strong>Need help?</strong> Text Taha what's on this page and the error from your terminal.<br>
  Brief regenerated: $now
</div>
</body>
</html>
"@

Set-Content -Path $out -Value $html -Encoding utf8
Write-Host "Brief written: $out"
```

- [ ] **Step 3: Test render locally if pwsh available.**

```bash
if command -v pwsh >/dev/null 2>&1; then
  KIT_ROOT=/tmp/opk-test-win OPERATOR_NAME=TestOp pwsh -NoProfile -File scripts/daily-driver-operator.ps1
  test -s /tmp/opk-test-win/.last-brief.html && echo OK || (echo FAIL && exit 1)
  rm -rf /tmp/opk-test-win
fi
```

Expected: prints `OK`.

- [ ] **Step 4: Commit, push, PR.**

```bash
git add scripts/daily-driver-operator.ps1
git commit -m "feat(operator): daily-driver-operator.ps1 (Windows equivalent of Task 7)"
git push -u origin feat/task-8-daily-driver-win
gh pr create --title "Task 8: operator daily brief (Windows)" --body "Windows mirror of Task 7."
```

---

## Phase 3: Auto-Pull (Tasks 9-11)

### Task 9: `scripts/auto-pull.sh` + macOS launchd plist template

**Files:**
- Create: `~/projects/aixmos-kit/scripts/auto-pull.sh`
- Create: `~/projects/aixmos-kit/system/launchd/com.aixmos.auto-pull.plist.tmpl`

After this task, every Mac with the kit installed pulls `aixmos-kit/main` on login and every 30 minutes, and re-renders the operator brief if applicable.

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-9-autopull-mac
mkdir -p system/launchd
```

- [ ] **Step 2: Write `scripts/auto-pull.sh`.**

```bash
#!/usr/bin/env bash
# Auto-pull aixmos-kit from GitHub. Also pulls any production repos
# the local role declares as "required" in manifest/repos.json (owner roles).
# Idempotent. Silent-fail on offline. Logs to ~/aixmos-kit/.last-pull.log.
set -uo pipefail
KIT_ROOT="${KIT_ROOT:-$HOME/aixmos-kit}"
LOG="$KIT_ROOT/.last-pull.log"
TS="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

log() { echo "[$TS] $*" | tee -a "$LOG"; }

cd "$KIT_ROOT" 2>/dev/null || { log "kit not present at $KIT_ROOT"; exit 0; }

# --- 1. Check connectivity (silent-fail offline) ---
if ! curl -fsSI https://github.com >/dev/null 2>&1; then
  log "offline; skipping"
  exit 0
fi

# --- 2. Check revocation ---
kit_id="$(cat "$KIT_ROOT/kit-id.txt" 2>/dev/null || true)"
if [[ -n "$kit_id" ]]; then
  # Fetch latest revoked-kits.txt without merging
  if curl -fsSL "https://raw.githubusercontent.com/AIXMOS537/aixmos-kit/main/revoked-kits.txt" -o /tmp/revoked-kits.txt 2>/dev/null; then
    if grep -qFx "$kit_id" /tmp/revoked-kits.txt; then
      log "kit-id $kit_id is REVOKED — aborting. Contact owner."
      osascript -e "display notification \"This kit is revoked. Contact Taha.\" with title \"AIXMOS Auto-Pull\"" 2>/dev/null || true
      exit 1
    fi
  fi
fi

# --- 3. Pull aixmos-kit itself ---
log "pulling aixmos-kit main..."
if git pull --ff-only origin main 2>&1 | tee -a "$LOG"; then
  log "aixmos-kit pulled."
else
  log "aixmos-kit pull failed (non-fatal)."
fi

# --- 4. If role file exists, pull required production repos for owner roles ---
role_file="$KIT_ROOT/.role"
if [[ -f "$role_file" ]]; then
  role="$(cat "$role_file")"
  case "$role" in
    owner-work|owner-brain|owner-carry)
      jq -r ".roles[\"$role\"].required[] | select(.repo != \"aixmos-kit\") | \"\\(.targetPath)|\\(.branch)\"" \
        "$KIT_ROOT/manifest/repos.json" | while IFS='|' read -r path branch; do
          expanded="${path/#\~/$HOME}"
          if [[ -d "$expanded/.git" ]]; then
            log "pulling $expanded ($branch)..."
            (cd "$expanded" && git pull --ff-only origin "$branch" 2>&1 | tee -a "$LOG") || log "  pull failed (non-fatal)"
          fi
        done
      ;;
  esac

  # If operator role, re-render daily brief
  if [[ "$role" == "operator" ]]; then
    log "re-rendering operator daily brief..."
    "$KIT_ROOT/scripts/daily-driver-operator.sh" 2>&1 | tee -a "$LOG" || log "  render failed"
  fi
fi

# --- 5. Rotate log if >1MB ---
if [[ -f "$LOG" ]] && [[ $(wc -c < "$LOG") -gt 1048576 ]]; then
  mv "$LOG" "${LOG}.1"
  : > "$LOG"
fi

log "done"
```

Make executable:
```bash
chmod +x scripts/auto-pull.sh
```

- [ ] **Step 3: Write `system/launchd/com.aixmos.auto-pull.plist.tmpl`.**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.aixmos.auto-pull</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>__KIT__/scripts/auto-pull.sh</string>
  </array>

  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>__HOME__</string>
    <key>KIT_ROOT</key>
    <string>__KIT__</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>StartInterval</key>
  <integer>1800</integer>

  <key>StandardOutPath</key>
  <string>__KIT__/.last-pull.stdout.log</string>

  <key>StandardErrorPath</key>
  <string>__KIT__/.last-pull.stderr.log</string>
</dict>
</plist>
```

`__KIT__` and `__HOME__` are substituted by the installer.

- [ ] **Step 4: Update operator install-mac.sh to also write `.role` file.**

Modify `roles/operator/install-mac.sh` — after step 6 (write kit-id), add:

```bash
echo "operator" > "$target/.role"
```

Apply the edit:
```bash
sed -i.bak '/echo "operator" > /d; /printf .*kit-id/a\
echo "operator" > "$target/.role"
' roles/operator/install-mac.sh && rm roles/operator/install-mac.sh.bak
```

(If `sed` portability is a problem on the agent's Mac, the agent can just open the file in an editor and add the line manually.)

- [ ] **Step 5: Validate shell + XML.**

```bash
bash -n scripts/auto-pull.sh
shellcheck scripts/auto-pull.sh
xmllint --noout system/launchd/com.aixmos.auto-pull.plist.tmpl
```

Expected: all silent.

- [ ] **Step 6: Test the template substitution.**

```bash
HOME_X="/tmp/opk-h"
KIT_X="/tmp/opk-h/aixmos-kit"
mkdir -p "$KIT_X"
sed "s|__HOME__|$HOME_X|g; s|__KIT__|$KIT_X|g" system/launchd/com.aixmos.auto-pull.plist.tmpl > /tmp/test.plist
xmllint --noout /tmp/test.plist && echo OK || (echo FAIL && exit 1)
grep -q "$KIT_X/scripts/auto-pull.sh" /tmp/test.plist && echo "Path substituted" || (echo MISS && exit 1)
rm -rf /tmp/opk-h /tmp/test.plist
```

Expected: `OK` then `Path substituted`.

- [ ] **Step 7: Commit, push, PR.**

```bash
git add scripts/auto-pull.sh system/launchd/ roles/operator/install-mac.sh
git commit -m "feat: auto-pull.sh + launchd plist template (login + every 30m) + write .role file in operator install"
git push -u origin feat/task-9-autopull-mac
gh pr create --title "Task 9: auto-pull (Mac)" --body "Auto-pull script + launchd plist template + .role file population."
```

---

### Task 10: `scripts/auto-pull.ps1` + Windows Task Scheduler XML template

**Files:**
- Create: `~/projects/aixmos-kit/scripts/auto-pull.ps1`
- Create: `~/projects/aixmos-kit/system/task-scheduler/aixmos-auto-pull.xml.tmpl`

Windows equivalent of Task 9.

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-10-autopull-win
mkdir -p system/task-scheduler
```

- [ ] **Step 2: Write `scripts/auto-pull.ps1`.**

```powershell
$ErrorActionPreference = 'Continue'
$KitRoot = if ($env:KIT_ROOT) { $env:KIT_ROOT } else { Join-Path $env:USERPROFILE "aixmos-kit" }
$Log = Join-Path $KitRoot ".last-pull.log"
$Ts = (Get-Date -AsUTC).ToString("yyyy-MM-ddTHH:mm:ssZ")

function Log($msg) { "$Ts $msg" | Tee-Object -FilePath $Log -Append }

if (-not (Test-Path $KitRoot)) { Log "kit not present at $KitRoot"; exit 0 }
Set-Location $KitRoot

# --- 1. Connectivity check ---
try { Invoke-WebRequest -Uri "https://github.com" -Method Head -TimeoutSec 5 -UseBasicParsing | Out-Null }
catch { Log "offline; skipping"; exit 0 }

# --- 2. Revocation check ---
$kitId = if (Test-Path "$KitRoot\kit-id.txt") { (Get-Content "$KitRoot\kit-id.txt" -Raw).Trim() } else { '' }
if ($kitId) {
  try {
    $revoked = (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/AIXMOS537/aixmos-kit/main/revoked-kits.txt" -UseBasicParsing).Content -split "`n" | ForEach-Object { $_.Trim() }
    if ($revoked -contains $kitId) {
      Log "kit-id $kitId is REVOKED - aborting. Contact owner."
      try { New-BurntToastNotification -Text "AIXMOS Auto-Pull", "This kit is revoked. Contact Taha." } catch {}
      exit 1
    }
  } catch { Log "revocation check skipped (offline?)" }
}

# --- 3. Pull aixmos-kit ---
Log "pulling aixmos-kit main..."
git pull --ff-only origin main 2>&1 | Tee-Object -FilePath $Log -Append

# --- 4. Owner role: pull required production repos ---
$roleFile = Join-Path $KitRoot ".role"
if (Test-Path $roleFile) {
  $role = (Get-Content $roleFile -Raw).Trim()
  if ($role -in @('owner-brain','owner-work','owner-carry')) {
    $manifest = Get-Content "$KitRoot\manifest\repos.json" -Raw | ConvertFrom-Json
    foreach ($r in $manifest.roles.$role.required) {
      if ($r.repo -eq 'aixmos-kit') { continue }
      $path = $r.targetPath -replace '%USERPROFILE%', $env:USERPROFILE -replace '~', $env:USERPROFILE
      if (Test-Path "$path\.git") {
        Log "pulling $path ($($r.branch))..."
        Push-Location $path
        git pull --ff-only origin $r.branch 2>&1 | Tee-Object -FilePath $Log -Append
        Pop-Location
      }
    }
  }
  if ($role -eq 'operator') {
    Log "re-rendering operator daily brief..."
    & powershell -NoProfile -File "$KitRoot\scripts\daily-driver-operator.ps1"
  }
}

# --- 5. Rotate log if >1MB ---
if ((Test-Path $Log) -and ((Get-Item $Log).Length -gt 1MB)) {
  Move-Item $Log "$Log.1" -Force
  '' | Set-Content $Log
}

Log "done"
```

- [ ] **Step 3: Write `system/task-scheduler/aixmos-auto-pull.xml.tmpl`.**

```xml
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>AIXMOS auto-pull from GitHub on login + every 30 min</Description>
    <Author>AIXMOS</Author>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
    <CalendarTrigger>
      <StartBoundary>2026-01-01T00:00:00</StartBoundary>
      <Enabled>true</Enabled>
      <Repetition>
        <Interval>PT30M</Interval>
      </Repetition>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <RunLevel>LeastPrivilege</RunLevel>
      <UserId>S-1-5-32-545</UserId>
    </Principal>
  </Principals>
  <Settings>
    <StartWhenAvailable>true</StartWhenAvailable>
    <AllowHardTerminate>true</AllowHardTerminate>
    <ExecutionTimeLimit>PT10M</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>-NoProfile -ExecutionPolicy Bypass -File "__KIT__\scripts\auto-pull.ps1"</Arguments>
      <WorkingDirectory>__KIT__</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
```

- [ ] **Step 4: Update operator install-win.ps1 to write `.role`.**

After step 6 (kit-id), add:

```powershell
Set-Content -Path (Join-Path $target ".role") -Value "operator" -Encoding ascii
```

- [ ] **Step 5: Validate.**

```bash
if command -v pwsh >/dev/null 2>&1; then
  pwsh -NoProfile -Command "Invoke-ScriptAnalyzer -Path scripts/auto-pull.ps1 -Severity Error"
fi
xmllint --noout system/task-scheduler/aixmos-auto-pull.xml.tmpl
```

Expected: silent.

- [ ] **Step 6: Commit, push, PR.**

```bash
git add scripts/auto-pull.ps1 system/task-scheduler/ roles/operator/install-win.ps1
git commit -m "feat: auto-pull.ps1 + Task Scheduler XML template + .role population in operator install"
git push -u origin feat/task-10-autopull-win
gh pr create --title "Task 10: auto-pull (Windows)" --body "Windows equivalent of Task 9."
```

---

### Task 11: `revoked-kits.txt` + `scripts/revoke-kit.sh` placeholder

**Files:**
- Create: `~/projects/aixmos-kit/revoked-kits.txt`

`revoke-kit.sh` itself is built in Task 17 alongside `build-master-usb.sh`; here we just seed the empty file so `auto-pull.sh` doesn't 404 on its raw fetch before any kits are revoked.

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-11-revoked-seed
```

- [ ] **Step 2: Write `revoked-kits.txt`.**

```
# Revoked OPK kit UUIDs (one per line). Lines starting with # are ignored.
# A kit listed here will refuse to auto-pull and show a "contact owner" message.
# Use scripts/revoke-kit.sh to add entries (Task 17).
```

- [ ] **Step 3: Commit, push, PR.**

```bash
git add revoked-kits.txt
git commit -m "feat: seed revoked-kits.txt so auto-pull fetch returns 200 from day one"
git push -u origin feat/task-11-revoked-seed
gh pr create --title "Task 11: revoked-kits.txt seed" --body "Empty revoked-kits.txt so auto-pull does not 404."
```

---

## Phase 4: Owner Roles (Tasks 12-15)

### Task 12: `roles/owner-carry/install-mac.sh`

**Files:**
- Create: `~/projects/aixmos-kit/roles/owner-carry/install-mac.sh`
- Create: `~/projects/aixmos-kit/roles/owner-carry/shortcuts/.gitkeep`

Minimal owner install — git + gh + Brave + Claude Code + clones `aixmos-kit` and `ai-command-center` only. Offers full stack opt-in.

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-12-owner-carry
mkdir -p roles/owner-carry/shortcuts
touch roles/owner-carry/shortcuts/.gitkeep
```

- [ ] **Step 2: Write `roles/owner-carry/install-mac.sh`.**

```bash
#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIT_ROOT="$(cd "$HERE/../.." && pwd)"
ROLE="owner-carry"

log() { echo "[owner-carry/mac] $*"; }
die() { echo "[owner-carry/mac] ERROR: $*" >&2; exit 1; }

[[ "$(uname -s)" == "Darwin" ]] || die "Not macOS"

# --- 1. Homebrew ---
if ! command -v brew >/dev/null 2>&1; then
  log "Installing Homebrew..."
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  [[ -x /opt/homebrew/bin/brew ]] && eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# --- 2. Packages from manifest ---
formulas=$(jq -r '.macos."owner-carry".brewFormulas[]' "$KIT_ROOT/manifest/packages.json")
casks=$(jq -r '.macos."owner-carry".brewCasks[]' "$KIT_ROOT/manifest/packages.json")
for f in $formulas; do log "brew install $f"; brew install "$f" || true; done
for c in $casks;    do log "brew install --cask $c"; brew install --cask "$c" || true; done

# --- 3. gh auth ---
if ! gh auth status >/dev/null 2>&1; then
  log "Run: gh auth login (interactive). After that, this script will continue if you re-run it."
  exit 0
fi

# --- 4. Tailscale ---
if [[ ! -d /Applications/Tailscale.app ]]; then brew install --cask tailscale || true; fi
open -a Tailscale || true

# --- 5. Make ~/projects/ and clone required repos ---
mkdir -p "$HOME/projects"
target_kit="$HOME/projects/aixmos-kit"
[[ -d "$target_kit/.git" ]] || gh repo clone AIXMOS537/aixmos-kit "$target_kit"
target_acc="$HOME/projects/ai-command-center"
[[ -d "$target_acc/.git" ]] || gh repo clone AIXMOS537/ai-command-center "$target_acc"

# --- 6. .role file ---
echo "owner-carry" > "$target_kit/.role"

# --- 7. kit-id ---
[[ -s "$target_kit/kit-id.txt" ]] || printf '%s\n' "$(uuidgen)" > "$target_kit/kit-id.txt"

# --- 8. Backward-compat symlinks at home ---
ln -sfn "$target_kit" "$HOME/aixmos-kit"
ln -sfn "$target_acc" "$HOME/ai-command-center"

# --- 9. Install launchd plist for auto-pull ---
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_AGENTS"
plist_tmpl="$target_kit/system/launchd/com.aixmos.auto-pull.plist.tmpl"
if [[ -f "$plist_tmpl" ]]; then
  sed "s|__HOME__|$HOME|g; s|__KIT__|$target_kit|g" "$plist_tmpl" > "$LAUNCH_AGENTS/com.aixmos.auto-pull.plist"
  launchctl unload "$LAUNCH_AGENTS/com.aixmos.auto-pull.plist" 2>/dev/null || true
  launchctl load   "$LAUNCH_AGENTS/com.aixmos.auto-pull.plist"
fi

# --- 10. Offer full stack opt-in ---
read -r -p "Want the full owner-work stack (all 5 repos + Node + Ollama + Vercel CLI)? [y/N]: " yn
if [[ "$yn" =~ ^[Yy]$ ]]; then
  exec /bin/bash "$KIT_ROOT/roles/owner-work/install-mac.sh"
fi

log "owner-carry install complete. Minimal stack ready."
log "Open Tailscale, sign in. Then run scripts/owner-brief.sh for your morning brief."
```

Make executable + commit + push + PR (same pattern as prior tasks):

```bash
chmod +x roles/owner-carry/install-mac.sh
bash -n roles/owner-carry/install-mac.sh
shellcheck roles/owner-carry/install-mac.sh
git add roles/owner-carry/
git commit -m "feat(owner-carry): install-mac.sh — minimal owner kit on M5 Pro carry"
git push -u origin feat/task-12-owner-carry
gh pr create --title "Task 12: owner-carry install-mac" --body "Minimal owner install with opt-in full stack."
```

---

### Task 13: `roles/owner-work/install-mac.sh`

**Files:**
- Create: `~/projects/aixmos-kit/roles/owner-work/install-mac.sh`
- Create: `~/projects/aixmos-kit/roles/owner-work/shortcuts/.gitkeep`

Full dev stack — clones all 5 production repos, installs Node + Ollama + Vercel CLI + Supabase CLI + Playwright + Claude Code. Restores TMMT `.env` from a known backup path if present.

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-13-owner-work
mkdir -p roles/owner-work/shortcuts
touch roles/owner-work/shortcuts/.gitkeep
```

- [ ] **Step 2: Write `roles/owner-work/install-mac.sh`.**

```bash
#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIT_ROOT="$(cd "$HERE/../.." && pwd)"
ROLE="owner-work"

log() { echo "[owner-work/mac] $*"; }
die() { echo "[owner-work/mac] ERROR: $*" >&2; exit 1; }

[[ "$(uname -s)" == "Darwin" ]] || die "Not macOS"

# --- 1. Homebrew + packages ---
if ! command -v brew >/dev/null 2>&1; then
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  [[ -x /opt/homebrew/bin/brew ]] && eval "$(/opt/homebrew/bin/brew shellenv)"
fi
formulas=$(jq -r '.macos."owner-work".brewFormulas[]' "$KIT_ROOT/manifest/packages.json")
casks=$(jq -r '.macos."owner-work".brewCasks[]' "$KIT_ROOT/manifest/packages.json")
for f in $formulas; do log "brew install $f"; brew install "$f" || true; done
for c in $casks;    do log "brew install --cask $c"; brew install --cask "$c" || true; done

# --- 2. Vercel + Supabase CLIs (not in Homebrew core) ---
npm install -g vercel supabase || log "npm globals failed (PATH issue?). Re-run after sourcing shell."

# --- 3. Playwright browsers ---
npx --yes playwright install chromium webkit firefox || true

# --- 4. Ollama model ---
ollama_model=$(jq -r '.macos."owner-work".ollamaModels[0]' "$KIT_ROOT/manifest/packages.json")
if [[ -n "$ollama_model" && "$ollama_model" != "null" ]]; then
  ollama pull "$ollama_model" || true
fi

# --- 5. gh auth gate ---
if ! gh auth status >/dev/null 2>&1; then
  log "Run: gh auth login. Then re-run this installer."
  exit 0
fi

# --- 6. Clone all required repos to ~/projects/ ---
mkdir -p "$HOME/projects"
jq -r '.roles."owner-work".required[] | "\(.repo)|\(.branch)|\(.targetPath)"' "$KIT_ROOT/manifest/repos.json" | \
  while IFS='|' read -r repo branch target; do
    expanded="${target/#\~/$HOME}"
    if [[ ! -d "$expanded/.git" ]]; then
      log "cloning $repo → $expanded"
      gh repo clone "AIXMOS537/$repo" "$expanded" -- --branch "$branch" || gh repo clone "AIXMOS537/$repo" "$expanded"
    else
      log "$repo already cloned"
    fi
    # Backward-compat symlink for legacy ~/X paths
    base="$(basename "$expanded")"
    ln -sfn "$expanded" "$HOME/$base"
  done

# --- 7. TMMT .env restore from backup if missing ---
tmmt_env="$HOME/projects/TMMT/.env.local"
backup_env="$HOME/AIXMOS_CLEAN_START_BACKUP_2026-05-26/TMMT-working-folder-moved-aside/.env.local"
if [[ ! -f "$tmmt_env" && -f "$backup_env" ]]; then
  log "Restoring TMMT .env files from clean-start backup..."
  cp -p "$HOME/AIXMOS_CLEAN_START_BACKUP_2026-05-26/TMMT-working-folder-moved-aside/.env" "$HOME/projects/TMMT/.env"
  cp -p "$backup_env" "$tmmt_env"
  cp -p "$HOME/AIXMOS_CLEAN_START_BACKUP_2026-05-26/TMMT-working-folder-moved-aside/.env.vercel.production" "$HOME/projects/TMMT/.env.vercel.production" || true
fi

# --- 8. .role + kit-id ---
echo "owner-work" > "$HOME/projects/aixmos-kit/.role"
[[ -s "$HOME/projects/aixmos-kit/kit-id.txt" ]] || printf '%s\n' "$(uuidgen)" > "$HOME/projects/aixmos-kit/kit-id.txt"

# --- 9. Launchd auto-pull ---
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_AGENTS"
plist_tmpl="$HOME/projects/aixmos-kit/system/launchd/com.aixmos.auto-pull.plist.tmpl"
if [[ -f "$plist_tmpl" ]]; then
  sed "s|__HOME__|$HOME|g; s|__KIT__|$HOME/projects/aixmos-kit|g" "$plist_tmpl" > "$LAUNCH_AGENTS/com.aixmos.auto-pull.plist"
  launchctl unload "$LAUNCH_AGENTS/com.aixmos.auto-pull.plist" 2>/dev/null || true
  launchctl load   "$LAUNCH_AGENTS/com.aixmos.auto-pull.plist"
fi

# --- 10. Smoke test TMMT ---
if [[ -d "$HOME/projects/TMMT" ]]; then
  log "Smoke-testing TMMT..."
  (cd "$HOME/projects/TMMT" && npm install --silent && npm run check-env && npm run build) 2>&1 | tail -20
fi

log "owner-work install complete. All 5 repos under ~/projects/, dev stack ready."
log "Run: cd ~/projects/TMMT && npm run dev"
```

Same finishing pattern: `chmod +x`, `bash -n`, `shellcheck`, commit, push, PR.

---

### Task 14: `scripts/owner-brief.sh`

**Files:**
- Create: `~/projects/aixmos-kit/scripts/owner-brief.sh`

Owner's morning brief — synthesizes data from `AIXMOS-AGENTS/briefing.js`, ClickUp today list, Brainiac 7 health endpoint.

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-14-owner-brief
```

- [ ] **Step 2: Write `scripts/owner-brief.sh`.**

```bash
#!/usr/bin/env bash
# Owner morning brief — synthesizes:
#   - Revenue + funnel counts (via AIXMOS-AGENTS briefing.js)
#   - Top-3 non-negotiables (manual today; ClickUp API in v2)
#   - Brainiac 7 health (curls :7777/healthz over Tailscale)
# Outputs to terminal + saves to ~/aixmos-kit/.last-brief.md.
set -uo pipefail
KIT_ROOT="${KIT_ROOT:-$HOME/aixmos-kit}"
AGENTS_DIR="${AGENTS_DIR:-$HOME/projects/AIXMOS-AGENTS}"
out="$KIT_ROOT/.last-brief.md"

date_str="$(date '+%A, %B %-d, %Y')"
sep="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

{
  echo "$sep"
  echo "AIXMOS OWNER BRIEF — $date_str"
  echo "$sep"
  echo
  echo "🌅 GOOD MORNING, MUHAMMAD."
  echo

  # --- 1. Brainiac 7 health ---
  echo "🛡️  BRAINIAC 7:"
  if curl -fsS --max-time 3 http://brainiac-7:7777/healthz >/dev/null 2>&1; then
    echo "   ONLINE — operators can draft with CHUMMO."
  else
    echo "   OFFLINE — wake via Wake-on-LAN (see docs/wake-on-lan.md)."
  fi
  echo

  # --- 2. AIXMOS-AGENTS briefing ---
  if [[ -f "$AGENTS_DIR/briefing.js" ]]; then
    echo "📊 PIPELINE SNAPSHOT:"
    (cd "$AGENTS_DIR" && node briefing.js 2>/dev/null | sed 's/^/   /') || echo "   (briefing failed)"
  else
    echo "📊 PIPELINE: AIXMOS-AGENTS/briefing.js not found at $AGENTS_DIR"
  fi
  echo

  # --- 3. Today's 3 non-negotiables placeholder ---
  echo "🎯 TODAY'S 3 NON-NEGOTIABLES:"
  echo "   1. [Fill in ClickUp 'Today' list]"
  echo "   2."
  echo "   3."
  echo

  echo "$sep"
  echo "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
} | tee "$out"
```

Make executable:
```bash
chmod +x scripts/owner-brief.sh
```

- [ ] **Step 3: Validate.**

```bash
bash -n scripts/owner-brief.sh
shellcheck scripts/owner-brief.sh
```

- [ ] **Step 4: Commit, push, PR.**

```bash
git add scripts/owner-brief.sh
git commit -m "feat(owner): owner-brief.sh — Brainiac 7 health + AIXMOS-AGENTS briefing + 3 non-negotiables placeholder"
git push -u origin feat/task-14-owner-brief
gh pr create --title "Task 14: owner-brief.sh" --body "Owner morning brief synthesizer."
```

---

### Task 15: `roles/owner-brain/install-win.ps1`

**Files:**
- Create: `~/projects/aixmos-kit/roles/owner-brain/install-win.ps1`
- Create: `~/projects/aixmos-kit/roles/owner-brain/shortcuts/.gitkeep`

Brainiac 7 install — delegates to `AI-OPS-STARTER\install-windows.ps1` for the Docker/Ollama/Open WebUI/n8n/Qdrant base, then layers the aixmos-kit auto-pull + AIXMOS-AGENTS Windows service + persona prompt registration.

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-15-owner-brain
mkdir -p roles/owner-brain/shortcuts
touch roles/owner-brain/shortcuts/.gitkeep
```

- [ ] **Step 2: Write `roles/owner-brain/install-win.ps1`.**

```powershell
$ErrorActionPreference = 'Stop'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$KitRoot = Resolve-Path "$Here\..\.."
$Role = 'owner-brain'

function Log($msg) { Write-Host "[owner-brain/win] $msg" }
function Die($msg) { Write-Host "[owner-brain/win] ERROR: $msg" -ForegroundColor Red; exit 1 }

# --- 1. Verify Windows ---
if ($PSVersionTable.Platform -and $PSVersionTable.Platform -ne 'Win32NT') { Die "Not Windows" }

# --- 2. winget packages ---
try { winget --version | Out-Null } catch { Die "winget required; install App Installer from Microsoft Store" }
$packages = Get-Content "$KitRoot\manifest\packages.json" -Raw | ConvertFrom-Json
foreach ($id in $packages.windows.'owner-brain'.wingetIds) {
  Log "winget install $id"
  winget install --id $id --silent --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
}

# --- 3. Make ~/projects/ and clone owner-brain repos ---
$projects = Join-Path $env:USERPROFILE "projects"
New-Item -ItemType Directory -Force -Path $projects | Out-Null
foreach ($r in $packages.PSObject.Properties.Name) {} # noop
$manifest = Get-Content "$KitRoot\manifest\repos.json" -Raw | ConvertFrom-Json
foreach ($r in $manifest.roles.'owner-brain'.required) {
  $expanded = $r.targetPath -replace '%USERPROFILE%', $env:USERPROFILE
  if (-not (Test-Path "$expanded\.git")) {
    Log "cloning $($r.repo) -> $expanded"
    gh repo clone "AIXMOS537/$($r.repo)" $expanded
  }
}

# --- 4. Delegate to AI-OPS-STARTER bootstrap ---
$starterBoot = Join-Path $projects "AI-OPS-STARTER\install-windows.ps1"
if (Test-Path $starterBoot) {
  Log "Delegating to AI-OPS-STARTER install-windows.ps1 (Docker/Ollama/Open WebUI/n8n/Qdrant)..."
  & powershell -NoProfile -ExecutionPolicy Bypass -File $starterBoot
} else {
  Log "AI-OPS-STARTER bootstrap not found at $starterBoot - check repo clone."
}

# --- 5. AIXMOS-AGENTS HTTP server as Windows Service via nssm ---
scoop install nssm 2>&1 | Out-Null
$agentsDir = Join-Path $projects "AIXMOS-AGENTS"
if (Test-Path "$agentsDir\agent-server.js") {
  nssm install AIXMOS-Agent-Host (Get-Command node).Source "$agentsDir\agent-server.js"
  nssm set AIXMOS-Agent-Host AppDirectory $agentsDir
  nssm set AIXMOS-Agent-Host Start SERVICE_AUTO_START
  nssm start AIXMOS-Agent-Host
  Log "AIXMOS-Agent-Host service registered + started."
}

# --- 6. .role + kit-id ---
$kit = Join-Path $projects "aixmos-kit"
Set-Content -Path (Join-Path $kit ".role") -Value "owner-brain" -Encoding ascii
$kitIdFile = Join-Path $kit "kit-id.txt"
if (-not (Test-Path $kitIdFile) -or (Get-Item $kitIdFile).Length -eq 0) {
  [guid]::NewGuid().ToString() | Out-File -Encoding ascii -FilePath $kitIdFile
}

# --- 7. Task Scheduler auto-pull ---
$xmlTmpl = Join-Path $kit "system\task-scheduler\aixmos-auto-pull.xml.tmpl"
if (Test-Path $xmlTmpl) {
  $xml = (Get-Content -Raw $xmlTmpl).Replace('__HOME__', $env:USERPROFILE).Replace('__KIT__', $kit)
  $tmp = New-TemporaryFile
  Set-Content -Path $tmp -Value $xml
  schtasks /Create /TN "AIXMOS Auto Pull" /XML $tmp /F | Out-Null
  Remove-Item $tmp
  Log "Registered Task Scheduler entry for auto-pull."
}

# --- 8. Health-check Open WebUI + agent server ---
Start-Sleep 5
Log "Health checks:"
foreach ($url in @('http://127.0.0.1:3000', 'http://127.0.0.1:7777/healthz', 'http://127.0.0.1:5678')) {
  try {
    Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 3 -UseBasicParsing | Out-Null
    Log "  OK   $url"
  } catch {
    Log "  WARN $url not responding (may need more startup time)"
  }
}

Log "owner-brain install complete. Open WebUI: http://brainiac-7:3000 (Tailscale)."
Log "Tailscale ACL: ensure tag:operator can reach :3000 but NOT :7777."
```

- [ ] **Step 3: Validate.**

```bash
if command -v pwsh >/dev/null 2>&1; then
  pwsh -NoProfile -Command "Invoke-ScriptAnalyzer -Path roles/owner-brain/install-win.ps1 -Severity Error"
fi
```

- [ ] **Step 4: Commit, push, PR.**

```bash
git add roles/owner-brain/
git commit -m "feat(owner-brain): install-win.ps1 — delegates to AI-OPS-STARTER, layers aixmos-kit auto-pull + AIXMOS-Agent-Host service"
git push -u origin feat/task-15-owner-brain
gh pr create --title "Task 15: owner-brain install-win" --body "Brainiac 7 installer."
```

---

## Phase 5: Distribution (Tasks 16-17)

### Task 16: `scripts/build-master-usb.sh`

**Files:**
- Create: `~/projects/aixmos-kit/scripts/build-master-usb.sh`

Owner runs this to produce a shippable USB. Verifies FAT32, copies kit, generates unique kit-id, writes MANIFEST.txt, ejects cleanly.

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-16-build-usb
```

- [ ] **Step 2: Write `scripts/build-master-usb.sh`.**

```bash
#!/usr/bin/env bash
# Build a shippable OPK USB. Usage: build-master-usb.sh /Volumes/AIXMOS-OPK
set -euo pipefail
KIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VOL="${1:-}"

die() { echo "ERROR: $*" >&2; exit 1; }
log() { echo "[build-usb] $*"; }

[[ -n "$VOL" ]] || die "Usage: $0 /Volumes/<USB-MOUNT-POINT>"
[[ -d "$VOL" ]] || die "Volume not mounted: $VOL"

# --- 1. Verify FAT32 ---
fs="$(diskutil info "$VOL" 2>/dev/null | awk -F: '/File System Personality/ {gsub(/^ +/, "", $2); print $2}')"
if [[ "$fs" != "MS-DOS FAT32" && "$fs" != "FAT32" ]]; then
  die "Volume is '$fs', not FAT32. Format with Disk Utility first."
fi

# --- 2. Copy kit contents (exclude .git, node_modules, build artifacts) ---
log "Copying kit to $VOL..."
rsync -a --delete \
  --exclude=.git --exclude=node_modules --exclude=.DS_Store \
  --exclude=.last-pull.log --exclude=.last-brief.html --exclude=.role --exclude=kit-id.txt \
  --exclude=tests/ --exclude=.github/ \
  "$KIT_ROOT/" "$VOL/"

# --- 3. Generate unique kit-id ---
kit_id="$(uuidgen)"
build_ts="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
git_sha="$(git -C "$KIT_ROOT" rev-parse HEAD)"

# --- 4. Write MANIFEST.txt ---
cat > "$VOL/MANIFEST.txt" <<EOF
AIXMOS Operator Portable Kit
============================
Kit ID:    $kit_id
Built:     $build_ts
Source:    AIXMOS537/aixmos-kit @ $git_sha

To begin:
  macOS:   double-click START_HERE.command
  Windows: double-click START_HERE.bat

If something breaks: text Taha what you see on screen.
EOF

# --- 5. Per-kit ID file (read by first-run installer) ---
printf '%s\n' "$kit_id" > "$VOL/kit-id.txt"

# --- 6. Owner-side registry append ---
mkdir -p "$KIT_ROOT/owner-registry"
echo "$build_ts,$kit_id,$git_sha,$(whoami)" >> "$KIT_ROOT/owner-registry/kits-shipped.csv"

# --- 7. Sync + eject ---
sync
log "Ejecting $VOL..."
diskutil eject "$VOL" >/dev/null

log "Done. Kit ID: $kit_id"
log "Hand the USB + a printed copy of docs/OPERATOR_QUICKSTART.md to the operator."
```

Make executable:
```bash
chmod +x scripts/build-master-usb.sh
```

- [ ] **Step 3: Validate + test (dry-run on a temp dir as if it were FAT32).**

```bash
bash -n scripts/build-master-usb.sh
shellcheck scripts/build-master-usb.sh
```

A real FAT32 test requires a USB drive; document for the agent to run by hand later. (The CI gate will only lint, not execute, this script.)

- [ ] **Step 4: Commit, push, PR.**

```bash
git add scripts/build-master-usb.sh
git commit -m "feat: build-master-usb.sh — verify FAT32, copy kit, generate kit-id + MANIFEST.txt + owner-registry append"
git push -u origin feat/task-16-build-usb
gh pr create --title "Task 16: build-master-usb.sh" --body "USB builder."
```

---

### Task 17: `scripts/revoke-kit.sh`

**Files:**
- Create: `~/projects/aixmos-kit/scripts/revoke-kit.sh`

Owner uses this to revoke a lost USB. Appends kit-id to `revoked-kits.txt`, commits, pushes. After push, auto-pull on that USB will refuse to continue.

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-17-revoke-kit
```

- [ ] **Step 2: Write `scripts/revoke-kit.sh`.**

```bash
#!/usr/bin/env bash
# Revoke a lost/compromised OPK. Usage: revoke-kit.sh <kit-id> [reason]
set -euo pipefail
KIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KID="${1:-}"
REASON="${2:-no reason given}"

[[ -n "$KID" ]] || { echo "Usage: $0 <kit-id> [reason]" >&2; exit 1; }
[[ "$KID" =~ ^[a-fA-F0-9-]{36}$ ]] || { echo "Not a UUID: $KID" >&2; exit 1; }

cd "$KIT_ROOT"
git checkout main && git pull --ff-only

if grep -qFx "$KID" revoked-kits.txt; then
  echo "Already revoked: $KID"
  exit 0
fi

ts="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
printf '\n# Revoked %s: %s\n%s\n' "$ts" "$REASON" "$KID" >> revoked-kits.txt

git add revoked-kits.txt
git commit -m "security: revoke kit $KID — $REASON"
git push origin main

echo "Revoked. Auto-pull on kit $KID will abort on its next cycle (within 30 min)."
```

Make executable:
```bash
chmod +x scripts/revoke-kit.sh
```

- [ ] **Step 3: Validate.**

```bash
bash -n scripts/revoke-kit.sh
shellcheck scripts/revoke-kit.sh
```

- [ ] **Step 4: Commit, push, PR.**

```bash
git add scripts/revoke-kit.sh
git commit -m "feat: revoke-kit.sh — append kit-id to revoked-kits.txt, commit, push"
git push -u origin feat/task-17-revoke-kit
gh pr create --title "Task 17: revoke-kit.sh" --body "Lost-USB revocation tool."
```

---

## Phase 6: Documentation, Verification, Acceptance (Tasks 18-20)

### Task 18: Printable docs (OPERATOR_QUICKSTART, OWNER_RUNBOOK, BRAINIAC_7_RUNBOOK)

**Files:**
- Create: `~/projects/aixmos-kit/docs/OPERATOR_QUICKSTART.md`
- Create: `~/projects/aixmos-kit/docs/OWNER_RUNBOOK.md`
- Create: `~/projects/aixmos-kit/docs/BRAINIAC_7_RUNBOOK.md`

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-18-docs
mkdir -p docs
```

- [ ] **Step 2: Write `docs/OPERATOR_QUICKSTART.md`.**

```markdown
# Welcome to TMMT — Quickstart

You should have received a **USB drive** and this printed page. Setup takes ~15 minutes.

## Step 1 — Plug the USB into your computer

## Step 2 — Open the USB drive in your file browser

You'll see a file called either:
- **macOS:** `START_HERE.command`
- **Windows:** `START_HERE.bat`

**Double-click it.**

A terminal window will open. Don't worry — you don't need to type anything fancy.

## Step 3 — Pick your role

When asked, choose **"operator"** (the default for any new computer).

## Step 4 — Sign in to your accounts

The wizard will install Tailscale and a browser, then open your browser to a series of sign-in pages:

1. **Tailscale** — sign in with the invitation email Taha sent you
2. **TMMT Admin** — use the email + temporary password Taha gave you
3. **Open WebUI (CHUMMO Chat)** — works automatically once Tailscale is signed in
4. **GHL + ClickUp** — use your accounts

## Step 5 — You're ready

After the last sign-in, your **Daily Brief** will open. You'll see today's hot leads and follow-ups. Click "Open TMMT Admin" to start working.

## If something breaks

**Text Taha** with whatever's on your screen. Click the **Help** button on your Daily Brief to upload your error log — copy the URL Taha asks for.

## What's on your desktop now

- **TMMT Admin** — your main work screen
- **CHUMMO Chat** — to draft warm customer messages
- **Daily Brief** — refreshes when you log in
- **Update Now** — click if Taha tells you to
- **Help** — for when something breaks
```

- [ ] **Step 3: Write `docs/OWNER_RUNBOOK.md`.**

```markdown
# Owner Runbook (OPK)

## Day 1 setup of a new owner machine

1. Plug the OPK USB → double-click `START_HERE.command` (Mac) or `START_HERE.bat` (Windows)
2. Pick role: `owner-carry` / `owner-work` / `owner-brain`
3. Run `gh auth login` if not already authenticated
4. Re-run the START_HERE if the installer asks (after `gh` login)
5. Run `~/projects/aixmos-kit/scripts/owner-brief.sh` to see your morning brief

## Shipping a kit to a new operator

1. Build the USB:
   ```bash
   cd ~/projects/aixmos-kit
   ./scripts/build-master-usb.sh /Volumes/AIXMOS-OPK
   ```
2. Pre-stage operator accounts (5 min, can do from phone):
   - Tailscale admin → Invites → email operator with tag `tag:operator`
   - Supabase dashboard → Auth → add user with `app_metadata.role = "va"` + temp password
   - GHL → team users → add with `Operator` role
   - ClickUp → invite as guest with list-level access
3. Hand operator:
   - The USB
   - Printed `docs/OPERATOR_QUICKSTART.md`
   - Temp password written on the back

## Revoking a lost kit

```bash
cd ~/projects/aixmos-kit
./scripts/revoke-kit.sh <kit-id-from-MANIFEST.txt> "reason"
```

That kit's next auto-pull (within 30 min) will abort.

## Pushing a change to all machines

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
# make your change
git add -A && git commit -m "..."
gh pr create     # gate-main.yml runs shellcheck + ps + json + secret scan
# after PR approves + merges → auto-pull picks it up everywhere within 30 min
```

**Do not push directly to main.** Use PRs so the gate runs.

## When TMMT migrations land

Owner auto-pull surfaces a notification when new files appear in `TMMT/supabase/migrations/`. **You** apply them manually:

```bash
cd ~/projects/TMMT
supabase db push
# OR paste the SQL into the Supabase dashboard for the target project
```
```

- [ ] **Step 4: Write `docs/BRAINIAC_7_RUNBOOK.md`.**

```markdown
# Brainiac 7 Runbook

## Daily

Brainiac 7 should always be on. If operators can't reach CHUMMO Chat:

1. From your laptop, check Tailscale admin → is `brainiac-7` online?
2. If offline → wake via Wake-on-LAN: see `docs/wake-on-lan.md`
3. SSH or AnyDesk in → verify Docker containers are up:
   ```powershell
   docker compose ps
   ```
4. Verify AIXMOS-Agent-Host service:
   ```powershell
   nssm status AIXMOS-Agent-Host
   ```
5. Health-check from your laptop:
   ```bash
   curl http://brainiac-7:7777/healthz   # AIXMOS-AGENTS HTTP
   curl -I http://brainiac-7:3000        # Open WebUI
   curl -I http://brainiac-7:5678        # n8n
   ```

## Updating Brainiac 7

Auto-pull runs every 30 min. To force-update now:

```powershell
powershell -NoProfile -File $env:USERPROFILE\projects\aixmos-kit\scripts\auto-pull.ps1
```

## Tailscale ACL — operator access

Operators (`tag:operator`) must be able to reach `:3000` (Open WebUI) but NOT `:7777` (raw agent HTTP) or `:5678` (n8n). Edit ACL in Tailscale admin:

```json
{
  "acls": [
    { "action": "accept", "src": ["tag:operator"], "dst": ["tag:brainiac-7:3000"] },
    { "action": "accept", "src": ["tag:owner"], "dst": ["tag:brainiac-7:*"] }
  ]
}
```
```

- [ ] **Step 5: Commit, push, PR.**

```bash
git add docs/
git commit -m "docs: OPERATOR_QUICKSTART + OWNER_RUNBOOK + BRAINIAC_7_RUNBOOK"
git push -u origin feat/task-18-docs
gh pr create --title "Task 18: printable docs" --body "Quickstart for operators, runbook for owner, runbook for Brainiac 7."
```

---

### Task 19: Secret-scanner in CI gate

**Files:**
- Create: `~/projects/aixmos-kit/tests/scan-secrets.sh`
- Modify: `~/projects/aixmos-kit/.github/workflows/gate-main.yml` — add a step calling `tests/scan-secrets.sh`

Acceptance criterion #4 from the spec: the operator kit must contain zero secrets. Automated test enforces this.

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-19-secret-scan
```

- [ ] **Step 2: Write `tests/scan-secrets.sh`.**

```bash
#!/usr/bin/env bash
# Scan the kit for known secret patterns. Fail if any match.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Patterns based on the secrets-vault-spec May 22.
# Each is a known-secret prefix or marker.
patterns=(
  'sk-[A-Za-z0-9]{20,}'              # OpenAI
  'sk-ant-[A-Za-z0-9-]{20,}'         # Anthropic
  'AKIA[0-9A-Z]{16}'                 # AWS access key
  'aws_secret_access_key'            # AWS
  'ghp_[A-Za-z0-9]{36}'              # GitHub PAT (classic)
  'gho_[A-Za-z0-9]{36}'              # GitHub OAuth
  'ghs_[A-Za-z0-9]{36}'              # GitHub server-to-server
  'xox[bp]-[A-Za-z0-9-]+'            # Slack
  'AIza[A-Za-z0-9_-]{35}'            # Google API
  'sk_live_[A-Za-z0-9]{20,}'         # Stripe live secret
  'rk_live_[A-Za-z0-9]{20,}'         # Stripe restricted live
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'  # JWT
  'pk_[a-zA-Z0-9_]{20,}'             # ClickUp PAT
)

failed=0
for p in "${patterns[@]}"; do
  if matches="$(grep -rE --include='*.sh' --include='*.ps1' --include='*.bat' --include='*.json' --include='*.yml' --include='*.yaml' --include='*.md' --include='*.txt' --include='*.command' --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=tests "$p" . 2>/dev/null)"; then
    if [[ -n "$matches" ]]; then
      echo "SECRET LEAK — pattern: $p"
      echo "$matches"
      failed=1
    fi
  fi
done

if [[ $failed -ne 0 ]]; then
  echo "Secret scan FAILED" >&2
  exit 1
fi
echo "Secret scan PASSED — kit contains zero known-secret patterns."
```

Make executable:
```bash
chmod +x tests/scan-secrets.sh
```

- [ ] **Step 3: Update `.github/workflows/gate-main.yml`.**

Add to the `jobs.lint.steps:` array, after `Lint JSON`:

```yaml
      - name: Scan for secrets
        run: ./tests/scan-secrets.sh
```

Apply with:

```bash
# Manual edit; the workflow file is small. Open in editor and add the step.
```

- [ ] **Step 4: Verify the scanner runs locally.**

```bash
./tests/scan-secrets.sh
```

Expected: `Secret scan PASSED`. If FAIL, examine the matches — a documentation file might mention an example secret pattern. Either rephrase or scrub.

- [ ] **Step 5: Commit, push, PR.**

```bash
git add tests/scan-secrets.sh .github/workflows/gate-main.yml
git commit -m "ci: add scan-secrets.sh + wire into gate-main.yml (acceptance criterion #4)"
git push -u origin feat/task-19-secret-scan
gh pr create --title "Task 19: secret scanner" --body "Blocks merge if any known-secret pattern (Anthropic / OpenAI / AWS / GitHub / Stripe / JWT / etc.) leaks into a tracked file."
```

---

### Task 20: Acceptance test scripts (AT-1, AT-3, AT-4, AT-5, AT-6, AT-8)

**Files:**
- Create: `~/projects/aixmos-kit/tests/acceptance/AT-1-operator-mac.sh`
- Create: `~/projects/aixmos-kit/tests/acceptance/AT-2-operator-windows.md` (manual checklist)
- Create: `~/projects/aixmos-kit/tests/acceptance/AT-3-autopull-propagation.sh`
- Create: `~/projects/aixmos-kit/tests/acceptance/AT-4-gate-blocks-bad.sh`
- Create: `~/projects/aixmos-kit/tests/acceptance/AT-5-revoked-aborts.sh`
- Create: `~/projects/aixmos-kit/tests/acceptance/AT-6-brainiac-offline-indicator.sh`
- Create: `~/projects/aixmos-kit/tests/acceptance/AT-7-owner-work-fresh.md` (manual checklist)
- Create: `~/projects/aixmos-kit/tests/acceptance/AT-8-no-secrets-in-kit.sh`

Mostly thin wrappers and manual checklists. The two scripted ones that matter most: AT-5 (revocation) and AT-8 (no secrets).

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-20-acceptance-tests
mkdir -p tests/acceptance
```

- [ ] **Step 2: Write `tests/acceptance/AT-1-operator-mac.sh`.**

```bash
#!/usr/bin/env bash
# AT-1: fresh Mac, fresh USB, operator role -> reaches daily-driver brief in <20min.
# Designed to be run on a clean VM. Not run in CI (requires GUI + network + login flows).
set -euo pipefail
echo "AT-1 requires manual execution on a clean macOS VM."
echo "Procedure:"
echo "  1. Boot a fresh macOS VM."
echo "  2. Plug in an OPK USB built by scripts/build-master-usb.sh."
echo "  3. Double-click START_HERE.command."
echo "  4. Choose 'operator' role."
echo "  5. Sign into Tailscale, TMMT, GHL, ClickUp when prompted."
echo "  6. PASS criteria: daily-driver brief opens in browser, with the 4 sections rendered."
echo "  7. Time the elapsed seconds — must be <1200s (20 min)."
exit 0
```

Make executable.

- [ ] **Step 3: Write `tests/acceptance/AT-2-operator-windows.md`** (manual mirror of AT-1):

```markdown
# AT-2 — Operator install on fresh Windows 11

Procedure mirrors AT-1 but on a Windows 11 VM. Use `START_HERE.bat`. Same PASS criteria.
```

- [ ] **Step 4: Write `tests/acceptance/AT-3-autopull-propagation.sh`.**

```bash
#!/usr/bin/env bash
# AT-3: a push to aixmos-kit/main reaches a local clone within 30 min OR on next login.
# Procedure (manual but scripted as a checklist):
set -euo pipefail
echo "AT-3 procedure:"
echo "  1. From an owner machine, push a trivial commit to aixmos-kit/main."
echo "  2. On a SEPARATE operator machine, wait <=30 min OR log out + log back in."
echo "  3. Verify: ~/aixmos-kit/.last-pull.log contains the new commit SHA."
echo "  4. PASS if propagation observed."
exit 0
```

- [ ] **Step 5: Write `tests/acceptance/AT-4-gate-blocks-bad.sh`.**

```bash
#!/usr/bin/env bash
# AT-4: PR with broken shell cannot merge to main.
set -euo pipefail
TMP="$(mktemp -d)"
cd "$TMP"
git clone https://github.com/AIXMOS537/aixmos-kit.git
cd aixmos-kit
git checkout -b at-4-broken-shell
echo 'if [' > tests/broken.sh   # intentionally invalid bash
chmod +x tests/broken.sh
git add tests/broken.sh
git commit -m "test: AT-4 intentional broken shell"
git push -u origin at-4-broken-shell
url="$(gh pr create --title "AT-4 broken shell" --body "Should fail gate" --json url -q .url)"
echo "PR opened: $url"
echo "Wait ~2 min for CI to run, then verify 'lint' check shows FAILED."
echo "Then: gh pr close --delete-branch $url"
```

- [ ] **Step 6: Write `tests/acceptance/AT-5-revoked-aborts.sh`.**

```bash
#!/usr/bin/env bash
# AT-5: adding a kit-id to revoked-kits.txt makes that kit's auto-pull abort.
set -euo pipefail
TMP="$(mktemp -d)"
KIT_ROOT="$TMP/aixmos-kit"
mkdir -p "$KIT_ROOT"
git clone --depth 1 https://github.com/AIXMOS537/aixmos-kit.git "$KIT_ROOT"
FAKE_ID="$(uuidgen)"
echo "$FAKE_ID" > "$KIT_ROOT/kit-id.txt"

# Run auto-pull — should succeed because FAKE_ID is not yet revoked
KIT_ROOT="$KIT_ROOT" bash "$KIT_ROOT/scripts/auto-pull.sh"
echo "PASS — auto-pull succeeded with non-revoked id."

# Now revoke
cd "$KIT_ROOT"
./scripts/revoke-kit.sh "$FAKE_ID" "AT-5 test"

# Re-run auto-pull — should abort with exit 1
if KIT_ROOT="$KIT_ROOT" bash "$KIT_ROOT/scripts/auto-pull.sh"; then
  echo "FAIL — auto-pull should have aborted on revoked id"
  exit 1
else
  echo "PASS — auto-pull aborted on revoked id"
fi

# Cleanup: remove the test revocation
cd "$KIT_ROOT"
sed -i '' "/$FAKE_ID/d" revoked-kits.txt
sed -i '' '/AT-5 test/d' revoked-kits.txt
git add revoked-kits.txt
git commit -m "test: AT-5 cleanup"
git push origin main

rm -rf "$TMP"
echo "AT-5 PASSED + cleaned up."
```

- [ ] **Step 7: Write `tests/acceptance/AT-6-brainiac-offline-indicator.sh`.**

```bash
#!/usr/bin/env bash
# AT-6: if Brainiac 7 is unreachable, owner-brief.sh shows OFFLINE within 30 min.
set -euo pipefail
out="$(KIT_ROOT=/tmp/at6 AGENTS_DIR=/nonexistent BRAINIAC_HOST=invalid-host-12345 \
  bash scripts/owner-brief.sh 2>&1)"
if echo "$out" | grep -q "OFFLINE"; then
  echo "PASS — OFFLINE indicator surfaced."
else
  echo "FAIL — OFFLINE indicator missing from brief output"
  echo "$out"
  exit 1
fi
```

- [ ] **Step 8: Write `tests/acceptance/AT-7-owner-work-fresh.md`** (manual):

```markdown
# AT-7 — owner-work fresh install on M1 Max

Procedure (manual):
1. Start with `~/projects/` empty.
2. Plug OPK, run START_HERE.command, choose owner-work.
3. After installer completes, verify:
   - All 5 repos cloned under `~/projects/`
   - `gh auth status` succeeds
   - `cd ~/projects/TMMT && npm run check-env` passes
   - `npm run build` succeeds
4. PASS if all four checks pass.
```

- [ ] **Step 9: Write `tests/acceptance/AT-8-no-secrets-in-kit.sh`.**

```bash
#!/usr/bin/env bash
# AT-8: operator kit (the USB itself) contains zero secrets.
# This is the same scan as tests/scan-secrets.sh but applies to a built USB.
set -euo pipefail
VOL="${1:-}"
if [[ -z "$VOL" || ! -d "$VOL" ]]; then
  echo "Usage: $0 /Volumes/<mounted-OPK-USB>" >&2
  exit 1
fi
cd "$VOL"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$HERE/../scan-secrets.sh"
```

- [ ] **Step 10: Commit, push, PR.**

```bash
chmod +x tests/acceptance/*.sh
git add tests/acceptance/
git commit -m "test: acceptance tests AT-1 through AT-8 (mix of scripted + manual checklists)"
git push -u origin feat/task-20-acceptance-tests
gh pr create --title "Task 20: acceptance tests" --body "AT-1..AT-8 per spec."
```

---

## Phase 7: Consolidation (Tasks 21-22)

### Task 21: Absorb `ai-command-center/scripts/fasttrack-macbook.sh` into owner installers

**Files:**
- Modify: `~/projects/aixmos-kit/roles/owner-carry/install-mac.sh` and `~/projects/aixmos-kit/roles/owner-work/install-mac.sh` (incorporate any unique logic from fasttrack-macbook.sh)
- Delete: `~/projects/ai-command-center/scripts/fasttrack-macbook.sh` (in the ai-command-center repo, via a separate PR there)

- [ ] **Step 1: Read `~/projects/ai-command-center/scripts/fasttrack-macbook.sh`** and identify any logic not already in the owner installers (Tasks 12 & 13).

- [ ] **Step 2: If unique logic exists**, add it to the appropriate owner installer in `~/projects/aixmos-kit/`. Commit on a new branch in aixmos-kit, push, PR. Local-first: Ollama + GHL only — no third-party agent gateways.

- [ ] **Step 3: In `~/projects/ai-command-center/`** delete the fasttrack script, commit `chore: remove fasttrack-macbook.sh (absorbed into AIXMOS537/aixmos-kit owner roles)`, push, PR.

- [ ] **Step 4: After both PRs merge, verify** by re-running `roles/owner-work/install-mac.sh` on a sacrificial Mac and confirming end-state is identical to pre-absorption.

---

### Task 22: Move `~/projects/portable-setup/` docs into `aixmos-kit/docs/`

**Files:**
- Create: `~/projects/aixmos-kit/docs/three-machine-setup.md` (from `portable-setup/README.md`)
- Create: `~/projects/aixmos-kit/docs/tailscale-setup.md`
- Create: `~/projects/aixmos-kit/docs/nas-ugreen-setup.md`
- Create: `~/projects/aixmos-kit/docs/wake-on-lan.md`
- Create: `~/projects/aixmos-kit/docs/syncthing-setup.md`
- Delete: `~/projects/portable-setup/` (after move)

- [ ] **Step 1: Branch off main.**

```bash
cd ~/projects/aixmos-kit
git checkout main && git pull --ff-only
git checkout -b feat/task-22-absorb-portable-setup
```

- [ ] **Step 2: Copy + rename files.**

```bash
cp ~/projects/portable-setup/README.md docs/three-machine-setup.md
cp ~/projects/portable-setup/nas-ugreen-setup.md docs/nas-ugreen-setup.md
cp ~/projects/portable-setup/wake-on-lan.md docs/wake-on-lan.md
cp ~/projects/portable-setup/syncthing-setup.md docs/syncthing-setup.md
cp ~/projects/portable-setup/quick-reference.md docs/three-machine-quick-reference.md
# Note: tailscale-setup.md needs to be extracted from inside the README (no standalone file in source)
# Write a clean docs/tailscale-setup.md from the relevant section of three-machine-setup.md
```

Manually extract the Tailscale section into `docs/tailscale-setup.md`.

- [ ] **Step 3: Update `docs/three-machine-setup.md` headings** to remove "flash drive" assumptions (since `aixmos-kit` is the kit now, not `portable-setup`).

- [ ] **Step 4: Commit + PR aixmos-kit changes.**

```bash
git add docs/
git commit -m "docs: absorb portable-setup content (three-machine, tailscale, NAS, WoL, syncthing, quick-ref)"
git push -u origin feat/task-22-absorb-portable-setup
gh pr create --title "Task 22: absorb portable-setup docs" --body "Folds content from ~/projects/portable-setup/ into docs/."
```

- [ ] **Step 5: After merge — delete `~/projects/portable-setup/`.**

```bash
# Verify the absorbed files render correctly first
ls ~/projects/aixmos-kit/docs/three-machine-setup.md ~/projects/aixmos-kit/docs/wake-on-lan.md
# Then remove
rm -rf ~/projects/portable-setup
rm ~/portable-setup   # symlink
```

- [ ] **Step 6: Update memory** in `~/.claude/projects/-Users-ceo-moe/memory/project_tmmt_repo_layout.md` — remove the portable-setup row.

---

## Self-Review

Comparing the plan against the spec section-by-section:

**Goals coverage:** ✓ All 7 goals map to tasks:
- "One USB, one START_HERE" → Task 3
- "Zero secrets in operator kit" → Tasks 5, 6 (no secrets in installers), Task 19 (scanner)
- "GitHub canonical" → Tasks 9, 10, 16 (build-master-usb writes git SHA into MANIFEST)
- "Thin-client operator UX" → Tasks 5, 6, 7, 8
- "Owner runs from anywhere" → Tasks 12, 13, 15
- "Idiot-proof first-run" → Task 18 (printable docs), Task 3 (wizard)
- "Reuse, don't duplicate" → Task 15 delegates to AI-OPS-STARTER, Task 22 absorbs portable-setup

**Non-goals respected:** voice input, EA routing, mobile, secrets vault execution — none planned. ✓

**Roles:** all 4 covered (operator: Tasks 5-8; owner-carry: 12; owner-work: 13; owner-brain: 15). ✓

**Architecture:** orchestrator repo, manifest files, bootstrap entry points, auto-pull, branch policy, GitHub Action gate — all built. ✓

**8 acceptance tests:** all 8 represented in Task 20. ✓

**8 risks:** mitigations cited (CI gate, .role file, OFFLINE indicator, kit-id revocation) are all implemented by named tasks. ✓

**Placeholder scan:** no `TBD`, `TODO`, "implement later" patterns. Steps reference real code. ✓

**Type/name consistency:** `kit-id.txt` referenced consistently across installers, auto-pull, build-master-usb, revoke-kit. `.role` file referenced consistently. Manifest schema (`roles[role].required[]`) consistent in install scripts and auto-pull. ✓

**One gap noticed during review:** Task 7 promises "v2 wires live Supabase via TMMT session" but no future task exists for v2 in this plan. That's a deliberate scope decision — v2 of the daily brief is a separate plan, called out in the spec's "open issues" section. No action needed in this plan.
