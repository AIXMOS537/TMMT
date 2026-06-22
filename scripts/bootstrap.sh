#!/usr/bin/env bash
# bootstrap.sh — PROJECT X HAILMARY
# Paste ONE LINE on any Mac from any directory:
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/AIXMOS537/TMMT/master/scripts/bootstrap.sh)
#
# Private repo (works from any directory):
#   [ -d ~/Projects/TMMT ] || git clone https://github.com/AIXMOS537/TMMT.git ~/Projects/TMMT; git -C ~/Projects/TMMT pull --ff-only 2>/dev/null; bash ~/Projects/TMMT/scripts/everything.sh
set -uo pipefail
REPO="https://github.com/AIXMOS537/TMMT.git"
TARGET="$HOME/Projects/TMMT"
C=$'\e[36m'; G=$'\e[32m'; Y=$'\e[33m'; BD=$'\e[1m'; RST=$'\e[0m'
ok()  { printf '  %s✓%s %s\n' "$G" "$RST" "$*"; }
warn(){ printf '  %s!%s %s\n' "$Y" "$RST" "$*"; }
say() { printf '\n%s%s%s\n'   "$BD" "$*"  "$RST"; }
clear
printf '\n%s╔══════════════════════════════════════════════════════╗%s\n' "$C" "$RST"
printf '%s║   PROJECT X HAILMARY — BOOTSTRAP                   ║%s\n' "$C" "$RST"
printf '%s╚══════════════════════════════════════════════════════╝%s\n\n' "$C" "$RST"
say "Repo"
if [[ -d "$TARGET/.git" ]]; then
  ok "Repo exists — pulling latest"
  git -C "$TARGET" pull --ff-only 2>/dev/null || warn "Pull failed — continuing with current version"
else
  say "Cloning TMMT repo"
  git clone git@github.com:AIXMOS537/TMMT.git "$TARGET" 2>/dev/null \
  || git clone "$REPO" "$TARGET" 2>/dev/null \
  || { warn "Clone failed. Try: git clone https://github.com/AIXMOS537/TMMT.git $TARGET"; exit 1; }
fi
ok "Repo ready ($(git -C "$TARGET" rev-parse --short HEAD 2>/dev/null || echo 'ok'))"
say "Launching everything.sh"
exec bash "$TARGET/scripts/everything.sh"
