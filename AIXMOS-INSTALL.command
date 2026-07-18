#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# AIXMOS-INSTALL.command — THE one file. Double-click it on any Mac.
#
# This is the single, canonical entry point. You never need to remember a filename
# again: save THIS to Downloads (or run it from inside the repo) and double-click.
#
#   • Fresh Mac      → installs everything, clones the repo, joins the mesh.
#   • The M1 (Rick)  → also activates the always-on Rick operator.
#   • Any Mac        → safe to re-run anytime; it's idempotent.
#
# Non-interactive / unattended:
#   AIXMOS_ROLE=fresh  bash AIXMOS-INSTALL.command   # full setup only
#   AIXMOS_ROLE=rick   bash AIXMOS-INSTALL.command   # full setup + activate Rick (M1)
# ═══════════════════════════════════════════════════════════════════════════════
set -uo pipefail
cd "$(dirname "$0")" 2>/dev/null || true

REPO_URL="https://github.com/AIXMOS537/TMMT.git"
DEST="${TMMT:-$HOME/Projects/TMMT}"

say(){  printf '%s\n' "$*"; }
ok(){   printf '\033[32m✓\033[0m %s\n' "$*"; }
warn(){ printf '\033[33m!\033[0m %s\n' "$*" >&2; }
step(){ printf '\n\033[1m══ %s ══\033[0m\n' "$*"; }

step "AIXMOS INSTALL — one double-click"
say  "Chip: $(sysctl -n machdep.cpu.brand_string 2>/dev/null || uname -m)"

# ── 1) Locate or clone the repo ────────────────────────────────────────────────
# If we're already sitting inside a TMMT checkout, use it. Otherwise clone to DEST.
if git rev-parse --show-toplevel >/dev/null 2>&1 && \
   git rev-parse --show-toplevel 2>/dev/null | grep -qi TMMT; then
  DEST="$(git rev-parse --show-toplevel)"
  ok "repo found: $DEST"
elif [ -d "$DEST/.git" ]; then
  ok "repo present: $DEST"
else
  step "Cloning TMMT → $DEST"
  mkdir -p "$(dirname "$DEST")"
  if ! git clone "$REPO_URL" "$DEST"; then
    warn "clone failed. Sign in once with 'gh auth login' (or install the GitHub CLI), then double-click me again."
    read -r -p "Press return to close…" _ 2>/dev/null || true
    exit 1
  fi
  ok "cloned"
fi
cd "$DEST" || { warn "cannot enter $DEST"; exit 1; }
git pull --ff-only origin master 2>/dev/null || warn "couldn't fast-forward (local changes?) — continuing with what's here"

# ── 2) Full fresh-Mac setup (idempotent) ───────────────────────────────────────
# Delegates to the maintained installer — no logic duplicated here.
if [ -f scripts/setup-mac.command ]; then
  step "Fresh-Mac setup"
  bash scripts/setup-mac.command || warn "setup finished with warnings (see above)"
else
  warn "scripts/setup-mac.command missing — skipping full setup"
fi

# ── 3) Decide the role: does this machine become the always-on Rick (M1)? ───────
ROLE="${AIXMOS_ROLE:-}"
if [ -z "$ROLE" ]; then
  if [ -t 0 ]; then
    step "Role"
    say  "Is THIS the always-on M1 (Rick), or a regular Mac?"
    say  "  [1] Regular Mac / laptop  — setup only (default)"
    say  "  [2] The M1 — activate always-on Rick operator"
    printf "Choose [1/2]: "
    read -r choice 2>/dev/null || choice=1
    case "$choice" in 2) ROLE=rick;; *) ROLE=fresh;; esac
  else
    ROLE=fresh   # unattended default is SAFE: never turns a box into a daemon by surprise
  fi
fi

# ── 4) Rick activation (M1 only) ───────────────────────────────────────────────
if [ "$ROLE" = "rick" ]; then
  if [ -f scripts/rick-one-shot/ACTIVATE-RICK.command ]; then
    step "Activating Rick (always-on operator)"
    TMMT="$DEST" bash scripts/rick-one-shot/ACTIVATE-RICK.command
  else
    warn "ACTIVATE-RICK.command missing — cannot activate Rick"
  fi
else
  ok "Regular Mac — setup complete, no background daemon installed."
  say "To make THIS the always-on M1 later:  AIXMOS_ROLE=rick bash AIXMOS-INSTALL.command"
fi

step "Done"
ok "This Mac is ready."
say "Control board any time:  cd $DEST && bash scripts/oneshot.sh"
[ -t 0 ] && read -r -p "Press return to close…" _ 2>/dev/null || true
