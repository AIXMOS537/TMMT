#!/usr/bin/env bash
# swarm-join — onboard ANY new device to the TMMT mesh in one command.
# Idempotent and non-destructive. Run it on a brand-new carry Mac, work Mac,
# Surface, etc. It teaches the new machine everything the mesh already knows.
#
#   bash scripts/swarm-join.sh                      # interactive
#   bash scripts/swarm-join.sh --name surface       # non-interactive name
#   bash scripts/swarm-join.sh --name work-mac --email you@work.example
#
# What it does:
#   1) checks tooling for your OS (and tells you what to install)
#   2) sets this machine's UNIQUE mesh name
#   3) sets a per-repo git commit identity (important: your machines are on
#      DIFFERENT accounts — this keeps the audit trail honest)
#   4) installs the secret-guard git hooks
#   5) makes sure .env is present (pulls from the key flashdrive if available)
#   6) installs deps
#   7) registers on the mesh board + runs the security doctor
set -uo pipefail
source "$(dirname "$0")/lib/swarm-common.sh"
cd "$SWARM_ROOT"

NAME=""; EMAIL=""; GITNAME=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)  NAME="${2:-}"; shift 2;;
    --email) EMAIL="${2:-}"; shift 2;;
    --git-name) GITNAME="${2:-}"; shift 2;;
    *) die "unknown arg: $1";;
  esac
done

say "${BOLD}=== Joining the TMMT mesh on $(swarm_os) ===${RST}"

# 1) tooling -------------------------------------------------------------------
miss=0
need() { command -v "$1" >/dev/null 2>&1 || { warn "missing: $1 — $2"; miss=1; }; }
need git   "install git"
need node  "install Node.js LTS (nodejs.org) or nvm"
need npm   "comes with Node.js"
need claude "install the Claude Code CLI and sign in"
if ! command -v tmux >/dev/null 2>&1; then
  case "$(swarm_os)" in
    macos) warn "no tmux — 'brew install tmux' for the best swarm view (optional)";;
    linux|wsl) warn "no tmux — 'sudo apt install tmux' (optional)";;
    windows) command -v wt.exe >/dev/null 2>&1 || warn "install Windows Terminal (Store) so agents open in tabs";;
  esac
fi
[[ $miss -eq 0 ]] && ok "core tooling present" || warn "install the missing tools above, then re-run (continuing setup)"

# 2) machine name --------------------------------------------------------------
if [[ -z "$NAME" ]]; then
  local_default="$(swarm_machine)"
  printf 'Unique name for THIS machine [%s]: ' "$local_default" >&2
  read -r NAME || true
  NAME="${NAME:-$local_default}"
fi
NAME="$(printf '%s' "$NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
mkdir -p "$SWARM_ROOT/.swarm"
printf '%s\n' "$NAME" > "$SWARM_ROOT/.swarm/machine"
ok "machine name: ${BOLD}$NAME${RST}"

# 3) per-repo git identity (DIFFERENT accounts per machine) --------------------
cur_email="$(git config user.email 2>/dev/null || true)"
if [[ -z "$EMAIL" && -z "$cur_email" ]]; then
  printf 'Git email for commits on THIS machine/account (enter to skip): ' >&2
  read -r EMAIL || true
fi
if [[ -n "$EMAIL" ]]; then
  git config user.email "$EMAIL"
  git config user.name "${GITNAME:-$NAME}"
  ok "git identity set for this repo: $(git config user.name) <$(git config user.email)>"
else
  [[ -n "$cur_email" ]] && ok "git identity already set: <$cur_email>" \
    || warn "no git identity set — set it later: git config user.email you@acct"
fi

# 4) secret-guard hooks --------------------------------------------------------
chmod +x "$SWARM_ROOT"/scripts/hooks/* 2>/dev/null || true
git config core.hooksPath scripts/hooks
ok "secret-guard hooks installed (pre-commit + pre-push)"

# 5) .env (secrets ride the key flashdrive, never git) -------------------------
if [[ -f "$SWARM_ROOT/.env" ]]; then
  [[ "$(swarm_os)" != "windows" ]] && chmod 600 "$SWARM_ROOT/.env" 2>/dev/null || true
  ok ".env present"
elif [[ -x "$SWARM_ROOT/scripts/bootstrap-carry-mac.sh" && "$(swarm_os)" == "macos" ]]; then
  warn ".env missing — attempting key-flashdrive bootstrap…"
  bash "$SWARM_ROOT/scripts/bootstrap-carry-mac.sh" || warn "bootstrap didn't complete — plug in the key drive and re-run, or copy .env manually"
else
  warn ".env missing — restore it from your key flashdrive (owner only). Agents can't build without it."
fi

# 6) deps ----------------------------------------------------------------------
if [[ -f package-lock.json ]]; then
  info "installing dependencies (npm ci)…"
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund || warn "dependency install failed — run 'npm install' manually"
else
  npm install --no-audit --no-fund || warn "dependency install failed — run 'npm install' manually"
fi
ok "dependencies installed"

# 7) register + audit ----------------------------------------------------------
info "registering '$NAME' on the mesh…"
SWARM_MACHINE="$NAME" bash "$SWARM_ROOT/scripts/swarm.sh" init "$NAME" || warn "could not register on the mesh (check git write access for THIS account)"
say ""
bash "$SWARM_ROOT/scripts/swarm-doctor.sh" --quick || true

say ""
ok "${BOLD}$NAME is on the mesh.${RST}"
say "See every device:   bash scripts/swarm.sh mesh"
say "Sync:               npm run sync:machine"
say "Run the swarm:      bash scripts/swarm.sh add \"a task\"  &&  bash scripts/swarm.sh up 2"
say "Full guide:         docs/MESH-SWARM.md"
