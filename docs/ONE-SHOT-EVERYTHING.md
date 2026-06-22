# One shot — anything & everything

> One command takes a fresh device all the way from nothing to the holographic
> front door. Plug and play, for you or anyone.

## Do it

```bash
bash scripts/everything            # asks who it's for, then does it all
bash scripts/everything mine       # the Owner's device (your mesh, sealed)
bash scripts/everything own        # family/friend: their own sovereign mesh
```

Or **double-click `EVERYTHING.command`** in the repo (Finder). First time:
right-click → Open.

## What it runs (in order, best-effort)

| Step | Calls | Result |
|---|---|---|
| 1 · Device | `scripts/one-shot.sh` | Sets up the machine + role + **sovereign tenant isolation** (their own Tailscale account = zero overlap with your mesh) |
| 2 · Wiki | `scripts/wiki build` | Offline home base — every doc rendered inline |
| 3 · Icons | `scripts/install-apps` (macOS) | Double-click Desktop apps: Mission Control · Cockpit · Wiki |
| 4 · Launch | `scripts/home` | Opens **Mission Control** fullscreen |

It **composes** existing tools — it doesn't replace them. One failed step never
aborts the rest. Safe to re-run.

## Then

- **Front door:** the `AIXMOS Mission Control` Desktop icon (or `bash scripts/home`).
- **Send a welcome kit:** `bash scripts/send-pack family` (or `operator`).
- **Light up a paid seat** (owner, needs keys — dry-run first):
  `node scripts/provision-tenant-seat.mjs --vertical <v> --email <e> --stage earn --dry-run`

> macOS does the full visual layer (app icons). On Windows the device step runs;
> for the app launchers see `docs/MISSION-CONTROL.md` (`msedge --app`).
