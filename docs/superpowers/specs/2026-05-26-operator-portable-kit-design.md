# Operator Portable Kit (OPK) — Design Spec

**Date:** 2026-05-26
**Author:** Taha (owner) + Claude (architecture)
**Status:** Approved, ready for implementation plan

## Executive Summary

The Operator Portable Kit (OPK) is a single, universal USB flash drive that — combined with a new orchestrator GitHub repo `AIXMOS537/aixmos-kit` — turns any Mac or Windows machine into a working node of the AIXMOS/TMMT operations stack in under 20 minutes. It supports three owner device profiles (carry MacBook, work MacBook, always-on AI brain on Windows) and one operator profile (thin-client browser + Tailscale). GitHub is the single source of truth; the USB is a lightweight bootstrapper. After first-run, machines auto-pull updates from GitHub on every login and every 30 minutes.

The OPK exists so the owner can run a tight ship from any device, and operators can close leads + funnel customers from rental → $97 AIXMOS membership → credit guidance → funding without needing technical skill or owner hand-holding.

## Goals

- **One USB, one START_HERE, one daily-driver.** Any device, any role, single entry point.
- **Zero secrets in the operator kit.** Operators sign into accounts the owner has granted; the USB never contains API keys, .env files, or credentials.
- **GitHub canonical.** Every change ships by `git push` to `AIXMOS537/aixmos-kit` main. Auto-pull propagates within 30 minutes.
- **Thin-client operator UX.** Operators get a browser, Tailscale, and three bookmarks (TMMT Admin, CHUMMO Chat on Brainiac 7, Update Now). No dev environment, no agent CLIs, nothing they can break.
- **Owner runs from anywhere.** Owner profiles deliver full dev stacks (M1 Max work) or thin remote access (M5 Pro carry) selectable at first-run.
- **Idiot-proof first-run.** A non-technical operator can go from sealed USB envelope to closing leads in 15 minutes with no owner attention, using a printed 1-pager.
- **Reuse, don't duplicate.** The orchestrator does not replace AI-OPS-STARTER, AIXMOS-AGENTS, AIX-Command-Center, ai-command-center, TMMT, or PROJECTAIXMOS. It composes them per role.

## Non-Goals (out of scope for v1)

- Voice input for brain-dump (already in AIX-Command-Center v2 spec)
- EA routing automation (already in AIX-Command-Center v1.5 spec)
- Execution of the May-22 secrets vault (separate project; OPK does not depend on it shipping first)
- Mobile (iPad/iPhone) operator support — phase 2, expected to be trivial because of thin-client model
- Operator self-service password reset / MFA enrollment — phase 2; owner handles in Supabase dashboard for v1
- Offline-capable operator workflow — operators assume Tailscale + internet are available

## Constraints

- Operators are non-technical and have a track record of failure with prior tooling. The kit must require ≤4 clicks and ≤4 sign-ins to reach a working state.
- USB drives are FAT32 (cross-platform readable). No native Unix permissions, 4GB max single-file size.
- Owner uses three personal machines (M5 Pro carry MacBook, M1 Max work MacBook, Brainiac 7 Windows home PC); operators use a mix of in-office Windows workstations and their own personal Mac/Windows laptops.
- Tailscale is the private mesh; AnyDesk and Mac Screen Sharing provide GUI remote access. Already established (5 devices visible on the tailnet: macbook-pro, brainiac-7, desktop-v9gqhhj, fleet, iphone171).
- Compliance vocabulary is non-negotiable: "credit guidance" (never "credit repair"), no guaranteed outcomes (see `docs/sops/CREDIT-GUIDANCE-SOP.md` and `docs/ops-company-policy.md`).

## Roles + Device Profiles

Two top-level roles. Owner has three device profiles; operator has one.

