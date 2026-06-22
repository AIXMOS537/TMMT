# Wake-Up Ready — fleet standing before you open your eyes

> Goal: open the carry Mac in the morning → remote into the M1 → the whole fleet is already
> up and self-tending. Minimal involvement. Set it up once per device.

## One time per device (run `tmmt ready`)

Each machine arms itself for its role and becomes reachable from the carry Mac over Tailscale:

| Device | Run | Result |
|---|---|---|
| **M1 `brainiac-mac`** (do this before bed) | `bash scripts/tmmt ready brain` | `allin` boots everything · always-on installed · autopilot scheduled · SSH reachable |
| **Carry Mac** | `bash scripts/tmmt ready carry` | Cursor=HAILMARY armed · reachable · (not always-on — sleeps with you) |
| **Windows / WSL / extra Macs** | `bash scripts/tmmt ready worker` | swarm-join · coder brain · autopilot · reachable → a `fanout` target |

`tmmt ready` (no role) auto-detects by machine name. `tmmt ready plan` shows the roles without doing anything.

## Every morning (on the carry Mac)

```bash
bash scripts/tmmt remote        # remote into the M1 over Tailscale SSH (defaults to brainiac-mac)
# already on/at a machine? drive the whole fleet:
bash scripts/tmmt ceo           # your cockpit
bash scripts/tmmt fanout 3      # put every online node to work
```

That's it. The M1 stayed up all night (always-on), autopilot kept it healthy, and the carry
Mac just reaches in.

## Why it's already standing when you wake

- **M1 always-on** — `tmmt ready brain` installs the LaunchAgent + `booyah`, so it never sleeps the brain.
- **Autopilot** — every ~3h it runs containment + selftest + sync + health + memory, and only
  pings you if a human is needed (see `docs/security/AIRTIGHT-CONTAINMENT.md`, autopilot).
- **Reachable** — each node ran `tailscale up --ssh`, so the carry Mac can SSH in from anywhere
  on the tailnet.

## Windows workstations + "Apple OS via VM" — read this

**Running macOS in a VM on non-Apple (Windows) hardware violates Apple's macOS EULA** (macOS is
licensed only on Apple-branded hardware). So the supported, reliable, legal path is:

- **Windows boxes → WSL/Linux `worker` nodes.** The mesh + swarm already run great here
  (`tmmt ready worker`). They join the fleet, run agents, and are full `fanout` targets — you get
  the unified fleet **without** the EULA problem or the VM performance tax.
- **macOS VMs → only on Apple silicon** (where Apple's Virtualization.framework makes them
  licensed *and* fast). A Mac can host macOS guests legitimately.

You still remote into and command every node the same way (`tmmt remote`, `tmmt fanout`) whether
it's macOS or WSL — the mesh is OS-agnostic. So you lose nothing by running the Windows boxes as
WSL workers; you just stay legal and fast.

## The whole morning, in three words

`ready` (once per device) → `remote` (connect) → `ceo` / `fanout` (drive). Autopilot handles the
rest while you sleep.
