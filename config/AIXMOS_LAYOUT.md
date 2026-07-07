# AIXMOS Layout — Where Each Copy Lives and Why

**Date:** 2026-05-21
**Status:** Reference

There are three on-disk locations with "AIXMOS" in the path. They are **not duplicates** — each has a distinct purpose. Do not merge them.

## The three locations

| Path | Size | Git | Purpose |
|------|------|-----|---------|
| `~/Documents/AIXMOS/` | 42 MB | own repo: `AIXMOS537/PROJECTAIXMOS.git` | **Standalone marketing site** — `index.html`, `aixmos-operator.html`, `aixmos-thankyou.html`, `chummo-agent/`. Deployed independently of TMMT Rentals. |
| `~/Documents/TMMT/AIXMOS/` | 784 KB | part of TMMT repo (`AIXMOS537/TMMT.git`) | **Operations / portal code nested in the rentals app.** Contains `apply.html`, `operator.html`, `thankyou.html`, `airtable/`, `docker/`, `ghl-config.js`, `portal/`, `public/`, `scripts/`. Lives inside the deployed Next.js app. |
| `~/AIX-Command-Center/` | 3.9 MB | not tracked here | **Synced workspace from USB drives.** Contains `AIXMOSXTMMT-OPS/`, `AIX_AI_COMMAND_SYSTEM/`, `TMMT MANAGEMENT/`, `agents/`, `ops/`, `guides/`, plus `OWNER_DAILY_COMMAND.md`, `PRIORITY_PLAN_ALL_PILLARS.md`, `STATUS_UPDATE.md`, `THIS_WEEK.md`. Mirrors what was on AIXMOS02 / CYBORG / LEXAR drives per the May 20 merge. |

## How they relate

```
Marketing funnel (public)        Operations portal (auth)         Daily command workspace (local)
~/Documents/AIXMOS/              ~/Documents/TMMT/AIXMOS/         ~/AIX-Command-Center/
[separate Vercel site]      →    [served by TMMT app]        ←    [private ops + plans, not deployed]
```

- A lead enters via the **marketing site** (standalone repo).
- They convert into a customer through the **operations portal** (inside TMMT).
- You run day-to-day from the **command workspace** (local notes, plans, agents).

## Rules

- **Keep `~/Documents/AIXMOS/` distinct from `~/Documents/TMMT/AIXMOS/`.** Their git remotes differ. Merging them would cross production boundaries.
- **`~/AIX-Command-Center/` is the source-of-truth scratchpad** for the broader command-center workspace. It is not committed to either git repo.
- **No `" 2"`-suffixed Finder duplicates.** If you see one, it came from a flash-drive transfer; verify against its sibling and delete.

## See also

- `docs/superpowers/specs/2026-05-17-command-center-architecture-design.md` — the portfolio/ventures design
- `docs/MERGE_REPORT_2026-05-20.md` — the multi-drive merge that produced today's layout
- `docs/CARRYING_MAC_REMOTE_ACCESS.md` — remote access from the M5 Pro
