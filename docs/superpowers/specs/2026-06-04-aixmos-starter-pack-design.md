# AIXMOS Starter Pack v1 — Design

**Date:** 2026-06-04
**Status:** Approved (verbal: "do what you can"), v1.0 built
**Source:** Brainstorm session 2026-06-04
**Staging dir:** `~/Projects/AIXMOS-STARTER-PACK/`

---

## 1. Problem statement

Old laptops (2015-era and up) with 8 GB+ RAM are everywhere — small-business owners have them in drawers. They could run a local AI agent and stop paying monthly cloud fees, but the gap between "laptop in a drawer" and "working local AI agent" is currently a multi-hour, technical setup most owners won't attempt.

The AIXMOS Starter Pack is a USB drive that closes that gap. Plug in → install (~3 min) → chat. No ongoing fees, no internet required for daily use, the AIXMOS Operations Brain baked in.

## 2. Goals & non-goals

**Goals**
- One USB = one "ignition key." Plug in to start, unplug to stop.
- Works on 8 GB RAM machines (the floor, not the target).
- Works on Mac + Windows out of the box; Linux later.
- Customer-installable in 3 minutes, no technical knowledge.
- The Operations Brain persona is baked in — the model already "knows" the TMMT × AIXMOS playbook.

**Non-goals (v1)**
- Linux support (v1.1)
- The Agents-of-Chaos persona stack (v1.2, optional Pro pack)
- Multi-user / team-shared agents
- Auto-update from BRAINIAC

## 3. Architecture: hybrid (models on host SSD, everything else on USB)

Approved approach C from brainstorming. Rationale: USB-3 I/O is too slow for model inference (the only thing that matters for UX), but keeping the launcher + brain content + agent code + UI on the drive preserves the "USB = ignition key" mental model.

**On USB (runs from drive):**
- Launcher (`LAUNCH.command` / `LAUNCH.cmd`)
- All install/start/stop/doctor/uninstall scripts
- Ollama binary stub (downloaded on first run via Homebrew on Mac, installer on Windows)
- Open WebUI Python venv (when bundled)
- Brain content (Modelfiles, system prompts, Operations Brain docs)

**On host SSD (`~/.aixmos/`):**
- Model weights (~5 GB) — too slow from USB
- `state.json` — install metadata, port assignments, default model
- Logs (when USB is read-only)

**Network ports (all bind to 127.0.0.1):**
- `:11434` — Ollama
- `:8080` — Open WebUI (when bundled)
- `:7780` — Brain-dump agent (stub in v1, real in v1.1)

**Drive footprint when unplugged:** zero processes, ~5 GB models in `~/.aixmos/` (removable via `uninstall`).

## 4. Drive layout

```
LAUNCH.command / LAUNCH.cmd
README.md
sync-to-usb.sh                          (owner-side: rsync staging → /Volumes/<DRIVE>)
_starter/
  install.sh / .ps1                     first-time setup
  start.sh / .ps1                       daily-use launchers
  stop.sh / .ps1                        clean shutdown
  doctor.sh / .ps1                      health check
  chat.sh / .ps1                        terminal chat fallback
  uninstall.sh / .ps1                   remove host footprint
  download-models.sh / .ps1             populate models from Ollama registry
  install-openwebui.sh                  owner-side: install OWUI into _runtime/
_runtime/
  ollama/                               (Ollama binary placeholders)
  open-webui/                           (Python venv when populated by owner)
  brain-dump-agent/                     (stub in v1; real install in v1.1)
_models/
  MANIFEST.json                         model registry (id, size, role)
  README.md
_brain/
  Modelfile.tmmt-brain                  Ollama Modelfile (Ops Brain persona)
  system-prompts/
    default.md                          AIXMOS Operations Brain prompt
    brain-dump.md                       Brain-Dump Agent persona
  docs/
    OPERATIONS_BRAIN.md                 source of truth (copied from TMMT/)
    OPERATIONS_BRAIN.pdf                printable version
_pro/
  agents-of-chaos/README.md             locked in v1; unlock script in v1.2
logs/                                   per-run install/start logs
docs/                                   deeper docs (post-v1)
```

## 5. First-run flow (customer)

