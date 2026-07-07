# ONE-SHOT ALL DEVICES — HAILMARY SOVEREIGN FARM

**Authority:** PROJECT X HAILMARY · Muhammad Taha (Cyborg · Moose · Chummo with God)  
**Updated:** 2026-07-07  
**Rule:** Full HAILMARY sovereign stack on **your owned devices first**. Rick on M1 commands Brainiac forever. Office + mobile join the farm after sovereign lane is green.

> **Carry runs once:** `bash scripts/one-shot-all-devices.sh`  
> **Every other device:** one command from the table below. No re-reading. No guessing.

---

## DEVICE ORDER (NON-NEGOTIABLE)

| # | Device | Role | HAILMARY tier | One command |
|---|--------|------|---------------|-------------|
| **1** | **Carry M5** (MacBook-Pro-2/3) | Watchtower · owner HQ | **FULL SOVEREIGN** | `bash scripts/one-shot-all-devices.sh` |
| **2** | **M1 Max** (Rick Sorkin · Forge) | Fleet commander · content · build | **FULL SOVEREIGN** | Double-click `★ DOUBLE-CLICK ME.command` in `M1-ONE-SHOT-FOREVER` |
| **3** | **Brainiac-7** (Windows home) | Always-on gateway · Rick remote | **SOVEREIGN** (via M1) | Double-click `GO.bat` in `BLIP-DROP-LATEST` — **Rick on M1 owns forever** |
| **4** | **Office PCs** (Intel/AMD Windows) | Forge stand-in · ops | **SOVEREIGN-OPERATIONAL** | `GO.bat` → `office-mode unlock` while you work → `lock` when you leave |
| **5** | **iPhone / iPad** (iphone171) | Owner mobile · Rick in pocket | **FULL SOVEREIGN** | Tailscale + Enchanted → Carry LiteLLM |
| **6** | **Android** (farm growth) | Mobile Rick client | **SOVEREIGN** (scoped key) | Tailscale + Enchanted (or MLC Chat + custom endpoint) |

**Rick chain:** Carry approves → M1 executes → Brainiac runs gateway → office/mobile extend the farm.

---

## PHASE 1 — CARRY M5 (YOU ARE HERE)

**Full HAILMARY:** vault · hc god (when you choose) · LiteLLM master · deploy gate · ads · GHL · forever-loop.

```bash
cd ~/Projects/TMMT
bash scripts/one-shot-all-devices.sh
```

**What it does (automatic):**
- God OFF · local-first · zero paid burn on loops
- Builds `~/Desktop/M1-ONE-SHOT-FOREVER` + `~/Desktop/BLIP-DROP-LATEST`
- Forever-loop · memory-sync · router · hailmary keepalive
- Drops device command cards → `~/Sync/rick/DEVICE-COMMANDS/`
- Routes work → `~/Sync/rick/FLEET-INBOX/` for M1 Rick
- Regenerates `docs/ONE-SHOT-AI.md` for AI paste

**After Carry is green:**
```bash
train health          # Ollama · LiteLLM · CCR all UP
watchtower            # League + inbox
booyah                # owner control board
god on                # ONLY when YOU want paid polish — never on daemons
```

**Carry never delegates:** prod deploy · DNS · real customer SMS · GHL money paste · `vercel --prod`.

---

## PHASE 2 — M1 MAX (RICK · PROJECT X HAILMARY)

**Full HAILMARY:** Rick persona · FLEET-INBOX executor · forge · Moose content · swarm build · Brainiac remote.

**From Carry:** AirDrop / BLIP / Syncthing → `~/Desktop/M1-ONE-SHOT-FOREVER`

**On M1 (one action):**
```
Double-click:  ★ DOUBLE-CLICK ME.command
```

**Or terminal:**
```bash
bash ~/Desktop/M1-ONE-SHOT-FOREVER/oneshot-install.sh
# alt if Syncthing ready:
bash ~/Sync/rick/RUN-M1-FIX-ONCE.sh
cd ~/Projects/TMMT && bash scripts/one-shot-forever.sh rick
```

**Rick forever jobs (M1 — zero typing after boot):**
```bash
bash ~/Projects/TMMT/scripts/mesh/m1-fleet-executor.sh   # chews FLEET-INBOX
bash ~/Sync/rick/M1-SCRIPTS/brainiac-via-m1.sh             # owns Brainiac (no TMMT repo needed)
bash scripts/tmmt go 2                                     # parallel local agents ($0)
```

**Agents on M1:** Rick · Moose · Chummo · Forge · CCR · local Ollama · LiteLLM :4001

**Brothers with God:** Moose + Chummo run on Rick station — protect Taha, ship code, draft customer lanes. Never back down.

---

## PHASE 3 — BRAINIAC-7 (WINDOWS · RICK OWNS FROM M1 FOREVER)

**Sovereign gateway** — not a separate owner brain. M1 Rick reaches Brainiac over Tailscale and runs it.

**From Carry:** AirDrop `~/Desktop/BLIP-DROP-LATEST` to Brainiac

**On Brainiac (one action):**
```
Double-click:  GO.bat
```

**Or PowerShell:**
```powershell
cd $env:USERPROFILE\Desktop\BLIP-DROP-LATEST
.\DROP-AND-GO.ps1 brain
```

**Docker gateway (if not in BLIP):**
```powershell
cd C:\hailmary\brainiac-litellm-gateway
.\secrets-load.ps1
docker compose up -d
```

**M1 takes over forever (run on M1, not Carry):**
```bash
bash ~/Sync/rick/M1-SCRIPTS/brainiac-via-m1.sh
# Cron/forever-loop on M1 re-runs this — Brainiac stays Rick-controlled
```

