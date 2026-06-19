# CEO Brain — always-on, ever-learning infrastructure for executive work

> How the mesh + brain are set up to stay **on**, keep **learning**, and help you
> run the company at the CEO level. Your cockpit is one word: **`ceo`**
> (`scripts/ceo`). This is the operating manual for the whole base.

## The shape (three tiers)

```
  TIER 1 — THE BRAIN (always-on, ever-learning)
    🖥️  M1 Mac at home        — runs HAILMARY/AIXMOS 24/7, absorbs memory, dispatches
    🧠  BRAINIAC (Windows)    — the memory of record (Obsidian vault) + compute/backup

  TIER 2 — THE MESH (private, encrypted, everywhere)
    🔗  Tailscale             — carry Mac · M5 · Surface · phones, all one tailnet
    📋  swarm + master        — shared task board, one source of truth

  TIER 3 — THE WINDOWS (you, anywhere)
    📱  phones / 💻 laptops / 🚗 car — reach the brain; never hold the brain
```

The CEO doesn't sit in Tier 3 typing — the CEO **directs Tier 1** and lets the
brain + swarm do the work.

## What's already ON

- **HAILMARY always-on** — `booyah` installed the LaunchAgent (`com.tmmt.presence`);
  it runs at login, restarts itself, holds presence 24/7 with the lid down.
- **Memory absorb** — every `booyah`/`wake` writes a snapshot to `.hailmary/memory`.
- **The mesh** — devices on Tailscale; `master` is the source of truth; `sync`
  keeps them lockstep.
- **The cockpit** — `ceo` aggregates it all into one screen.
- **Guardrails** — owner seal, vault (TOTP), `dark`/`light`, secret-guard.

## Turn ON "ever-learning" (3 owner taps — do these once)

The brain only truly *compounds* when memory streams to the vault and a local
model can reason over it. Three steps, on the always-on M1:

1. **Local reasoning brain** — install the on-device LLM:
   ```bash
   bash scripts/setup-llm.sh        # word: brain  — picks the model by RAM, installs Ollama
   ```
2. **Bridge BRAINIAC** (the memory vault) — in Tailscale, share BRAINIAC to the
   M1 + enable Tailscale SSH (`docs/AIXMOS-MESH-BLUEPRINT.md` Phase 2).
3. **Stream memory → vault**:
   ```bash
   export HAILMARY_VAULT="brainiac:/Users/brainiac/Obsidian/HAILMARY"   # your path
   bash scripts/mesh/memory-sync.sh install      # word: memory  — push-only, LaunchAgent
   ```
   Now every absorbed snapshot flows into the Obsidian vault — the second brain
   that grows every day. `ceo` will show `memory: streaming → vault`.

## The daily CEO loop (this is the "how")

Run on the carry Mac (or any window) — the brain does the heavy lifting:

```
  ☀️  MORNING                     🌙  THROUGHOUT
  1. ceo        → the cockpit     • decisions land → you decide
  2. watchtower → every vertical  • work appears   → hit 2 (delegate to swarm)
  3. decide the day's 1–3 moves   • leads/clients  → onboard · member join · deal
                                  • capture wins   → wake (brain absorbs, learns)
  🌆  END OF BLOCK
  4. sync       → push the day, keep all devices = 1
```

### What "CEO-level tasks" map to which word
| CEO task | The system does it via |
|---|---|
| See the whole company at a glance | **`ceo`** / **`watchtower`** / **`health`** |
| Delegate execution | **`hit 2`** — AIXMOS dispatches parallel agents on the swarm |
| Grow revenue | **`onboard`** (decode a client) · **`member join`** ($97 program) · **`deal`** (close paperwork) |
| Decide with context | the **local brain** (Ollama) + the **vault memory** reason over your real history |
| Protect the business | **`dark`/`light`**, **`vault`**, **`fix`** (security audit) |
| Never lose knowledge | **`wake`** absorbs → **memory loop** → Obsidian vault (ever-learning) |

## The systematic setup sequence (in order)

**Done (you've run these):** `booyah` (always-on + absorb), seal, vault, the mesh.

**Your remaining taps (one-time, to reach full always-on + ever-learning):**
1. On the **M1**: `bash scripts/setup-llm.sh` (local reasoning brain).
2. In **Tailscale**: share **BRAINIAC** to the M1, enable SSH (Phase 2).
3. On the **M1**: set `HAILMARY_VAULT`, run `memory-sync.sh install` (Phase 3).
4. On **BRAINIAC (Windows)**: `scripts/setup-home-brain.ps1` for always-on +
   the Obsidian vault folder.
5. On **M5 + Surface**: prime them (`docs/PRIME-AND-SYNC.md`) so the mesh is full.
6. Confirm with **`ceo`** — you want: always-on `on`, local brain `ready`,
   memory `streaming → vault`.

## Cadence (so it actually runs you, not the reverse)
- **Daily:** `ceo` → decide 1–3 → `hit` to delegate → `wake` to capture → `sync`.
- **Weekly:** `watchtower` deep pass · review the vault (what the brain learned) ·
  `fix` (security) · advance one vertical/portal.
- **Always:** the M1 stays on; the brain keeps absorbing; the swarm keeps moving.

---

_Companions: `docs/AIXMOS-MESH-BLUEPRINT.md` (always-on + memory phases),
`docs/PRIME-AND-SYNC.md` (the 3 devices), `docs/MESH-SWARM.md` (the swarm),
`docs/LEARN-EARN-CHURN.md` (the program the brain grows). Cockpit: `scripts/ceo`._
