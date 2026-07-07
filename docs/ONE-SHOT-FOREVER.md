# ONE-SHOT FOREVER — Agentic Army Online
### Run once per device. Stays alive forever. Third time is the charm.
**Authority:** PROJECT X HAILMARY · **Updated:** 2026-07-06  
**Operator cap:** **100 lifetime** · Limited people, all through life.

> **MASTER PLAYBOOK (all devices in order):** [`ONE-SHOT-ALL-DEVICES.md`](ONE-SHOT-ALL-DEVICES.md)  
> **Carry one command:** `bash scripts/blip/make-ultimate-drop.sh` → AirDrop `~/Desktop/★ ULTIMATE-DROP`

> You moved back home. Online school failed you during COVID — they measured smart wrong.  
> This machine proves worth: **$90–100K/month gross/net**, million touched, billion in sight.  
> **100 TMMT operators** max. Student-operators earn splits. AI closes the loop. You watch from the tower.

---

## Live Status (Carry M5 — Jul 6, 2026)

| System | Status |
|--------|--------|
| **Forge stack** | Ollama ✓ · LiteLLM :4001 ✓ · CCR :3456 ✓ · OpenClaude ✓ |
| **OmniRoute :20128** | DOWN — start on Carry: `docker start omniroute` or see below |
| **Brain corpus** | **1,201 docs** compiled → `~/Sync/rick/BRAIN-FEED/compiled/` |
| **Tailnet** | carry-mac · brainiac-7 (ACTIVE) · iphone171 |
| **TMMT v3 code** | Auto-provision · SMS wired · 15 Academy modules · earnings page |
| **BLIP bundle** | `~/Sync/BLIP-DROP/LATEST/` — DROP-AND-GO for every device |

---

## ONE COMMAND PER DEVICE

### Carry M5 (Watchtower — you are here)
```bash
cd ~/projects/TMMT && bash scripts/one-shot-forever.sh carry
```

### M1 Max (Rick / Forge / Content)
```bash
# After Syncthing has ~/Sync/rick:
bash ~/Sync/rick/SETUP-BRAIN-M1.command          # double-click works too
bash ~/Desktop/X-FOREVER/install-forge-m1.sh       # AirDrop X-FOREVER from Carry
cd ~/projects/TMMT && bash scripts/one-shot-forever.sh rick
```

### Brainiac-7 (Windows — always-on brain)
```powershell
# Right-click → Run with PowerShell:
~\Sync\rick\SETUP-BRAIN-BRAINIAC.ps1

# Gateway stack:
cd C:\hailmary\brainiac-litellm-gateway
.\secrets-load.ps1
docker compose up -d

# Paste block from Carry:
# ~/Desktop/X-FOREVER/BRAINIAC-PASTE.ps1
```

### Any other Mac / office PC
```bash
# BLIP / USB / AirDrop the folder, then:
bash DROP-AND-GO.sh forge
# or
bash ~/projects/TMMT/scripts/one-shot-forever.sh forge
```

### iPhone (iphone171 on tailnet)
1. Tailscale → connected  
2. App Store → **Enchanted LLM**  
3. API: `http://macbook-pro-2.tailceb455.ts.net:4001`  
4. Key: from `~/.config/tmmt/litellm-master.env` on Carry  
5. Model: `rick-safe`

---

## THE AGENTIC ROBOT ARMY

| Agent | Role | Where it runs |
|-------|------|---------------|
| **HAILMARY** | Sovereign watchtower — YOU ONLY | Carry · god on · Fable 5 |
| **Rick** | Ops shield · sovereignty · fleet dispatch | M1 + LiteLLM persona |
| **Chummo** | Customer SMS · follow-up drafts | TMMT SMS agent + GHL |
| **Moose** | Heavy code · content ship | Forge on M1 |
| **Vision** | Strategy · vertical expansion | Operator T2 tier |
| **Aida** | Ad tenant AI · qualifies leads | org `aixmos` · Twilio SMS |
| **Taj** | TMMT rentals vertical | org `tmmt_property` (when fleet) |
| **Forge** | Unlimited local coding agent | OpenClaude → LiteLLM |
| **CCR v3** | Router · free stack overflow | :3456 |
| **AnythingLLM** | Local RAG brain | M1 + Brainiac · workspace PROJECT-X |