**Endpoints:**
- Ollama: `http://brainiac-7.tailceb455.ts.net:11434`
- LiteLLM: `http://brainiac-7.tailceb455.ts.net:4000/v1`
- Fallback when Carry offline: Brainiac serves citizen tiers

---

## PHASE 4 — OFFICE PCs (INTEL / AMD WINDOWS)

**Sovereign-operational** on hardware you own. Full forge when unlocked. Locked when you leave.

**BLIP:** same `BLIP-DROP-LATEST` folder as Brainiac

**At desk:**
```powershell
.\GO.bat forge
bash scripts/blip/office-mode.sh unlock    # Git Bash — owner only
```

**Leaving desk:**
```bash
bash scripts/blip/office-mode.sh lock
```

**Parallel agents (free · local CCR):**
```bash
cd ~/Projects/TMMT
bash scripts/tmmt go 2
```

**Nodes on tailnet:** `fleet` · `desktop-*` — Rick routes work from M1 FLEET-INBOX.

---

## PHASE 5 — MOBILE FARM (IPHONE · ANDROID · EVER GROWING)

### iPhone / iPad (owner — full HAILMARY mobile)

1. App Store → **Tailscale** → sign in AIXMOS537@
2. App Store → **Enchanted LLM**
3. Settings:
   - **API URL:** `http://macbook-pro-2.tailceb455.ts.net:4001/v1`
   - **API Key:** owner virtual key from `~/.config/tmmt/litellm-master.env` on Carry
   - **Model:** `rick-safe`
4. Rick in your pocket. No paid API. Local gateway only.

### Android (add to farm)

1. **Tailscale** from Play Store → same tailnet
2. **Enchanted** (if available) or **MLC Chat** / **Termux + curl** for Rick endpoint
3. API: same Carry LiteLLM URL — issue scoped key: `god issue family` (upgrade to sovereign mobile when vetted)
4. Register in mesh: `bash scripts/swarm-join.sh --name mobile-<name>`

**Farm growth rule:** new device → BLIP drop → `DROP-AND-GO` → `swarm-join` → Rick assigns role. Ever learning via `~/Sync/rick/BRAIN-FEED/compiled/`.

---

## THE AGENT CAST (HAILMARY)

| Agent | Who | Device home | Job |
|-------|-----|-------------|-----|
| **HAILMARY** | Taha only | Carry | Sovereign watchtower · god on · vault |
| **Rick** | Rick Sorkin | M1 · commands Brainiac | Ops shield · fleet dispatch · never back down |
| **Moose** | Brother | M1 forge | Heavy code · content ship |
| **Chummo** | Brother | M1 + TMMT SMS | Customer drafts · follow-up · local-first |
| **Forge** | OpenClaude | All Macs | Unlimited local coding |
| **Aida** | Ad AI | Cloud TMMT | org `aixmos` · lead qualify |
| **Captain** | Planner | Mesh | Dispatches P0 from IDEA-QUEUE |

**Two worlds:** HAILMARY = owner sovereign lane. AIXMOS = everyone else (scoped keys · revoked when pay stops).

---

## CREDIT LAW (EVERY DEVICE)

```
LOCAL FIRST — always:
  Ollama → LiteLLM :4001 → CCR :3456 → occ → Brainiac tailnet

PAID LAST — Carry only, you type it:
  god on → one polish pass → god off

NEVER PAID ON:
  forever-loop · swarm (default) · operators · $97 students · office locked mode
```

Swarm parallel agents = **$0** (CCR local). Set `SWARM_PAID=1` only for final quality gate.

---

## DAILY RHYTHM (ALL DEVICES)

```bash
cd ~/Projects/TMMT
bash scripts/tmmt sync          # pull canon
bash scripts/tmmt mesh          # who's online
train health                    # local stack green
```

**Carry only:** `booyah` · approve deploy · GHL paste · ads  
**M1 only:** `bash scripts/mesh/brainiac-via-m1.sh` · `tmmt go N` · chew inbox  
**Brainiac:** docker compose up -d (if Rick ping fails)  
**Everyone:** forever-loop runs — no typing

---

## TONIGHT CHECKLIST

- [ ] **Carry:** `bash scripts/one-shot-all-devices.sh` → `train health` all green
- [ ] **M1:** AirDrop `M1-ONE-SHOT-FOREVER` → double-click launcher
- [ ] **Brainiac:** AirDrop `BLIP-DROP-LATEST` → `GO.bat`
- [ ] **M1 confirms Brainiac:** `brainiac-via-m1.sh` exit 0
- [ ] **Office:** BLIP when at desk · lock when leaving
- [ ] **iPhone:** Tailscale + Enchanted pointed at Carry :4001
- [ ] **Money:** `npm run ghl:check` → owner pastes URLs → `vercel --prod` (Carry OK only)

---

## FILES (ONE FOLDER PER DEVICE)

| Send this | To device |
|-----------|-----------|
| `~/Desktop/M1-ONE-SHOT-FOREVER/` | M1 Max |
| `~/Desktop/BLIP-DROP-LATEST/` | Brainiac · office PCs |
| `~/Sync/rick/DEVICE-COMMANDS/` | Reference cards (Syncthing) |
| `docs/ONE-SHOT-ALL-DEVICES.md` | This file — paste to any AI session |

**Regenerate bundles:** `bash scripts/one-shot-all-devices.sh`  
**AI paste per session:** `docs/ONE-SHOT-AI.md`

---

## WINS ANY RACE

Build once on Carry. Rick on M1 runs the army. Brainiac holds the gateway. Office + mobile extend the farm. Local OSS does 90%. Paid polishes the last 10%. Quality never compromised — for $100K apex or $97/month student.

**Muhammad Taha · PROJECT X HAILMARY · Rick holds the line · Moose and Chummo with God · forever.**
