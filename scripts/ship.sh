#!/usr/bin/env bash
# ship — the ONLY blessed way to put the app live.
#
# It runs the full local gate (scripts/verify.sh) FIRST. If anything fails, it
# refuses to deploy — full stop. No more broken deploys in front of the team,
# investors, or clients. Only a green local checkout can ever become live.
#
#   bash scripts/ship.sh           # verify, confirm, deploy production
#   bash scripts/ship.sh --yes     # skip the confirm prompt (still verifies)
#
# Vercel git auto-deploy is OFF (vercel.json deploymentEnabled:false), so this
# is the deliberate, gated path to production.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
if [ -t 1 ]; then G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; B=$'\e[1m'; X=$'\e[0m'; else G=; R=; Y=; B=; X=; fi
say(){ printf '%s\n' "$*"; }
die(){ printf '%s✗ %s%s\n' "$R$B" "$*" "$X" >&2; exit 1; }

AUTO=0; [ "${1:-}" = "--yes" ] && AUTO=1

# 1) Branch sanity — production should ship from master, fully in sync.
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
if [ "$branch" != "master" ]; then
  say "${Y}! You're on '$branch', not 'master'. Production normally ships from master.${X}"
  [ "$AUTO" = "1" ] || { printf '  Continue shipping from %s anyway? [y/N] ' "$branch"; read -r a || true; case "$a" in y|Y) ;; *) die "aborted (switch to master first).";; esac; }
fi
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  die "working tree is dirty — commit or stash first so live == what you tested."
fi

# 2) THE GATE — verify locally. No green, no deploy.
say "${B}Running the local-first gate before anything goes live…${X}"
bash "$ROOT/scripts/verify.sh" || die "verification failed — NOT deploying."

# 3) Confirm, then deploy.
say ""
say "${G}${B}✓ Verified.${X} Ready to deploy ${B}production${X} (tmmt-ops)."
if [ "$AUTO" != "1" ]; then
  printf '  Deploy to PRODUCTION now? [y/N] '; read -r a || true; case "$a" in y|Y) ;; *) say "  held — nothing deployed."; exit 0;; esac
fi
command -v vercel >/dev/null 2>&1 || die "Vercel CLI not found — install: npm i -g vercel && vercel login"
say "${B}Deploying…${X}"
vercel --prod --yes || die "vercel deploy failed"
say "${G}${B}✓ Live.${X} Verify it: bash scripts/smoke-prod.sh"
