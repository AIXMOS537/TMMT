#!/usr/bin/env bash
#
# anywhere.sh — PROJECT X HAILMARY, from ANY folder on ANY device.
# ---------------------------------------------------------------------------
# The fix for "bash: scripts/tmmt: No such file or directory": this self-locates
# (or clones) the repo, pulls latest, makes sure the agent toolbelt is present,
# then runs the factory line. Paste it from your home folder — it handles the rest.
#
# Paste-anywhere (after this lands on master):
#   bash <(curl -fsSL https://raw.githubusercontent.com/AIXMOS537/TMMT/master/scripts/anywhere.sh) --node CARRY
#
# Or locally, from anywhere:
#   bash ~/Projects/TMMT/scripts/anywhere.sh --node CARRY --passes 3 --apply --handoff
#
# Flags:
#   --install-tools   install the agent CLIs (Claude Code, Codex, Cursor, Ollama, gh) first
#   (everything else is passed straight through to scripts/factory-line.sh)
# ---------------------------------------------------------------------------
set -uo pipefail
if [ -t 1 ]; then G=$'\e[32m'; Y=$'\e[33m'; C=$'\e[36m'; B=$'\e[1m'; D=$'\e[2m'; X=$'\e[0m'; else G=; Y=; C=; B=; D=; X=; fi
ok(){ printf '%s  ✓ %s%s\n' "$G" "$*" "$X"; }
info(){ printf '  › %s\n' "$*"; }
warn(){ printf '%s  ! %s%s\n' "$Y" "$*" "$X"; }

REPO_URL="https://github.com/AIXMOS537/TMMT.git"
INSTALL_TOOLS=false
PASS=()
for a in "$@"; do case "$a" in
  --install-tools) INSTALL_TOOLS=true;;
  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
  *) PASS+=("$a");;
esac; done

is_repo(){ [ -f "$1/scripts/factory-line.sh" ] && [ -d "$1/.git" ]; }

# 1) Locate the repo: current git toplevel → this script's repo → known paths → clone.
ROOT=""
SELF_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." 2>/dev/null && pwd || true)"
GIT_TOP="$(git rev-parse --show-toplevel 2>/dev/null || true)"
for cand in "$GIT_TOP" "$SELF_ROOT" "${AIXMOS_HOME:-}" "$HOME/Projects/TMMT" "$HOME/TMMT" "$HOME/Documents/TMMT" "$HOME/code/TMMT"; do
  [ -n "$cand" ] && is_repo "$cand" && { ROOT="$cand"; break; }
done

printf '\n%s  🚀 PROJECT X HAILMARY — anywhere%s\n' "$B" "$X"
if [ -z "$ROOT" ]; then
  TARGET="$HOME/Projects/TMMT"
  info "repo not found locally — cloning to $TARGET"
  mkdir -p "$(dirname "$TARGET")"
  git clone "git@github.com:AIXMOS537/TMMT.git" "$TARGET" 2>/dev/null \
    || git clone "$REPO_URL" "$TARGET" 2>/dev/null \
    || { warn "clone failed — check network/access, then: git clone $REPO_URL $TARGET"; exit 1; }
  ROOT="$TARGET"
fi
cd "$ROOT" || { warn "cannot cd into $ROOT"; exit 1; }
ok "repo: $ROOT"

# 2) Pull latest (best-effort; never blocks the run).
git pull --ff-only >/dev/null 2>&1 && ok "pulled latest ($(git rev-parse --short HEAD 2>/dev/null))" || warn "pull skipped (offline or dirty) — using current HEAD"

# 3) Agent toolbelt.
if [ -f scripts/agents-setup.sh ]; then
  if $INSTALL_TOOLS; then bash scripts/agents-setup.sh --install; else bash scripts/agents-setup.sh; fi
fi

# 4) Run the factory line (auto-detects the node if --node not passed).
info "starting the factory line…"
exec bash scripts/factory-line.sh "${PASS[@]}"