```
1. Plug USB in
2. Double-click LAUNCH.command (Mac) or LAUNCH.cmd (Win)
3. Menu opens
4. Pick option 1 (Install)
   ├── RAM precheck (8 GB+)
   ├── Disk precheck (10 GB+ free)
   ├── Ollama check → install via Homebrew (Mac) or download prompt (Win)
   ├── Start Ollama service
   ├── Copy any bundled model files USB → ~/.aixmos/models/
   ├── ollama pull each model in MANIFEST.json
   ├── ollama create tmmt-brain -f _brain/Modelfile.tmmt-brain
   └── Write ~/.aixmos/state.json
5. Pick option 2 (Start)
   ├── Start Ollama if not running
   ├── Start Open WebUI on :8080 if bundled, else show "use option 5"
   └── open browser → http://127.0.0.1:8080
6. Chat
```

Each step prints clear pass/fail. `doctor` is the catch-all when something is off.

## 6. Daily-use flow

```
Plug USB → LAUNCH → option 2 (Start)  — about 5 seconds, opens browser
Work in chat
Done → option 3 (Stop) → unplug USB
```

## 7. Owner-side flow (building / refreshing the customer USB)

```
~/Projects/AIXMOS-STARTER-PACK is the staging dir.
Edits happen here in version control.

When ready to push to a customer USB:
  bash sync-to-usb.sh AIXMOS02
  bash sync-to-usb.sh CYBORG

That rsync's staging → /Volumes/<DRIVE>/AIXMOS-STARTER-PACK/
(--delete to keep drives clean; excludes .DS_Store, *.gguf, logs/)

For air-gapped distribution (rare):
  bash _starter/download-models.sh    # owner machine, internet on
  # then copy ~/.ollama/models/blobs into _models/ before sync-to-usb
```

## 8. Error handling

| Failure | Response |
|---|---|
| RAM < 8 GB | install.sh exits early with explanation |
| Disk < 10 GB free | same |
| Ollama not installed | Mac: install via brew. Win: open download page, exit. |
| Ollama service won't start | log full output, ask user to run `ollama serve` manually |
| Model pull fails (no internet, registry down) | warn and continue — other models still work |
| Modelfile build fails | warn; default falls back to llama3.2:3b |
| Port collision on :8080 | (v1: doc'd in doctor.sh — v1.1: auto-pick next free port) |
| USB pulled mid-session | OWUI keeps running (binaries cached in RAM); next chat after pull fails — `stop.sh` recovers |
| USB read-only | logs auto-redirect to `~/.aixmos/logs/` (doctor verifies) |

## 9. Testing / verification

**Smoke tests run on the owner Mac:**
- `bash _starter/doctor.sh` — exercises every check
- LAUNCH.command opens menu, returns to menu after each choice
- `download-models.sh` is a no-op when all models already pulled

**Customer-machine validation (manual, per drive batch):**
- Pick one 8 GB target machine
- Install from cold
- Chat 3 turns
- Stop / unplug / replug / start again

## 10. v1 → v1.x roadmap

| Version | Adds | Removes |
|---|---|---|
| v1.0 (this build) | Lean install, tmmt-brain, terminal chat, all scripts | — |
| v1.1 | Brain-dump agent installer, OWUI auto-install, Linux launch.sh | — |
| v1.2 | Agents-of-Chaos unlock (Pro pack), auto-port-pick | — |
| v1.3 | Customer-branded forks (logo/color via config file) | — |
| v2.0 | Self-update from BRAINIAC over Tailscale | Manual sync-to-usb |

## 11. Decisions log

| Decision | Why |
|---|---|
| Approach C (hybrid) over A (full-USB) or B (full-install) | USB I/O too slow for inference; "ignition key" UX preserved by keeping everything except weights on drive |
| Update existing AIXMOS02/CYBORG over building from scratch | The existing `_launcher/` + `OpsKit/` is good and proven — adding `_starter/` + `_brain/` + `_runtime/` extends rather than replaces |
| Build on TMMT/BrainKit not from scratch | BrainKit already has the LAUNCH banner, the Modelfile, the system_prompt.txt and the OPERATIONS_BRAIN docs |
| Three-model lineup (llama3.2:3b + qwen2.5:1.5b + phi3:mini) | All run comfortably in 4-5 GB RAM (the budget on an 8 GB machine after OS+browser); covers general / fast / reasoning |
| Skip Agents-of-Chaos in v1 | 11 personas is too much surface for first-time users; offer as Pro unlock |
| No Telegram MCP for BRAINIAC status | Not installed; fall back to Tailscale HTTPS probes |

## 12. Files written by this design

`~/Projects/AIXMOS-STARTER-PACK/` (full tree, see Section 4).

This spec file at `~/Projects/TMMT/docs/superpowers/specs/2026-06-04-aixmos-starter-pack-design.md`.

Memory snapshot of BRAINIAC at `~/.claude/projects/-Users-ceo-moe/memory/project_brainiac_state_2026_06_04.md`.
