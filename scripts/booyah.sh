#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# booyah.sh — THE start word. One word boots EVERYTHING on any node:
#   run the base (HAILMARY/unison) · re-pull tools · mark present · open the board.
# Order matters: the base boot can switch branches, so we re-pull the board AFTER.
# ───────────────────────────────────────────────────────────────────────────
set -uo pipefail
BR="claude/team-absence-notification-0rYgo"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; cd "$ROOT" 2>/dev/null || true

printf "\033[1;93m⚡ BOOYAH — booting the base…\033[0m\n"
git fetch origin -q 2>/dev/null || true

# 1) run the base boot FIRST (it may switch branch / rewrite the working tree)
for boot in scripts/unison.sh scripts/go scripts/tmmt; do
  [ -x "$boot" ] && { printf "\033[2m  · base boot: %s\033[0m\n" "$boot"; bash "$boot" || true; break; }
done

# 2) re-pull MY tools AFTER the base boot so the board survives the branch switch
git fetch origin -q 2>/dev/null || true
for p in scripts dist docs content config; do git checkout "origin/$BR" -- "$p" 2>/dev/null || true; done
chmod +x scripts/*.sh dist/*.command 2>/dev/null || true

# 3) mark this device present on the mesh
[ -x scripts/heartbeat.sh ] && bash scripts/heartbeat.sh beat >/dev/null 2>&1 || true

# 3b) CEO brief — the owner-altitude landing (includes the readiness check inside it)
[ -x scripts/ceo.sh ] && { echo; bash scripts/ceo.sh || true; } \
  || { [ -x scripts/doctor.sh ] && { echo; bash scripts/doctor.sh --quiet || true; }; }

# 4) open the full control board (🚀 GO LIVE · 📥 QUEUE · everything)
echo
if [ -x scripts/oneshot.sh ]; then bash scripts/oneshot.sh
else printf "\033[31mboard missing — re-run: bash ~/projects/TMMT/scripts/booyah.sh\033[0m\n"; fi