| Role | Profile | Machine | Purpose | Stack |
|---|---|---|---|---|
| OWNER | `owner-carry` | M5 Pro MacBook | Thin remote terminal; nothing important stored locally | `aixmos-kit` + `ai-command-center` only; full stack offered on-demand by wizard |
| OWNER | `owner-work` | M1 Max MacBook | Canonical dev; TMMT `npm run dev`, Vercel deploys, all 5 repos checked out | All 5 AIXMOS537 repos + Node + Ollama + gh + playwright + vercel CLI + supabase CLI + Claude Code |
| OWNER | `owner-brain` | Brainiac 7 (Windows home PC) | Always-on AI host. Serves Open WebUI to operators via Tailscale | Delegates to existing `AI-OPS-STARTER` (Docker, Ollama, Open WebUI, n8n, Qdrant) + adds AIXMOS-AGENTS HTTP server + auto-pull |
| OPERATOR | `operator` | Office workstation OR operator personal laptop (Mac/Win) | Close leads, funnel to AIXMOS membership, send warm comms via CHUMMO drafts | Tailscale + Brave (or Chrome) + 3 desktop shortcuts + login hook for auto-pull. No clones of TMMT/agents. |

**Role detection:** the first-run wizard always asks even after auto-detecting (so wrong-detection can't cause silent miscommissioning). For OWNER, a second question asks "carry / work / brain."

Auto-detection hints (used to suggest the default selection):
- Hostname matches `Brainiac-7` or similar → suggest `owner-brain`
- Hostname matches known owner Mac names → suggest `owner-work` or `owner-carry`
- Existence of `~/AIXMOS-AGENTS/` or `~/TMMT/` → suggest OWNER
- Default → OPERATOR

## Architecture: the `AIXMOS537/aixmos-kit` Orchestrator Repo

A new repo, separate from the 5 existing repos. Small (~50MB checked out). Knows how to compose them per role.

```
aixmos-kit/
├── README.md                      # Printed and inserted into USB envelope
├── START_HERE.command             # Mac entry point (double-click)
├── START_HERE.bat                 # Windows entry point (double-click)
├── bootstrap/
│   ├── mac.sh                     # Detects OS + role → routes to roles/<role>/install-mac.sh
│   ├── win.ps1                    # Same for Windows
│   └── detect.sh                  # uname, hostname, env-var heuristics → role guess
├── roles/
│   ├── owner-carry/
│   │   ├── install-mac.sh
│   │   └── shortcuts/             # Desktop links for this profile
│   ├── owner-work/
│   │   ├── install-mac.sh         # Full dev stack
│   │   └── shortcuts/
│   ├── owner-brain/
│   │   ├── install-win.ps1        # Delegates to AI-OPS-STARTER, layers aixmos-kit auto-pull
│   │   └── shortcuts/
│   └── operator/
│       ├── install-mac.sh
│       ├── install-win.ps1
│       └── shortcuts/             # "TMMT Admin", "CHUMMO Chat", "Update Now"
├── scripts/
│   ├── auto-pull.sh               # macOS — runs on login + every 30m via launchd
│   ├── auto-pull.ps1              # Windows — runs on login + every 30m via Task Scheduler
│   ├── daily-driver-operator.sh   # Renders operator morning brief HTML page
│   ├── daily-driver-operator.ps1
│   ├── owner-brief.sh             # Owner morning brief (terminal output)
│   ├── build-master-usb.sh        # Owner runs once per USB to produce a shippable drive
│   └── revoke-kit.sh              # Adds a kit-id to revoked-kits.txt + pushes
├── shortcuts/                     # Source-of-truth bookmark files (.url, .webloc)
│   ├── tmmt-admin.url
│   ├── chummo-chat.url
│   ├── update-now.url
│   └── helpdesk.url
├── manifest/
│   ├── repos.json                 # Which of the 5 repos each role clones (+ branch + post-clone hooks)
│   ├── packages.json              # Required Homebrew / winget / scoop packages per role
│   └── shortcuts.json             # Which shortcuts each role gets
├── docs/
│   ├── OPERATOR_QUICKSTART.md     # 1-page printed welcome
│   ├── OWNER_RUNBOOK.md
│   ├── BRAINIAC_7_RUNBOOK.md
│   ├── three-machine-setup.md     # Moved from ~/portable-setup/README.md
│   ├── tailscale-setup.md         # Moved from ~/portable-setup/
│   ├── nas-ugreen-setup.md        # Moved from ~/portable-setup/
│   └── wake-on-lan.md             # Moved from ~/portable-setup/
├── revoked-kits.txt               # USB kit-ids that auto-pull will refuse to update
└── .github/
    └── workflows/
        └── gate-main.yml          # shellcheck + bash -n + JSON lint; required before merge to main
```

### Repo-clone matrix

| Role/profile | TMMT | AIXMOS-AGENTS | AIX-Command-Center | ai-command-center | PROJECTAIXMOS | aixmos-kit |
|---|---|---|---|---|---|---|
| `owner-carry` | optional | optional | optional | ✅ | optional | ✅ |
| `owner-work` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `owner-brain` | ❌ (no dev) | ✅ | ✅ | ✅ | ❌ | ✅ |
| `operator` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (only for auto-pull) |

`owner-carry` defaults to MINIMAL. The wizard offers an opt-in "Pull the full owner-work stack now? Y/N" for when you want to do real work from the road.

## First-Run Flow (per role)

### `owner-work` (M1 Max)

1. Plug USB → double-click `START_HERE.command`
2. Wizard: `Owner / Operator` → `Owner`; `carry / work / brain` → `work`
3. Install Homebrew (if missing) → `git`, `gh`, `node@20`, `python@3.12`, `playwright`, `vercel`, `supabase`, `ollama`
4. Pull Ollama model: `llama3.2:3b`
5. `gh auth login` (browser-based)
6. Clone all 5 repos to `~/projects/` (per the cleanup plan's umbrella decision — see Round 6 of cleanup plan)
7. For TMMT: prompt for `.env` restore — point to backup folder or vault if available, otherwise leave for owner to manually configure
8. Install Claude Code (if not already)
9. Install launchd plist for auto-pull
10. Done. Open `~/projects/TMMT` in editor of choice.

### `owner-carry` (M5 Pro)

Same as owner-work but skips steps 3-7. Only clones `aixmos-kit` and `ai-command-center`. Wizard ends with "Want the full owner-work stack? Y/N" — `N` leaves it minimal.

### `owner-brain` (Brainiac 7, Windows)

1. Plug USB → double-click `START_HERE.bat`
2. Wizard: `Owner / Operator` → `Owner`; `carry / work / brain` → `brain`
3. Install Tailscale (if missing) → sign in with owner account
4. Delegate to existing `AI-OPS-STARTER\install-windows.ps1` (Docker, Ollama, Open WebUI, n8n, Qdrant)
5. Clone AIXMOS-AGENTS + AIX-Command-Center + ai-command-center
6. Set up AIXMOS-AGENTS HTTP server as a Windows Service (auto-start)
7. Register the TMMT Command Center model in Open WebUI (Task 9 from brain-dump v1 plan — finally automated)
8. Configure Tailscale ACLs: only owner devices can hit `:7777` (AIXMOS-AGENTS HTTP), operators get `:3000` (Open WebUI) only
9. Install Task Scheduler entry for auto-pull
10. Done. Confirm `https://brainiac-7:3000` loads from owner laptop.

### `operator` (any Mac or Windows machine)

1. Plug USB → double-click `START_HERE` (matching OS)
2. Wizard: `Owner / Operator` → `Operator` (no sub-question)
3. Install Tailscale → operator clicks "Sign in" → uses email invite link
4. Install Brave (portable; no admin needed on Windows)
5. `git clone aixmos-kit` to `~/aixmos-kit/`
6. Drop desktop shortcuts: **TMMT Admin** (→ `https://allinonemanagementsolutions.net`), **CHUMMO Chat** (→ `https://brainiac-7:3000`), **Update Now**, **Help** (→ private gist log uploader)
7. Install login hook (launchd / Task Scheduler) — runs auto-pull then opens daily-driver brief
8. Open browser to "First Sign-In" page (rendered from `aixmos-kit`) — sequential login buttons: TMMT → CHUMMO → GHL → ClickUp
9. After last sign-in: render the daily-driver brief automatically. Operator is working.

If something breaks, the printed 1-pager says: **"Click Help on your daily-driver brief, then text Taha what you see."** The Help button uploads the last 3 days of `auto-pull.log` + last error trace to a private gist on the owner's GitHub account and SMSs the gist URL via a small webhook (this last part is phase 1.5 if time-constrained — for v1, it just creates the gist and shows the URL to copy/paste).

## Daily-Driver Experience

### Operator brief (rendered on every login, also on demand)

A single static HTML page generated by `daily-driver-operator.{sh|ps1}` after auto-pull completes. Data sources:
- **Supabase (anon key, scoped queries):** new leads from last 24h, leads stuck >24h in current pipeline stage, customers approaching `ready-for-aixmos` tag, overdue payments
- **GHL summary:** today's pipeline counts per stage
- **ClickUp:** tasks assigned to this operator due today or overdue

Page format (concept — to be polished in implementation):

```
GOOD MORNING, [name]                          [today's date]

🔥  N hot leads waiting on you (last touched >24h)
    [list with quick-action buttons]

📞  N leads to follow up today (per GHL stage)

💳  N customers ready for AIXMOS membership pitch

⚠   N overdue payments to chase

[Open TMMT Admin]  [Open CHUMMO Chat]  [Today's SOP]  [Help]
```

Reload button refetches without re-rendering structure. Brief is intentionally read-only — all actions deep-link to TMMT admin or to CHUMMO chat. Operators don't edit data in the brief.

### Owner brief (terminal-rendered, all 3 owner machines)

Synthesized by extending the existing `AIXMOS-AGENTS/briefing.js`. Sections:
- Revenue: yesterday + month-to-date (from TMMT payments table)
- Pipeline funnel: rentals → $97 → credit → funding counts
- Agent activity: STICKS alerts, handoffs since last brief
- Open critical items needing owner decision
- Today's 3 non-negotiables (pulled from owner's ClickUp "Today" list)
- Brainiac 7 health: ONLINE / OFFLINE indicator

Output: terminal text, optionally piped to a markdown file in `~/aixmos-kit/.last-brief.md`.

### Brainiac 7

No user-facing brief. On startup runs `docker compose up -d` for the AI-OPS-STARTER stack + starts AIXMOS-AGENTS HTTP server. Health endpoint at `:7777/healthz`.

## Auto-Pull + Update Mechanism

**Trigger:** login + every 30 minutes (launchd on Mac, Task Scheduler on Windows).

**Script behavior (`auto-pull.{sh|ps1}`):**
1. `cd ~/aixmos-kit && git pull --ff-only origin main`
2. Check `revoked-kits.txt` against this kit's `kit-id.txt` — if revoked, refuse to continue + show owner-contact message
3. If role = owner-work or owner-brain: also `git pull --ff-only` each cloned production repo
4. If TMMT updates contained new Supabase migrations: send macOS notification / Windows toast to owner ("New TMMT migration pending: <filename>. Apply before next deploy."). Do NOT auto-apply.
5. If role = operator: re-render daily-driver brief
6. Log to `~/aixmos-kit/.last-pull.log` (rotate at 1MB)
7. Fail silently if offline — log "offline" but don't pester operators

**Branch policy on `aixmos-kit`:**
- `main` — what auto-pull targets. Only pushed after a green smoke test from owner.
- `dev` — owner's experimentation branch (M1 Max).
- `release-YYYY-MM-DD` — tagged snapshot when owner cuts a new physical flash drive.

**GitHub Action `gate-main.yml`** runs on every PR to `main`:
- `shellcheck` on all `.sh`
- `bash -n` parse-check
- `pwsh -NoProfile -Command "$null = Get-Content $_ -Raw; [scriptblock]::Create($content)"` for `.ps1`
- JSON lint on `manifest/*.json`
- Markdown link-check on `docs/*.md`

One bad push to main breaks every operator next morning. The gate is non-negotiable.

## Brainiac 7 Integration

Reuses AI-OPS-STARTER's `phase1-windows-bootstrap.ps1` for the Docker/Ollama/Open WebUI setup — does not replace it.

Layered on top:
- `aixmos-kit` auto-pull
- AIXMOS-AGENTS HTTP server (`agent-server.js`) as a Windows Service via `nssm` or similar — auto-starts at boot
- TMMT Command Center model registered in Open WebUI (current brain-dump v1 manual Task 9, now automated)
- Tailscale ACL configuration:
  - Operators (`tag:operator`) → can reach `:3000` (Open WebUI) only
  - Owner devices → can reach `:3000`, `:7777` (AIXMOS-AGENTS HTTP), `:5678` (n8n)
- `owner-brief.sh` on owner laptops pings `:7777/healthz` and surfaces Brainiac 7 status

If Brainiac 7 is offline, operators cannot draft messages with CHUMMO. Wake-on-LAN documented at `aixmos-kit/docs/wake-on-lan.md` (moved from `~/portable-setup/wake-on-lan.md`).

## Distribution Flow

### Building a master USB

Owner runs from M1 Max:

```bash
cd ~/projects/aixmos-kit
./scripts/build-master-usb.sh /Volumes/AIXMOS-OPK
```

The script:
1. Verifies the volume is FAT32 (else aborts with `format the drive as FAT32 first`)
2. Copies ~50MB of bootstrapper + Tailscale offline installers + Brave portable + printed-README PDF
3. Generates unique `kit-id.txt` (UUID v4 + ISO 8601 build timestamp)
4. Appends new `kit-id` to a local owner registry: `~/aixmos-kit/owner-registry/kits-shipped.csv` (date, kit-id, recipient name if known)
5. Writes `MANIFEST.txt`: kit version, git SHA of aixmos-kit at build time, build date, expected operator first-run flow URL
6. Ejects cleanly

Replicating: owner runs the script once per USB. ~30 seconds per drive after the first.

### Onboarding a new operator (the 4-step protocol)

**Owner pre-stages (~5 min, can do from phone):**
1. Tailscale admin → Invites → send to operator's email; tag them `tag:operator`
2. Supabase dashboard → Auth → add user with `app_metadata.role = "va"` and temporary password
3. GHL → team users → add with `Operator` role
4. ClickUp → invite as guest with list-level access

**Owner physically hands operator:**
- USB drive
- Printed 1-pager with: their temporary password for TMMT (write it on the back), the words "Plug in, double-click START_HERE, follow the wizard, ask Claude/me if anything breaks"

**Operator does (~15 min, alone, no owner attention needed):**
- 4-step first-run flow as described in "First-Run Flow → operator" above

### Lost USB / dead machine recovery

| Scenario | Action |
|---|---|
| Operator loses USB | Owner adds the lost kit-id to `aixmos-kit/revoked-kits.txt`, pushes. Next auto-pull on that USB refuses to update + shows "contact owner" message. Owner cuts a new USB. |
| Dead operator machine | New machine + same USB → same first-run flow. No data on the machine (thin client). |
| Operator leaves | Owner deactivates their accounts in TMMT/GHL/ClickUp + removes from Tailscale. Their USB becomes a paperweight. |
| Owner machine dies | Owner USB + new machine → re-run first-run wizard with `owner-work` profile → restores everything from GitHub. The owner-only secrets vault (May-22 spec) is the only thing the USB doesn't restore — that's a separate recovery path from the encrypted 7z on the 3 owner USBs. |

## Consolidation of Existing Pieces

| Existing piece | Fate after OPK ships |
|---|---|
| `~/AI-OPS-STARTER` (Brainiac 7 Windows kit) | **KEEP as-is** — called by `aixmos-kit/roles/owner-brain/install-win.ps1`. Continues to live as its own repo because it's a complete subsystem. Gets a `manifest/repos.json` entry. |
| `~/AIX-Command-Center/scripts/portable-kit/build-portable-kit.sh` | **DELETE** — superseded by `aixmos-kit/scripts/build-master-usb.sh`. The brain-dump agent itself stays in AIX-Command-Center; only the portable-kit builder dies. |
| `~/ai-command-center/scripts/fasttrack-macbook.sh` | **ABSORB** — its logic moves into `aixmos-kit/roles/owner-{carry,work}/install-mac.sh`. Original script deleted from ai-command-center repo in a follow-up PR. |
| `~/TMMT-AI-RUNTIME` | **KEEP as-is** — owner-work + owner-brain installs both pull it from GitHub. It's the cross-machine agent launcher. Gets a `manifest/repos.json` entry. |
| `~/portable-setup` | **MOVE content** — three-machine setup, NAS, Tailscale, AnyDesk, Wake-on-LAN docs all fold into `aixmos-kit/docs/`. Original folder deleted after migration. |
| `~/secrets-vault-spec-2026-05-22.md` + plan + inventory | **REMAINS owner-only** — moves to private gist or owner-only branch of aixmos-kit. NOT distributed via the kit. Vault execution kicks off as a separate project after OPK ships. |
| 5 existing repos in AIXMOS537 (TMMT, AIXMOS-AGENTS, AIX-Command-Center, ai-command-center, PROJECTAIXMOS) | **UNCHANGED** — aixmos-kit clones them per role, never modifies their structure or scripts. |

Net result: home directory scattered starter pieces (`AI-OPS-STARTER`, `portable-setup`, `ai-command-center` bootstraps, brain-dump portable-kit script) collapse from 5 unrelated launch points into 1 orchestrator (`aixmos-kit`) that composes them. Operators see one USB, one START_HERE, one daily-driver. Owner ships updates by pushing to one repo.

## Open Issues / Risks

| Risk | Mitigation |
|---|---|
| Bad push to `aixmos-kit/main` breaks every operator next morning | `gate-main.yml` GitHub Action runs shellcheck + bash -n + ps1 parse + JSON lint as required check before merge |
| Operator runs an outdated USB after a long gap (e.g. 6 months) | First-run script checks build date in `MANIFEST.txt` vs current month; if >90 days old, warns "kit version is N months old; contact owner for fresh USB" but proceeds |
| Operator's machine is on a managed network blocking Tailscale | Owner-provided workstations: Tailscale is pre-allowed. Operator personal machine: documented troubleshooting in OPERATOR_QUICKSTART.md; fallback is AnyDesk into Brainiac 7. |
| `gh auth login` browser flow fails on owner machine without browser | owner-work expects a browser; if needed, support `gh auth login --with-token < file` documented in OWNER_RUNBOOK.md |
| TMMT migration auto-pulled to owner-work but not applied → next dev session breaks | Notification + log entry surface the pending migration on every owner brief until owner applies and confirms |
| The owner-brain (Brainiac 7) goes offline → operators can't draft with CHUMMO | Owner brief surfaces "AI brain: OFFLINE" prominently. Wake-on-LAN documented. Operators can still work TMMT admin (which doesn't depend on Brainiac 7). |
| Operator clicks Update Now when there's no internet | Auto-pull script handles offline gracefully (logs + exits 0); operator sees "Already up to date" message regardless |
| Secrets vault execution (separate project) blocks owner setup on a new machine | Owner-work first-run is documented to work without the vault — `.env` files are owner's responsibility to restore manually on initial setup. The vault is a quality-of-life upgrade, not a dependency. |

