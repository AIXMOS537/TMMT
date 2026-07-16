# AIXMOS Build Page

A permanent, shareable build page for every operator's AIXMOS machine — same idea as a
PinkSlips car build page, in TMMT brand (gold-on-black, holographic). One self-contained
`index.html`: hero, spec sheet, mod list, dyno (capability output), build log, crew roster,
and a scan-to-load QR.

This is a standalone static tool, sibling to `tools/garage/` (OVERHAUL) and
`tools/launcher/` (Mission Control). It is **not** part of the Next.js app — it ships to its
own static host (see `DEPLOY.md`). `tools/` is excluded from Vercel deploys by
`scripts/vercel-ignore.sh`, so committing it never burns the deploy quota.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole app. Static, no build step, works offline (graceful QR fallback). |
| `aixmos.config.json` | Canonical config — modules, gates, flags, tiers, pricing. The `CONFIG` block in `index.html` mirrors this. |
| `check-config-drift.mjs` | `node check-config-drift.mjs` — fails if the embedded CONFIG and `aixmos.config.json` module keys / gated flags disagree. |
| `DEPLOY.md` | How to take it live (Vercel + domain), plus the flagged backend step. |
| `CLAUDE_CODE_INTEGRATION.md` | Paste-into-Claude-Code prompt to fold this into the upstream AIXMOS repo and keep config in sync. |
| `HANDOFF.md` | Self-contained session handoff + reconciliation log (v1.0 → v1.1). |

## How it works

- **Builds** = operator machines. Each has modules, crew tiers, tier/rate, and a colour.
- **Gated bays** (`credit_to_keys`, `dispatch`) stay locked until granted through the
  owner-approval modal. The grant records the approver (Owner) and travels with the
  build code. **The UI gate is not legal sign-off** — real CROA / licensing / insurance
  clearance happens off-platform; the unlock just records that it was done. Never auto-unlock.
- **Share / QR** encodes the full build into a link (`#load=…`). Scanning or opening it
  rebuilds that exact machine as its own page. No backend needed for handoff.
- **Persistence**: saves per device via `localStorage` (or the artifact storage API when
  embedded). Build codes are how a machine travels between devices.

## Editing the catalog

Change `aixmos.config.json` **and** the matching `CONFIG` arrays near the top of `index.html`
(they're marked "single source of truth"). Keep `key` values stable — they map to the
platform schema. Mid-tier prices live in `computeTier()`. After editing, run:

```bash
node tools/aixmos-build-page/check-config-drift.mjs
```

to confirm the two stay 1:1.

## Single source of truth

Module `key`s and gated `flag`s are the contract between this page, `aixmos.config.json`,
and the upstream Claude Code / backend repo. Don't rename them casually — that's what keeps
the page 1:1 with what operators actually run. See `HANDOFF.md` for the open reconciliation
items (notably the provisional `dispatch_overdrive` flag name).
