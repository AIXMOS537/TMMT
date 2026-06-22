#!/usr/bin/env bash
#
# overhaul-deploy.sh — flash-deploy an OVERHAUL build: take a list of parts and
# stand each one up by calling the REAL script it maps to. Like bolting chosen
# parts onto a chassis.
#
# SAFE: dry-run by default (prints the ordered plan, changes nothing). --apply
# runs it. Owner-only parts require the Owner Seal.
#
# Usage:
#   bash scripts/overhaul-deploy.sh --tier host --parts "local-llm,brain-db" --dry-run
#   bash scripts/overhaul-deploy.sh --callsign nightwing --tier agency \
#        --model vp-rentals --parts "node-bootstrap,mesh-join,local-llm,brain-db" --apply
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
CALLSIGN="operator"; TIER="taste"; MODEL="custom"; PARTS=""; APPLY=0; SEAL=""
while [ $# -gt 0 ]; do case "$1" in
  --callsign) CALLSIGN="${2:-}"; shift 2;;
  --tier) TIER="${2:-}"; shift 2;;
  --model) MODEL="${2:-}"; shift 2;;
  --parts) PARTS="${2:-}"; shift 2;;
  --owner-seal) SEAL="${2:-}"; shift 2;;
  --apply) APPLY=1; shift;;
  --dry-run) APPLY=0; shift;;
  *) echo "unknown arg: $1" >&2; shift;;
esac; done

say(){ printf '\033[1;36m▸ %s\033[0m\n' "$*"; }
warn(){ printf '\033[1;33m! %s\033[0m\n' "$*"; }
plan(){ printf '  \033[1;32m✓\033[0m %-16s → %s\n' "$1" "$2"; }
skip(){ printf '  \033[1;33m·\033[0m %-16s → %s\n' "$1" "$2"; }

[ -n "$PARTS" ] || { echo "Need --parts \"a,b,c\""; exit 2; }

# part id -> the real command that stands it up. "TODO:" = not yet ported.
cmd_for(){ case "$1" in
  node-bootstrap) echo "bash scripts/setup-mac.command";;
  mesh-join)      echo "tailscale up";;
  local-llm)      echo "bash scripts/setup-llm.sh";;
  brain-db)       echo "bash scripts/seal-brain-local.sh --apply";;
  brain-backup)   echo "launchctl bootstrap gui/\$(id -u) ~/Library/LaunchAgents/com.aixmos.hailmary.backup.plist";;
  aixmos-agents)  echo "bash scripts/aixmos.sh up";;
  hailmary-proxy) echo "bash bin/cyborg-go";;
  tmmt-admin)     echo "npm run build && npm run start";;
  mission-control)echo "bash scripts/home";;
  filevault)      echo "fdesetup status   # verify only; enabling needs owner yes";;
  secret-guard)   echo "git config core.hooksPath scripts/hooks";;
  godark)         echo "bash scripts/godark status";;
  watchtower)     echo "bash scripts/watchtower";;
  sentry)         echo "echo set NEXT_PUBLIC_SENTRY_DSN to activate";;
  mesh-sync)      echo "bash scripts/sync-machine.sh";;
  shared-brain)   echo "bash scripts/seal-brain-local.sh --apply   # both businesses write one memory fabric";;
  ghl-bridge)     echo "echo GHL bridge — run discovery first (which objects/direction/source-of-truth), then node scripts/ghl-sync-vercel-env.mjs";;
  cross-org)      echo "echo cross-org tenancy — apply multitenant_hardening + org_scoped_reads migrations";;
  provider-ollama)echo "bash scripts/setup-llm.sh";;
  provider-byok)  echo "echo add a scoped, rotatable key to .env (never reuse found keys)";;
  vp-overdrive) echo "echo Operation Overdrive (planned) — see docs/OPERATION-OVERDRIVE.md";;
  vp-rentals|vp-credit|vp-ecom) echo "echo vertical pack '$1' — see docs/OFFER-STACK.md";;
  clean-ui|superwhisper|openclaw) echo "TODO: port from MoeLegacy — see docs/OVERHAUL-CONFIGURATOR-BLUEPRINT.md";;
  *) echo "TODO: unknown part '$1'";;
esac; }

owner_only(){ case "$1" in hailmary-proxy) return 0;; *) return 1;; esac; }

echo "=== OVERHAUL build  ·  callsign=$CALLSIGN  tier=$TIER  model=$MODEL  apply=$([ $APPLY = 1 ] && echo YES || echo no) ==="
IFS=','; read -ra LIST <<< "$PARTS"; unset IFS

# Owner-seal gate
NEED_SEAL=0
for p in "${LIST[@]}"; do owner_only "$p" && NEED_SEAL=1; done
if [ "$NEED_SEAL" = 1 ]; then
  if [ -n "$SEAL" ] && [ -f "$REPO/$SEAL" ]; then say "Owner Seal present: $SEAL";
  else warn "Owner-only part selected but no valid --owner-seal → those parts will be SKIPPED."; fi
fi

echo "Plan:"
for p in "${LIST[@]}"; do
  p="$(echo "$p" | xargs)"; [ -n "$p" ] || continue
  c="$(cmd_for "$p")"
  if owner_only "$p" && { [ -z "$SEAL" ] || [ ! -f "$REPO/$SEAL" ]; }; then skip "$p" "OWNER-ONLY (sealed) — skipped"; continue; fi
  case "$c" in TODO:*) skip "$p" "$c";; *) plan "$p" "$c";; esac
done

if [ "$APPLY" != 1 ]; then
  echo; echo "Dry run. Re-run with --apply to build it. (Risky/owner steps still gate.)"
  exit 0
fi

echo; say "Applying…"
cd "$REPO"
for p in "${LIST[@]}"; do
  p="$(echo "$p" | xargs)"; [ -n "$p" ] || continue
  c="$(cmd_for "$p")"
  case "$c" in TODO:*) skip "$p" "$c"; continue;; esac
  if owner_only "$p" && { [ -z "$SEAL" ] || [ ! -f "$REPO/$SEAL" ]; }; then skip "$p" "owner-sealed — skipped"; continue; fi
  say "[$p] $c"
  bash -c "$c" || warn "[$p] returned non-zero — review above"
done
say "Build complete for $CALLSIGN."