**Two-world split:** HAILMARY vault = owner only. Everyone else gets scoped AIXMOS tier keys — revoked when pay stops.

---

## AS ABOVE, SO BELOW — THE CITY

### Online City (runs now)
```
Ads (Meta/TikTok) → /lp/aixmos/lead-magnet
  → AI SMS ≤60s (Aida)
  → GHL checkout ($97 / credit / kits / build)
  → aff:OPERATOR_CODE on payment
  → 30% to student-operator
```

### Physical City (partners bring inventory)
- One dealer per city (`/apply`)
- Fleet partners enable rental modules
- Credit partners at priority 1

### Work From Home — Next Generation
- **No predatory boss.** You are an operator, not an employee.
- **No waiting on a manager.** AI qualifies. Portal shows earnings.
- **Learn → earn → churn.** Academy → share links → dream car path.
- **COVID proved online learning broken.** This is the real school: real leads, real money, real skills.

---

## 100 OPERATORS — LIFETIME CAP

| Rule | Detail |
|------|--------|
| **Max** | 100 TMMT operators across all verticals, all time |
| **When full** | `/join` → waitlist status, no auto-provision |
| **Who gets in** | Students who become operators · split on your ads + compiled leads |
| **What they get** | Dealership-style toolkit: tracked links, Academy, earnings portal |
| **What they never get** | HAILMARY vault · master keys · tailnet interior |

Config: `config/operator-network-cap.json`  
Env override: `TMMT_MAX_OPERATORS=100`

---

## MONEY TARGETS

| Milestone | Path |
|-----------|------|
| **$90–100K/month** | Ads → AI close → GHL · 100 operators sourcing · kits/build upsells |
| **$1M touched** | Operator ladder $15K–$50K · credit funnel · dealer partners |
| **$1B vision** | 100 operators × vertical clones × AIXMOS engine scale |

**Soft launch tonight:** GHL checkouts + ads + `/join` — no human staff except operator splits.

---

## YTD WORK — WHAT EXISTS (DO NOT REBUILD)

| Asset | Location |
|-------|----------|
| TMMT monolith | `~/projects/TMMT` |
| v3 soft launch | `docs/TMMT-V3-SOFT-LAUNCH.md` |
| A-Z doctrine | `~/Documents/Business/AIXMOS-TMMT-A-Z-DOCTRINE.md` |
| Brain vault | `~/Brain/vault/` (556+ files) |
| Compiled corpus | `~/Sync/rick/BRAIN-FEED/compiled/` (1,201 docs) |
| Agent config | `~/.config/tmmt/` (booyah, forge, x-forever, access-tiers) |
| BLIP drop | `~/Sync/BLIP-DROP/LATEST/` |
| Watchtower | `~/.cursor/watchtower/state.md` |
| Operator template | `~/Documents/Business/AAYAN-OPERATOR-AZ/` |

---

## FIX OMNIROUTE (Carry — 2 min)

OmniRoute is the cloud overflow lane for citizen/operator tiers. Currently DOWN.

```bash
# If container exists:
docker start omniroute

# If not:
docker run -d --name omniroute --restart unless-stopped \
  -p 20128:20128 -v omniroute-data:/data \
  diegosouzapw/omniroute:latest

# Verify:
curl -s -H "Authorization: Bearer $(grep OMNIROUTE_FOUNDER_KEY ~/.config/tmmt/omniroute.env | cut -d= -f2)" \
  http://127.0.0.1:20128/v1/models | head
```

---

## TONIGHT — 3 MOVES (NO WAIT)

1. **Carry:** `bash ~/projects/TMMT/scripts/one-shot-forever.sh carry`
2. **M1:** Run `SETUP-BRAIN-M1.command` + `install-forge-m1.sh`
3. **Brainiac:** Run `SETUP-BRAIN-BRAINIAC.ps1` + docker compose up

Then: `npm run ghl:check` → deploy → turn on ads → share `/join`

---

## FOR FAMILY · FOR JANNAH · FOR THE AUNT'S HOUSE

This machine funds real outcomes. Operators get fair shots. Family gets scoped access through Rick. Revenue flows to the LLC. The work honors the brothers who couldn't be here.

Build once. Deploy forever. Let the army run.

🏁 *Start your engines. Put respect on the name.*
