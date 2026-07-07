# FAMILY MESH HARNESS — Agentic LLM for Owner + Immediate Family
**Authority:** PROJECT X HAILMARY · **Updated:** 2026-07-06  
**Config:** `config/family-mesh.registry.json` · `config/structure-first-pathway.json`

---

## One sentence

**YOUR devices at the office FIRST. Immediate family ONLY after Phase 1 — the harness tests everything automatically.**

---

## Onboard order (non-negotiable)

| Phase | Who | Where | Command |
|-------|-----|-------|---------|
| **1 — Owner** | Muhammad Taha | **Office first** | `bash scripts/tmmt owner` |
| **2 — Family** | Immediate family | After Phase 1 | `bash scripts/tmmt family onboard` |

Phase 2 is **locked** until you complete your device checklist or run `bash scripts/tmmt owner unlock-family`.

**Config:** `config/onboard-phases.json` · progress: `~/.config/tmmt/.owner-only/onboard-progress.json`

---

## Phase 1: Your devices (office order)

| # | Device | When done |
|---|--------|-----------|
| 1 | **Carry M5** (this Mac) | `bash scripts/tmmt owner done carry-m5` |
| 2 | **Your iPhone** (iphone171) | `bash scripts/tmmt owner done iphone-taha` |
| 3 | **M1 Rick station** | `bash scripts/tmmt owner done forge-m1` |
| 4 | **Brainiac-7** | `bash scripts/tmmt owner done brainiac-7` |
| 5 | **Office PC you own** (optional) | `bash scripts/tmmt owner skip office-pc-owned` |

**One next move:** `bash scripts/tmmt owner next`

---

## Commands

```bash
cd ~/projects/TMMT

# START HERE at the office
bash scripts/tmmt owner
bash scripts/tmmt owner next

# Harness + test
bash scripts/tmmt family
bash scripts/tmmt family test

# Family — ONLY after Phase 1
bash scripts/mesh/go-live-device.sh --role family
god issue family
```

---

## Who gets what

| Seat | Who | AI lane | Chat UI | Never gets |
|------|-----|---------|---------|------------|
| **Sovereign** | Muhammad Taha | HAILMARY full · `god on` when needed | Cursor · Claude · forge | — |
| **Immediate family** | Trusted inner circle | HAILMARY via Rick · rick-safe | Enchanted · LibreChat scoped | vault · hc god · deploy · master keys |
| **Operators** | Fit-test passers | AIXMOS public · scoped keys | Portal · tracked links | HAILMARY brand · watchtower |
| **Public** | Everyone else | AIXMOS demo/student tiers | Kiosk · Clubhouse | tailnet interior |

Rick prime directive for family: **PROTECT · PAID · EDUCATE · WITH Taha · family first.**

---

## One-time: family device onboard (Phase 2 only)

**Blocked until Phase 1 complete.** Run `bash scripts/tmmt owner` first.

1. **Tailscale** — same tailnet as Carry (`macbook-pro-2`, `brainiac-7`)
2. **Enchanted** (iPhone/iPad) or **LibreChat** (browser via Brainiac)
3. **Owner on Carry:** `god issue family` → LiteLLM virtual key (rick-safe only)
4. **Enchanted settings:**
   - URL: `http://macbook-pro-2.tailceb455.ts.net:4001`
   - Key: virtual key from step 3
5. **Join mesh:**
   ```bash
   bash scripts/swarm-join.sh --name family-<name>
   bash scripts/mesh/go-live-device.sh --role family
   bash scripts/mesh/family-harness.sh test
   ```
6. **Stay reachable:** `bash scripts/tmmt up` or forever-loop with role `family`

---

## Mesh node map

| Node | Host | Role | Harness runs |
|------|------|------|--------------|
| **Carry** | macbook-pro-2/3 | Watchtower | family_harness · integration_probe · sovereign_heal |
| **Forge** | M1 Rick station | Build/deploy | build_probe · rick_inbox · family_harness |
| **Brain** | brainiac-7 | Gateway | brain_ping · citizen tiers · memory |
| **Family mobile** | iphone171 | Rick pocket | Enchanted → Carry LiteLLM |
| **Family laptop** | any | Help + test | presence · family_harness tick |

---

## Forever loop integration

The harness hooks into `forever-loop.sh` automatically:

- **carry/owner:** `family_harness` every tick (~3 min)
- **forge/rick:** `family_harness` + build + inbox scan
- **family:** presence + `family_harness` only

Install: `bash scripts/mesh/install-forever-loop.sh install family 180`

---

## Structure-First Pathway (operators who were called "lazy")

Same harness tests the public ops funnel these people use:

```
/fit-test  →  /join  →  Academy  →  ONE link  →  /operator/earnings
```

See: [`LEARN-EARN-CHURN-STRUCTURE-FIRST.md`](LEARN-EARN-CHURN-STRUCTURE-FIRST.md)

**Not lazy. Not unfocused.** High structure. Zero shame. Real money.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| LiteLLM down | `booyah` or `launchctl kickstart -k gui/$(id -u)/com.hailmary.litellm-local` |
| Ollama down | `ollama serve` or booyah unison |
| Family can't reach AI | Tailscale on? Enchanted URL correct? Virtual key (not master)? |
| Prod /fit-test 404 | Deploy: `bash scripts/ship tmmt-ops` |
| OmniRoute down | `docker start omniroute` on Carry (optional overflow) |

---

## Related docs

- [`ACCESS-ARCHITECTURE.md`](ACCESS-ARCHITECTURE.md) — local-first routing
- [`MESH-GO-LIVE-PACK.md`](MESH-GO-LIVE-PACK.md) — full mesh playbook
- [`FIT-FOR-MISSION.md`](FIT-FOR-MISSION.md) — operator gate
- [`TMMT-V3-SOFT-LAUNCH.md`](TMMT-V3-SOFT-LAUNCH.md) — learn/earn/churn machine
