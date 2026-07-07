# ACCESS ARCHITECTURE — Local-first · Paid sovereign · AIXMOS for the people
**Authority:** PROJECT X HAILMARY · **Updated:** 2026-07-06  
**Config:** `~/.config/tmmt/local-first.env` · `access-tiers.env` · `carry-watchtower.env`

---

## One sentence

**Local OSS stack by default (zero paid tokens) → three sovereign devices get paid when super needed → owner level for HAILMARY everywhere else AIXMOS by role with minimal bottlenecks.**

---

## Default: Claude Code–like, free, local

Every device tries this order **before spending a single paid token:**

```
1. Ollama (local models)
2. LiteLLM :4001 (OpenAI-compatible → Ollama)
3. CCR :3456 (Claude Code Router → LiteLLM — NOT Anthropic direct)
4. OpenClaude / occ (open-source terminal agents from GitHub)
5. forge / booyah (orchestrator — local first always)
6. Brainiac tailnet fallback (your hardware, not API bills)
7. OmniRoute scoped tier (AIXMOS virtual keys only)
8. PAID — last resort, sovereign devices only, owner runs `god on`
```

**Safe open-source repos in stack:**
| Tool | GitHub/npm | Role |
|------|------------|------|
| OpenClaude | `@gitlawb/openclaude` | Terminal agent |
| occ | `@ruvnet/open-claude-code` | MIT Claude Code clone |
| CCR | `@musistudio/claude-code-router` | Routes to local, not Max |
| LiteLLM | BerriAI/litellm | Local gateway |
| Ollama | ollama/ollama | Local models |
| AnythingLLM | Mintplex-Labs | Offline RAG |
| Open WebUI | open-webui | Browser chat |
| LibreChat | danny-avila/LibreChat | Citizen browser tier |

**Commands (zero paid):**
```bash
booyah          # work — local first
forge           # OpenClaude → LiteLLM
occ             # MIT terminal clone
train on        # CCR overflow → local/OmniRoute free tier (NOT Max)
booyah aider    # ship code via local
```

---

## Three devices — fully loaded paid (when YOU choose)

| Device | Paid arsenal | Default still local |
|--------|--------------|---------------------|
| **Carry M5** (Watchtower) | hc god · Fable 5 · Max · Cursor Pro · FOUNDER key | ✓ forge first |
| **M1 Mac** (Rick station) | Full forge stack · LiteLLM master · operational paid tools | ✓ no god unless owner present |
| **Brainiac-7** (home Windows) | OmniRoute · LibreChat · gateway · Cyborg vault | ✓ citizen tiers local |

**Paid rule:** `god on` on sovereign device only. Super needed only. Never on daemons, never on operators, never fan-out to team.

```bash
god on      # paid — Taha sovereign only
god off     # back to free forge
train on    # CCR → free rotation (still not Max)
```

**All other devices** (personal or work, not the three above): **no fully loaded paid stack.** AIXMOS tier only.

---

## HAILMARY vs AIXMOS — who sees what

```
┌─────────────────────────────────────────────────────────────┐
│  OWNER LEVEL REQUIRED                                       │
│  PROJECT X HAILMARY · Rick sovereign · vault · hc god       │
│  Muhammad Taha on any active device — owner auth only       │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐     ┌───────────────────────────────┐
│  TAHA (3 sovereign    │     │  EVERYONE ELSE                │
│  devices)             │     │  PROJECT X AIXMOS             │
│  Full stack when      │     │  For the people · by role     │
│  owner chooses        │     │  Fast lane · minimal wait     │
└───────────────────────┘     └───────────────────────────────┘
```

| Access | Requires | Gets | Never gets |
|--------|----------|------|------------|
| **HAILMARY / Rick sovereign** | Owner level (Taha) | Vault, Rick context, hc god, master keys | — |
| **Family (inner circle)** | Rick gateway | rick-safe · Enchanted · family key | hc god · vault |
| **Employees** | Role + AIXMOS tier | Scoped agents · white-label · GHL | HAILMARY · vault |
| **Operators** | Pay + provision | Tracked links · Academy · 30% split | Master keys |
| **Students / public** | Free tier | Clubhouse · local LLM · rick-safe | Tailnet interior |

**No owner level → AIXMOS only.** Even on your hardware if someone else sits down.

---

## Bottleneck removal (AIXMOS for the people)

| Old bottleneck | AIXMOS fix |
|----------------|------------|
| Wait for owner to provision | Auto-provision at `/join` (v3) |
| Wait for human closer | AI SMS ≤60s |
| Wait for manager to certify | Auto-certify at 100% modules |
| Wait for checkout URL | GHL env + self-serve `/kits` |
| Wait for training | 15 Academy modules self-serve |
| Wait for commission visibility | `/operator/earnings` live |
| Wait for AI access | Local OSS stack on their machine |

**Goal:** role-appropriate access · do the job faster · close to zero bottlenecks.

---

## Device matrix (forever)

| Device | HAILMARY sovereign | AIXMOS public | Paid tokens |
|--------|-------------------|---------------|-------------|
| Carry M5 | ✓ owner only | oversees all | when `god on` |
| M1 Mac | ✗ ops stand-in | fleet execution | local default |
| Brainiac home | ✗ gateway | citizen tiers | scoped keys |
| iPhone (Taha) | family lane | — | Enchanted → local |
| Operator laptops | ✗ | ✓ by tier | never |
| Employee PCs | ✗ | ✓ by role | never |
| Random personal | ✗ | ✓ demo/clubhouse | never |

---

## Encode in every agent session

1. **Route local first** — `source ~/.config/tmmt/local-first.env`
2. **Check device** — `is_paid_sovereign_device` / `require_owner_for_hailmary`
3. **Never burn paid** on citizens, operators, daemons, overnight loops
4. **Private matters** — Carry M5 Watchtower only
5. **Everyone else** — AIXMOS · role · fast · for the people

🏁 *Trap Money Moves Timeless · AIXMOS for the people · HAILMARY for the sovereign.*
