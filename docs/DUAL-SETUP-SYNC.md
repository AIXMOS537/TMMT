# Dual Setup Sync — universal spine (you first, operators later)

**Owner:** Muhammad Taha · **Status:** v1 spec + local registry + CLI  
**Idea:** Every person on the network runs a **dual pair** — **mobile** (moves with them) + **brain** (always-on home/office node). One registry. Same pattern for you, Moe Legacy, and every paid operator after.

Plain rule: **data syncs through the tailnet + shared store, not iCloud across Apple IDs.** Voice and messages sync through the **inbox + draft ladder**, not auto-blast.

> **Secrets off git.** Real numbers, tokens, and handles live in `config/dual-sync.registry.local.yaml` (gitignored). Example: `config/dual-sync.registry.example.yaml`.

---

## The dual pair (every principal)

```
┌─────────────────┐         Tailscale + NAS          ┌─────────────────┐
│  MOBILE         │ ◄────── sync store / inbox ─────► │  BRAIN          │
│  (lid closes OK)│         draft approve flow        │  (always-on)    │
│  carry-mac      │                                   │  brainiac-mac   │
│  phone(s)       │                                   │  home line      │
└─────────────────┘                                   └─────────────────┘
         │                                                      │
         └──────────── same principal, same voice ladder ───────┘
```

| Role | Job | Examples |
|---|---|---|
| **Brain** | Intake, memory, draft queue, local LLM, iMessage/Telegram listeners | `brainiac-mac`, future `office-brain` |
| **Mobile** | Command, approve drafts, capture on the move | `carry-mac`, iPhones, operator laptop |

You can add devices anytime. Registry version bumps when schema changes — `scripts/dual-sync/upgrade.py` migrates forward.

---

## What syncs (modules)

| Module | What it syncs | Default tier |
|---|---|---|
| `mesh_inbox` | Captures, notes, voice drops → shared store | Everyone |
| `brother_layer` | Texts → learn → draft → send-as-you ladder | Owner first |
| `command_router` | `TMMT …` from any channel → agents / ops | Owner + paid ops |
| `voice_cards` | Per-contact codeswitch profiles | Everyone (scoped) |
| `memory_vault` | HAILMARY absorb → Obsidian vault | Owner; operator fenced |
| `operator_portal` | Branded login, org-scoped data | Paid operators |

Modules are **on/off per principal** in the registry. Operators buy BUILD rungs + RUN seats — see `docs/OFFER-STACK.md` and **Commercial** below.

---

## Universal registry (one file per machine copy)

Each brain node holds `config/dual-sync.registry.local.yaml`:

- **`schema_version`** — bump + run upgrade when format changes
- **`principals`** — you, Moe Legacy, future agency owners
- **`devices`** — mesh name, role, principal, channels
- **`phone_numbers`** — E.164 → device + forward rules (local only)
- **`sync_pairs`** — mobile ↔ brain binding + sync store path
- **`modules`** — enabled features + version pins
- **`commercial`** — pricing policy (fixed; price-match rules)

Validate anytime:

```bash
npm run dual-sync:doctor
# or: python3 scripts/dual-sync/registry.py validate
```

---

## Learning ladder (same for owner and operators)

| Stage | Sends as principal? | Who |
|---|---|---|
| `observe` | No — log only | New contact |
| `draft` | No — proposes | Default |
| `draft_nudge` | No — pings mobile | Urgent |
| `auto_template` | Yes — fixed templates | Compliance-safe |
| `auto_voice` | Yes — learned voice | Owner toggle per contact |

Money, legal, access, deploy: **draft only** unless principal types yes. Operators never get owner break-glass modules.

Voice cards live in gitignored `config/voice-cards/<principal-id>.local.yaml`.

---

## Setup — owner (you) first

```bash
cd ~/Projects/TMMT
cp config/dual-sync.registry.example.yaml config/dual-sync.registry.local.yaml
cp config/hailmary-brother.example.yaml config/hailmary-brother.local.yaml
# Edit both .local files — numbers stay local

bash scripts/dual-sync/init.sh owner
bash scripts/hailmary booyah
bash scripts/setup-mac-imessage-bridge.sh   # on brainiac-mac
# iPhone: Text Message Forwarding → brain ON
```

**Brain machine:** run `init.sh` + always-on agents on `brainiac-mac`.  
**Mobile:** `swarm-join --name carry-mac`, approve drafts from phone/Mac.

---

## Setup — operator (later, paid)

Same registry shape, fenced principal:

```bash
bash scripts/dual-sync/init.sh operator --org moe-legacy --mesh moe-legacy
```

Operator gets: mobile node + hosted brain on spine (no HAILMARY, no owner keys). Modules gated by what they paid — BUILD rung + RUN seat from `OFFER-STACK.md`.

Provision after contract + payment: `npm run provision:tenant-seat -- … --apply`

---

## Commercial (fair, fixed — price match when needed)

| Rule | Detail |
|---|---|
| **List price** | `docs/OFFER-STACK.md` — BUILD once + RUN monthly + seats |
| **Default** | Fair and **non-negotiable** on list price |
| **Price match** | If they show a **written competitor quote** for the same scope, match up to registry `commercial.price_match.max_discount_pct` (default 10%). Proof required. Owner approves. |
| **Excluded** | Owner-only modules (`brother_layer` full, HAILMARY apex), already-discounted founding terms |
| **Goal** | Close into the ecosystem — network + movement — not race to the bottom |

Recorded in registry under `commercial:` — operators inherit policy from spine unless org override in signed deal.

---

## Upgrade path (as you add devices / numbers)

1. Edit `dual-sync.registry.local.yaml` — add device, number, or module
2. `python3 scripts/dual-sync/registry.py validate`
3. `python3 scripts/dual-sync/upgrade.py` — migrate DB if schema bumped
4. On new machine: `bash scripts/swarm-join.sh --name <mesh-name>`
5. `bash scripts/dual-sync/init.sh sync --mesh <name>`

No rebuild. Registry is source of truth; docs and scripts follow.

---

## File map

| Path | Purpose |
|---|---|
| `docs/DUAL-SETUP-SYNC.md` | This spec |
| `docs/HAILMARY-BROTHER-LAYER.md` | Owner module: messages → brother → draft |
| `docs/OWNER-VOICE-MODEL.md` | Learn → right hand → second-in-command |
| `docs/FLEET-ROSTER.md` | Physical devices ↔ mesh names |
| `docs/OFFER-STACK.md` | BUILD + RUN pricing |
| `config/dual-sync.registry.example.yaml` | Registry template |
| `scripts/dual-sync/*` | validate · init · doctor · upgrade · schema |

---

## Honest status

| Piece | Status |
|---|---|
| Registry + validate + doctor | ✅ v1 |
| Universal sync DB schema | ✅ v1 |
| Owner init script | ✅ |
| Brother layer inbox (iMessage watcher) | 🔲 next on brain |
| Operator fenced init | ✅ scaffold |
| Supabase mirror of registry | 🔲 later |

---

_Companions: `docs/DEVICE-SYNC-PRIVATELLM.md` (capture shortcuts) · `docs/BRAINIAC-MAC-SETUP.md` · `docs/HOMELAND-HQ-AND-OPERATOR-SEATS.md`_
