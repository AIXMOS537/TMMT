# Fleet Roster — the canonical device map

> The single source of truth for **which physical machine is which**. Every
> device wears two hats: a **mesh node** (unique `.swarm/machine` name — see
> [`MESH-SWARM.md`](./MESH-SWARM.md)) and a **ghost endpoint** (gets the
> hardening defaults from
> [`security/GHOST-EVERYDAY-DEFAULTS.md`](./security/GHOST-EVERYDAY-DEFAULTS.md)).
>
> This is the "secured map" Pillar 6 of the GO GHOST protocol asks for — **minus
> secrets.** No passwords, keys, serials, or IPs live here; those stay in the
> vault. This file just says *what exists and who holds it.*

---

## The fleet

| Device | Mesh name | Chip / OS | Held by | Role | Always-on? |
|---|---|---|---|---|---|
| **Windows home build** (the $3k+ powerhouse) | `brainiac-win` | High-end x86 · Windows | **Owner (home base)** | 🧠 **Heavy-compute engine + warm backup** — the original brain (Fatherbox); standby failover for `brainiac-mac` | **Yes** |
| **Work Mac @ home (M1)** | `brainiac-mac` | **Apple M1 (Pro/Max)** · macOS | **Owner (home base)** | 🧠 **PRIMARY brain** — the node the carry Mac talks to + texts (the "Donna/Gretchen" assistant); HAILMARY `booyah`, memory loop, vault host | **Yes** |
| **Carry Mac (M5)** | `carry-mac` | **Apple M5** · macOS | **Owner** | Mobile command — travels with you; the main device that talks to + texts the home brain remotely | No (with you) |
| **Moe Legacy Mac** | `moe-legacy` | **Apple M5 Pro** · macOS | **Umar / Red Hood** (MoeLegacy) | 📈 Credit Guidance partner node — **fenced / least-privilege** | When working |
| **Surface Pro 4** | `surface` | Microsoft Surface Pro 4 · Windows | **Owner** | Windows swarm node (best run via Linux/WSL) | No |
| **Other Windows device #1** | `win-________` | _Windows (confirm)_ | _confirm_ | _confirm role_ | No |
| **Other Windows device #2** | `win-________` | _Windows (confirm)_ | _confirm_ | _confirm role_ | No |

> **Fill in the last two rows** with the other Windows devices you've mentioned
> before — tell me the make/role and I'll name and slot them. I left them blank
> rather than guess.

### The brain — lineage & decision (locked)
- **Lineage:** the **original main brain was the Windows home build**
  (`brainiac-win`) — the $3k+ powerhouse, the heavyweight compute / control-plane
  host (the "Fatherbox" the roster refers to).
- **Decision (locked):** the **M1 (`brainiac-mac`) is now the PRIMARY brain** —
  the body the **carry Mac talks to and texts** (the "Donna/Gretchen" assistant).
  Why the Mac: the conversational rails — **HAILMARY `booyah`**, the macOS
  always-on LaunchAgents, and the **iMessage bridge** — are **Mac-native**, so
  this is the reliable everyday path, not a workaround.
- **The Windows build stays on as `brainiac-win`** — the **heavy-compute engine
  and warm backup**: it carries the heavyweight jobs the Mac shouldn't, and is
  the standby failover if the M1 is ever down. Nothing wasted; it just stops
  being the thing you talk to.
- **`moe-legacy` = Umar's M5 Pro.** Maps to **Red Hood / Credit Guidance** in
  [`WATCHTOWER-ROSTER.md`](./WATCHTOWER-ROSTER.md) and the MoeLegacy deploy in
  [`LEGACY-DEPLOY-MOE.md`](./LEGACY-DEPLOY-MOE.md). Onboards **fenced** — partner
  access, not owner.
- **Surface Pro 4** — per `MESH-SWARM.md`, a Surface runs the swarm best through
  **Linux/WSL** (full tmux); native Windows works too via Git for Windows +
  Windows Terminal tabs.

---

## Per-device hardening (apply the everyday defaults to each endpoint)

Every machine on the mesh touches the code, so every machine gets the same
baseline. Check each off per device.

