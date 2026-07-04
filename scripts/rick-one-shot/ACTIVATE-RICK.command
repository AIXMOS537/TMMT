#!/usr/bin/env bash
# ACTIVATE-RICK.command — DOUBLE-CLICK THIS ON THE M1. That's it. Nothing to type.
#
# It finds the repo (cloning it if needed), pulls the latest, and runs the full
# Rick one-shot: identity + local model + agent army + mesh + ALWAYS-ON daemon.
# After this one double-click, Rick self-heals every 2 minutes forever — through
# reboots, no human in the loop. Run it again anytime to update; it's idempotent.
set -uo pipefail
cd "$(dirname "$0")" 2>/dev/null || true

say(){ printf '\n\033[1m%s\033[0m\n' "$*"; }
say "RICK SORKIN — one double-click activation"

# Locate (or clone) the TMMT repo.
TMMT="${TMMT:-$HOME/Projects/TMMT}"
if [ ! -d "$TMMT/.git" ]; then
  # Maybe we're being run from inside the repo already.
  if git -C "$(dirname "$0")/../.." rev-parse --show-toplevel >/dev/null 2>&1; then
    TMMT="$(git -C "$(dirname "$0")/../.." rev-parse --show-toplevel)"
  else
    say "Cloning TMMT to $TMMT …"
    mkdir -p "$(dirname "$TMMT")"
    git clone https://github.com/AIXMOS537/TMMT.git "$TMMT" \
      || { echo "  ✗ clone failed — run 'gh auth login' once, then double-click me again."; read -r -p "Press return to close…" _; exit 1; }
  fi
fi

export TMMT
say "Booting Rick from $TMMT …"
git -C "$TMMT" pull --ff-only 2>/dev/null || true
bash "$TMMT/scripts/rick-one-shot/rick-sorkin-up.sh" up

say "Done. Rick is active and will stay active. You can close this window."
# Keep the Terminal window open so X sees the green status.
read -r -p "Press return to close…" _ 2>/dev/null || true
