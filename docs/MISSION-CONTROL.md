# Mission Control — the holographic front door

> One cool home screen that launches everything. Plug-and-play app icons so you
> (and family/operators) open the Cockpit, Wiki, and deploy commands like native
> apps — no terminal, no browser chrome.

## Open it

```bash
bash scripts/home          # holographic Mission Control, fullscreen app mode
```

Or install **double-click app icons** on your Desktop (the plug-and-play way):

```bash
bash scripts/install-apps
```

That drops three icons — **AIXMOS Mission Control**, **AIXMOS Cockpit**, **AIXMOS
Wiki** — each opens **fullscreen like a real app** (Chrome/Edge/Brave "app mode";
falls back to your default browser). Drag them to the Dock to pin. First launch:
right-click → Open (macOS asks once).

## What's on it

| Tile | Does |
|---|---|
| 🛰️ **3D Cockpit** | the holographic empire — orbit & dissect |
| 📚 **Wiki** | every doc rendered inline (Obsidian-obsolete) |
| ⚡ **Flash Deploy** | copies `bash scripts/deploy` to stand up a node |
| 🔱 **Booyah** | copies `bash scripts/hailmary booyah` |

…plus copy-buttons for the everyday flash commands (`deploy owner`,
`deploy operator`, `send-pack family`, `tmmt unison`). The Cockpit and Wiki tiles
are live links; the deploy/booyah tiles **copy the command** (a web page can't run
your shell — by design, it hands you the exact line).

The whole hub loops: **Mission Control ↔ Cockpit ↔ Wiki** all cross-link, so you
can move between them with one click.

## Windows (the brainiac box / operators)

The icons are macOS. On Windows, make an app-mode shortcut to any of the three
HTML files with Edge:

```
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="file:///C:/Users/<you>/projects/TMMT/tools/launcher/index.html"
```

Save that as a Desktop shortcut → it opens fullscreen like an app.

## Deploy it to everyone

It's just files in the repo, so `git pull` delivers it. New machines (or the
Operator Portable Kit) get Mission Control automatically. Pair with
`bash scripts/send-pack` to hand family/operators the welcome kit, and
`bash scripts/install-apps` so their first screen is the holographic home base.
