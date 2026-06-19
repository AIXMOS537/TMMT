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
| **Carry Mac** | `carry-mac` | Apple Silicon · macOS | **Owner** | Mobile command — travels with you; runs the swarm on the go | No (with you) |
| **Work Mac @ home** | `brainiac` | **Apple M1** · macOS | **Owner (home base)** | 🧠 The brain — always-on control plane, HAILMARY `booyah`, memory loop + vault host | **Yes** |
| **Moe Legacy Mac** | `moe-legacy` | **Apple M5 Pro** · macOS | **Umar / Red Hood** (MoeLegacy) | 📈 Credit Guidance partner node — **fenced / least-privilege** | When working |
| **Surface Pro 4** | `surface` | Microsoft Surface Pro 4 · Windows | **Owner** | Windows swarm node (best run via Linux/WSL) | No |
| **Other Windows device #1** | `win-________` | _Windows (confirm)_ | _confirm_ | _confirm role_ | No |
| **Other Windows device #2** | `win-________` | _Windows (confirm)_ | _confirm_ | _confirm role_ | No |

> **Fill in the last two rows** with the other Windows devices you've mentioned
> before — tell me the make/role and I'll name and slot them. I left them blank
> rather than guess.

### Notes on what I recorded
- **`brainiac` = your home M1 work Mac.** This is the always-on brain node the
  charters already point at (HAILMARY `booyah`, `scripts/mesh/memory-sync.sh`,
  the Obsidian vault). Keep it powered and on Tailscale so the rest of the mesh
  has a home to sync to.
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
| `carry-mac` | ☐ FileVault | ☐ | ☐ | ☐ | ☐ |
| `brainiac` | ☐ FileVault | ☐ | ☐ | ☐ | ☐ |
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

## Naming rule (so the mesh never collides)

Each machine **must** have a unique `.swarm/machine` name (gitignored). Branches
are `swarm/<machine>/*`, so unique names are what keep two devices from stepping
on each other. Use the names in the table above when you run `swarm-join`.

## Cross-links
- Mesh / swarm mechanics → [`MESH-SWARM.md`](./MESH-SWARM.md)
- Presence + integrity → [`FLEET-PRESENCE-SECURITY.md`](./FLEET-PRESENCE-SECURITY.md)
- Endpoint hardening defaults → [`security/GHOST-EVERYDAY-DEFAULTS.md`](./security/GHOST-EVERYDAY-DEFAULTS.md)
- People ↔ roles → [`WATCHTOWER-ROSTER.md`](./WATCHTOWER-ROSTER.md)
