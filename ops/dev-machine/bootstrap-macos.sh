#!/usr/bin/env bash
# First-time Mac setup: clone TMMT, Node 20, optional Tailscale note.
set -euo pipefail

TMMT_ROOT="${TMMT_ROOT:-$HOME/dev/TMMT}"
GIT_REMOTE="${GIT_REMOTE:-https://github.com/AIXMOS537/TMMT.git}"
GIT_BRANCH="${GIT_BRANCH:-main}"
LEGACY_ROOT="${LEGACY_ROOT:-$HOME/Desktop/AIX_Command_Center/TMMT MANAGEMENT}"

echo "TMMT bootstrap (macOS)"
echo "  clone:  $TMMT_ROOT"
echo "  branch: $GIT_BRANCH"

mkdir -p "$(dirname "$TMMT_ROOT")"

if [[ ! -d "$TMMT_ROOT/.git" ]]; then
  git clone --branch "$GIT_BRANCH" "$GIT_REMOTE" "$TMMT_ROOT"
else
  echo "Already cloned at $TMMT_ROOT"
fi

cd "$TMMT_ROOT"
git fetch origin --prune
git checkout "$GIT_BRANCH"
git pull --ff-only origin "$GIT_BRANCH" || true

# Node 20 via fnm (preferred) or mise
if command -v fnm >/dev/null 2>&1; then
  fnm install 20
  fnm use 20
elif command -v mise >/dev/null 2>&1; then
  mise install
else
  echo "Install fnm or mise, then re-run: https://github.com/Schniz/fnm"
fi

if [[ -f tmmt-os/package-lock.json ]]; then
  (cd tmmt-os && npm ci)
fi

if [[ -d "$LEGACY_ROOT/.git" && "$LEGACY_ROOT" != "$TMMT_ROOT" ]]; then
  echo ""
  echo "Legacy clone detected: $LEGACY_ROOT"
  echo "After verifying $TMMT_ROOT works, archive or remove the Desktop copy."
  echo "  mv \"$LEGACY_ROOT\" \"$HOME/Archive/TMMT-MANAGEMENT-$(date +%Y%m%d)\""
fi

echo ""
echo "Next:"
echo "  1. Copy tmmt-os/.env.local from your other machine (never commit secrets)."
echo "  2. Install Tailscale on both Macs; add SSH key home -> office."
echo "  3. Optional Mac pull: ./ops/dev-machine/install-launchd.sh"
echo "  4. Windows fleet: see ops/dev-machine/FLEET.md"
echo "  5. Open in Cursor: cursor $TMMT_ROOT/tmmt-os"
