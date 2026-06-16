#!/usr/bin/env bash
#
# whereami.sh — the unmissable "YOU ARE HERE" banner. Run it anytime (or from
# your shell prompt) so there is NEVER confusion about which checkout, which
# branch, or which environment you're touching.
# ---------------------------------------------------------------------------
#   bash scripts/whereami.sh
# Env is inferred from the branch:  master/main = PROD (red) · staging/test = TEST
# · everything else = DEV (safe to edit).
# ---------------------------------------------------------------------------
set -uo pipefail
red(){ printf "\033[41;97m %s \033[0m\n" "$1"; }
amber(){ printf "\033[43;30m %s \033[0m\n" "$1"; }
green(){ printf "\033[42;30m %s \033[0m\n" "$1"; }
dim(){ printf "\033[2m%s\033[0m\n" "$1"; }

if ! git rev-parse --git-dir >/dev/null 2>&1; then echo "not in a git repo: $(pwd)"; exit 0; fi
ROOT="$(git rev-parse --show-toplevel)"
BR="$(git branch --show-current)"
REMOTE="$(git remote get-url origin 2>/dev/null || echo none)"
DIRTY="$(git status --porcelain | wc -l | tr -d ' ')"

case "$BR" in
  master|main)      ENV="PROD"; BANNER=red;;
  staging|test)     ENV="TEST"; BANNER=amber;;
  *)                ENV="DEV";  BANNER=green;;
esac

echo
$BANNER "ENVIRONMENT: $ENV    branch: $BR"
echo "  path   : $ROOT"
echo "  remote : $REMOTE"
echo "  changes: $([ "$DIRTY" = 0 ] && echo 'clean' || echo "$DIRTY uncommitted")"
echo "$REMOTE" | grep -qiE 'AIXMOS537/TMMT' || amber "  ⚑ remote is NOT your AIXMOS537 GitHub — confirm before pushing"
echo
case "$ENV" in
  PROD) red "  PROD = LIVE. Do NOT edit here. Branch first:  git checkout -b feat/<thing>";;
  TEST) dim "  TEST = shared staging. Safe to verify; promote to PROD only by owner approval.";;
  DEV)  dim "  DEV = your sandbox. Edit freely; run the gate; open a PR to promote.";;
esac