## Success Criteria

1. **One USB, one START_HERE.** An operator with no technical background, given a sealed USB envelope and a printed 1-pager, reaches the daily-driver brief in ≤20 minutes with zero owner interaction.
2. **Owner runs the same kit on M5 Pro, M1 Max, and Brainiac 7.** First-run wizard correctly suggests the right profile, but always asks. Wrong-detection cannot cause silent miscommissioning.
3. **GitHub is the single source of truth.** A change pushed to `aixmos-kit/main` reaches every connected machine within 30 minutes OR at their next login, whichever comes first.
4. **Operator kit ships zero secrets.** Verified by an automated test in `gate-main.yml` that greps the kit for known secret patterns (Anthropic, OpenAI, AWS, Stripe, etc.).
5. **Bad push protected.** A PR with broken shell syntax cannot merge to `main`.
6. **The 5 existing repos are unchanged.** OPK composes them; never forks, never patches.
7. **Lost USB is revokable.** Owner can disable a specific kit's auto-pull within 5 minutes from any device with `gh` installed.
8. **Brainiac 7 reuse.** owner-brain install delegates to AI-OPS-STARTER's existing `install-windows.ps1`, does not duplicate its logic.
9. **Operator daily-driver brief renders the 4 key sections** (hot leads, today's follow-ups, AIXMOS pitch candidates, overdue payments) on every login using live Supabase + GHL + ClickUp data.
10. **Owner morning brief surfaces revenue, funnel counts, agent activity, top-3 non-negotiables, Brainiac-7 health.**

## Acceptance Tests (concept, to be detailed in implementation plan)

- **AT-1:** Fresh Mac, fresh USB, operator role → reaches daily-driver brief in <20 min. No errors logged.
- **AT-2:** Fresh Windows 11 machine, operator role → same as AT-1.
- **AT-3:** Owner pushes a typo fix to `aixmos-kit/main` → operator's next auto-pull (within 30 min or next login) picks it up.
- **AT-4:** Owner pushes a `.sh` file with a syntax error to a PR → `gate-main.yml` blocks the merge.
- **AT-5:** Owner adds a lost kit-id to `revoked-kits.txt` → that kit's next auto-pull aborts with the contact-owner message.
- **AT-6:** Brainiac-7 is offline → owner brief shows "AI brain: OFFLINE" within 30 min.
- **AT-7:** owner-work fresh install on M1 Max → all 5 repos cloned, build succeeds, `npm run check-env` passes, `npm run build` passes.
- **AT-8:** Operator kit's contents scanned for known secret patterns → zero matches.

## Dependencies

- **GitHub repo** `AIXMOS537/aixmos-kit` must be created (owner) before implementation begins.
- **Tailscale ACL update** required to enforce operator → Open WebUI only (not AIXMOS-AGENTS HTTP).
- **Owner-only secrets vault** (May-22 spec) is NOT a blocker. OPK ships without it.
- **Supabase profiles trigger** (`on_auth_user_created`) already installed — used to auto-create `role=customer` profiles when operators sign up; owner elevates to `role=va` via Supabase dashboard.
- **Home-directory umbrella `~/projects/`** is referenced by owner-work install steps (e.g. clones to `~/projects/TMMT`). This is part of an in-progress home-directory cleanup (Phases 4-6 still paused: archive AIX-Ecosystem, group secrets-vault docs, move active repos under `~/projects/`). The owner-work installer must handle both states: if `~/projects/` exists, use it; if active repos still live at home root (`~/TMMT`, `~/AIXMOS-AGENTS`, etc.), the installer offers to move them or use existing paths in place. Operator role is unaffected (operators don't clone production repos).

## Decisions Locked In Brainstorming

| Decision | Choice |
|---|---|
| Kit shape | ONE universal kit, auto-detects + asks role |
| Operator UX | Thin client — browser + Tailscale only |
| Operator secrets | Zero — sign-in only to owner-granted accounts |
| Update flow | Auto-pull from GitHub on every login + every 30 min |
| Architecture | Approach A — bootstrapper USB + new `aixmos-kit` orchestrator repo |
| Brainiac 7 | Owner machine (profile `owner-brain`), not a separate role |
| Spec location | `~/TMMT/docs/superpowers/specs/2026-05-26-operator-portable-kit-design.md` (existing convention; may migrate to `aixmos-kit/docs/specs/` once that repo exists) |