| Device | Disk encryption | Vault (Dashlane) | App/passkey 2FA | `swarm-join` done | Integrity scan clean |
|---|---|---|---|---|---|
| `brainiac-win` | ☐ BitLocker | ☐ | ☐ | ☐ | ☐ |
| `brainiac-mac` | ☐ FileVault | ☐ | ☐ | ☐ | ☐ |
| `carry-mac` | ☐ FileVault | ☐ | ☐ | ☐ | ☐ |
| `moe-legacy` | ☐ FileVault | ☐ | ☐ | ☐ (fenced) | ☐ |
| `surface` | ☐ BitLocker | ☐ | ☐ | ☐ | ☐ |
| `win-____` | ☐ BitLocker | ☐ | ☐ | ☐ | ☐ |

- **Disk encryption** = FileVault (Mac) / BitLocker (Windows). A lost laptop with
  no encryption is the whole ghost undone in one afternoon — this is the floor.
- **Integrity scan** = `aixmos integrity` (or `bash scripts/device-integrity.sh`)
  from [`FLEET-PRESENCE-SECURITY.md`](./FLEET-PRESENCE-SECURITY.md) — run it on a
  schedule so drift gets caught.
- **`swarm-join`** = `bash scripts/swarm-join.sh --name <mesh-name>` — sets the
  unique machine name + per-device git identity + secret-guard hooks.

---

## Talk to the brain like a person (the "Donna / Gretchen" channel)

The goal: from the **carry Mac** (or your phone), you message the **M1 brain**
in plain language — "what's on today," "text Umar the funding doc," "spin up two
agents on that build" — and it acts, replies, and anticipates. Here's the real
wiring already in this repo, and the honest constraints.

**The brain runs locally on the M1** — that's non-negotiable for this. Two of the
three rails only exist on the Mac itself:

| Rail | What it does | Lives where |
|---|---|---|
| **HAILMARY** (`bash scripts/hailmary booyah`) | Boots the always-on assistant: self-audit, absorb context, macOS always-on | **On the M1** (macOS LaunchAgents) |
| **iMessage bridge** (`scripts/setup-mac-imessage-bridge.sh`) | Lets the local assistant **read + send real texts** through Messages | **On the M1** ([`MAC-IMESSAGE-BRIDGE.md`](./MAC-IMESSAGE-BRIDGE.md)) |
| **Mesh link** (`scripts/mesh/link.sh`) | Carry Mac ↔ M1 over **Tailscale SSH** — `serve` / `request` / `assist` to co-drive | Between devices |

**So the everyday loop looks like:**
1. The **M1 stays on** and booted (`booyah` / `tmmt unison`) — the assistant is
   always listening.
2. You **text it** (iMessage bridge) or **reach it from the carry Mac** over
   Tailscale SSH (`link.sh`) — natural language in, action + reply out.
3. It runs the ops (swarm, deploys, notifications) and answers like a person.

**The honest limits (so this is reliable, not a demo):**
- A **cloud/web Claude session can't touch Messages or the local brain** — the
  iMessage bridge is stdio-local to the Mac. The "talks like a human over text"
  experience means **Claude Code running on the M1**, not a remote session.
- Keep the M1 **powered, awake, and on Tailscale** (caffeinate / LaunchAgent),
  or the assistant goes dark. That's why "always-on" is the brain's #1 job.
- Texting still rides Apple's iMessage/SMS — normal carrier/Apple rules apply.

**To stand this up** (owner-only, on the M1 — full steps in
[`BRAINIAC-MAC-SETUP.md`](./BRAINIAC-MAC-SETUP.md)): set up the iMessage bridge →
`hailmary booyah` → `link.sh serve`, then from the carry Mac `link.sh assist
brainiac-mac`. That's the whole Donna/Gretchen channel.

## Naming rule (so the mesh never collides)

Each machine **must** have a unique `.swarm/machine` name (gitignored). Branches
are `swarm/<machine>/*`, so unique names are what keep two devices from stepping
on each other. Use the names in the table above when you run `swarm-join`.

## Cross-links
- HQ → office topology + operator seats/pricing → [`HOMELAND-HQ-AND-OPERATOR-SEATS.md`](./HOMELAND-HQ-AND-OPERATOR-SEATS.md)
- Mesh / swarm mechanics → [`MESH-SWARM.md`](./MESH-SWARM.md)
- Presence + integrity → [`FLEET-PRESENCE-SECURITY.md`](./FLEET-PRESENCE-SECURITY.md)
- Endpoint hardening defaults → [`security/GHOST-EVERYDAY-DEFAULTS.md`](./security/GHOST-EVERYDAY-DEFAULTS.md)
- People ↔ roles → [`WATCHTOWER-ROSTER.md`](./WATCHTOWER-ROSTER.md)
