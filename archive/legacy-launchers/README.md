# Archived launchers (kept, not deleted)

These were retired on 2026-07-18 when **`START-HERE`** became the one front door.
Nothing here is gone — it's parked. To bring any of it back, `git mv` it to its old
location.

**Use instead:** double-click **`START-HERE.command`** (Mac) or **`START-HERE.cmd`**
(Windows), or run `bash scripts/start.sh`. Power users still have the full router at
`bash scripts/tmmt <word>`.

## What was moved here and why
- `TMMT-MENU.command` — old numbered menu; replaced by `START-HERE` (same 6 actions, friendlier).
- `EVERYTHING.command` — thin wrapper around `scripts/everything`; reachable via the router.
- `family-mesh-loop.sh`, `claude-family-mesh.sh`, `brainiac-handoff.sh` — empty (0-byte) stubs.

## Still live on purpose (NOT archived)
- `scripts/tmmt` — the real engine (all ~70 commands). START-HERE just calls it.
- `scripts/tmmt-up.command`, `scripts/go`, `scripts/menu`, `scripts/home`, `scripts/doctor.sh`,
  `scripts/godark` — engines/entry points the router and menu use.
