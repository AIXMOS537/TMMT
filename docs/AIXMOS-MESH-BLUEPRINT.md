# AIXMOS Mesh — Always-On Assistant + Memory Blueprint

> The owner's intent, captured so it persists. Device-specific secrets and
> personal identifiers (phone numbers, iCloud logins) are **NOT** stored here —
> they live only on the machines / in `.swarm/` (git-ignored). This doc is the
> architecture, not the credentials.

## The vision (one paragraph)

A planted, **always-on M1 Pro Mac** at home acts as the owner's assistant on his
behalf — deeply personalized — and continuously **writes memory into an Obsidian
vault on BRAINIAC** (the Windows brain at home). Everything is stitched together
over **Tailscale** across two accounts. **AIXMOS** and **HAILMARY** are the two
flagship agents; the **AIXMOS network** houses the TMMT operatives.

## The cast

| Node | Device | Identity | Role |
|---|---|---|---|
| **M1 Pro Mac** | home, planted, always-on | company/work Apple identity | The assistant — runs AIXMOS/HAILMARY, acts on owner's behalf, pushes memory |
| **BRAINIAC** | Windows PC, home | (its own Tailscale account) | The memory store — Obsidian vault (the second brain) |
| **carry-mac** | with the owner | personal Apple identity | Owner, mobile — already on the mesh |
| **TMMT operators** | field laptops | per-operator | Operatives on the AIXMOS network |
| **Phones** | iPhone 16e (work) / 16 Pro (personal) | — | Remote control + alerts |

## Topology (two Tailscale accounts, bridged)

```
 ACCOUNT A (assistant)              ACCOUNT B — "AIXMOS network" (operations)
 ┌──────────────────┐   Tailscale   ┌─────────────────────────────────────────┐
 │ M1 Pro (always-on│   node-share  │ BRAINIAC (Obsidian memory)               │
 │ assistant)       │◀── bridge ───▶│ carry-mac · TMMT operators…              │
 └──────────────────┘               └─────────────────────────────────────────┘
        └─ pushes memory → Obsidian vault on BRAINIAC
```

Cross-account reach is done with **Tailscale node sharing** (share BRAINIAC to
the assistant's account, or vice-versa) — not by merging accounts. ACLs keep it
least-privilege: the assistant reaches **only** BRAINIAC's Obsidian/SSH port;
operators stay fenced to their lane (see `scripts/partner-deploy/tailscale-acl.json`).

## The memory loop

1. The assistant (M1) captures notes/decisions/agent output.
2. It writes Markdown into the Obsidian vault path on BRAINIAC over Tailscale
   (SMB/SSH/rsync — chosen per the "memory flow" decision).
3. Obsidian on BRAINIAC indexes it → the living second brain.
4. Git remains the durable source of truth for code/specs; Obsidian is the
   human-readable memory layer.

## Phased buildout

### Phase 0 — done
- The mesh + agent swarm, onboarding, security guard, presence/assist, `tmmt`
  verbs, fresh-Mac installer, Vercel secret transport. carry-mac is live.

### Phase 1 — always-on (BUILT this session)
- `scripts/mesh/install-launchagent.sh` → `tmmt always [role]` installs a macOS
  LaunchAgent so a Mac stays on the mesh **24/7 in the background** (no open
  window, auto-restart). Run on the M1 (`tmmt always owner`) so the assistant is
  always connected. `tmmt always-off` removes it.
- **Owner step:** BRAINIAC (Windows) gets the equivalent via Task Scheduler — a
  `.ps1` is the next build when we wire its side.

### Phase 2 — cross-account Tailscale bridge (needs owner taps)
- In Tailscale admin: **share** BRAINIAC (Account B) to the assistant (Account A),
  enable **Tailscale SSH**, and tighten ACLs to the Obsidian/SSH port only.
- Verify: from the M1, `tailscale ping brainiac` and an SSH/rsync handshake.

### Phase 3 — Obsidian memory sync (BUILT this session)
- `scripts/mesh/memory-sync.sh` — **push-only** (M1 → vault, decided): rsyncs
  HAILMARY's absorbed memory snapshots into BRAINIAC's Obsidian vault over
  Tailscale. `once | loop [secs] | install [secs] | uninstall | status`; the
  `install` verb lays down a macOS LaunchAgent (`com.tmmt.memory-sync`).
- **Owner step:** set `HAILMARY_VAULT` to the rsync target (a Tailscale SSH
  `host:path`, e.g. `brainiac:/Users/brainiac/Obsidian/HAILMARY`) and run
  `bash scripts/mesh/memory-sync.sh install`. Memory files carry no secrets
  (scrubbed at capture by `scripts/hailmary`).

### Phase 4 — AIXMOS / HAILMARY agent roles (RATIFIED this session)
- Both constitutions are now in the repo:
  - **`docs/HAILMARY-CHARTER.md`** — the Owner's personal big-play agent.
    Activation word: **`booyah`** (`scripts/hailmary`).
  - **`docs/AIXMOS-CHARTER.md`** — the operations/network brain that runs the
    swarm + TMMT operatives.
- Both: owner-only (PROJECT X HAILMARY), local-first, never-sold, shared guardrails,
  shared memory of record (git + Obsidian vault). AIXMOS runs the network;
  HAILMARY serves the Owner; they move in unison.

### Phase 5 — Unison (BUILT this session)
- `scripts/mesh/unison.sh` — the single switch that boots the whole home base as
  one: HAILMARY `booyah` → memory loop → always-on mesh presence. `up | status |
  down`. Wired into the launcher: **`bash scripts/tmmt unison`**.

## Security posture (non-negotiable)

- Two accounts stay separate; bridge by **sharing single nodes**, never merging.
- Tailscale **ACLs least-privilege**: assistant → BRAINIAC only; operators fenced.
- The assistant "knows everything about the owner" — so its host must be
  disk-encrypted (FileVault), the vault access scoped, and **no secrets in git**
  (the pre-commit/pre-push guard already enforces this).
- Personal identifiers (phones, iCloud logins) stay off git — local only.

## Decisions — resolved

1. **Memory flow:** ✅ **push-only** (M1 → Obsidian). Vault path is set per-host
   via `HAILMARY_VAULT` (a Tailscale SSH `host:path`), kept off git.
2. **Agent split:** ✅ ratified — `docs/HAILMARY-CHARTER.md` (Owner's agent) +
   `docs/AIXMOS-CHARTER.md` (network brain).
3. **Bridge direction:** ⏳ owner tap — recommended: **share BRAINIAC into the
   assistant's tailnet** (assistant reaches only BRAINIAC's Obsidian/SSH port),
   least-privilege per the security posture above.

_Companions: `docs/HAILMARY-CHARTER.md` + `docs/AIXMOS-CHARTER.md` (the agents'
constitutions), `docs/MESH-SWARM.md` (the mesh/swarm system), `CLAUDE.md`
(project memory)._
