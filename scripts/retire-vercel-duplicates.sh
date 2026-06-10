#!/usr/bin/env bash
# Retire ONLY legacy duplicate Vercel projects for AIXMOS537/TMMT.
#
# KEEP (three separate apps — see docs/THREE-APP-ECOSYSTEM.md):
#   tmmt-ops          → TMMT Ops / TMMT OS
#   tmmt-command-center → owner command center
#   aixmos-landing    → AIXMOS public funnel
#
# RETIRE (legacy duplicates that re-deploy the same repo on every push):
#   tmmt-c919, tmmt
#
# Usage: bash scripts/retire-vercel-duplicates.sh [--apply]

set -euo pipefail

APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true

LEGACY_DUPLICATES=(tmmt-c919 tmmt)
KEEP=(tmmt-ops tmmt-command-center aixmos-landing)

run() {
  if $APPLY; then echo ">> $*"; "$@"; else echo "DRY-RUN: $*"; fi
}

echo "=== Retire legacy Vercel duplicates (NOT the three apps) ==="
echo ""
echo "KEEP these three separate apps:"
for p in "${KEEP[@]}"; do echo "  ✓ $p"; done
echo ""
echo "RETIRE legacy duplicates only:"
for p in "${LEGACY_DUPLICATES[@]}"; do echo "  ✗ $p"; done
echo ""

if ! $APPLY; then
  echo "Dry run. Re-run with: bash scripts/retire-vercel-duplicates.sh --apply"
  echo ""
fi

echo "--- Before deleting tmmt-c919 ---"
echo "1. Vercel → tmmt-c919 → Settings → Environment Variables"
echo "   Copy any vars missing from tmmt-ops / tmmt-command-center / aixmos-landing"
echo "2. Vercel → tmmt-c919 → Settings → Domains"
echo "   Move custom domains to the correct app (see docs/THREE-APP-ECOSYSTEM.md)"
echo "3. Confirm each of the three apps has a successful production deploy on master"
echo ""

echo "--- Delete legacy projects ---"
for p in "${LEGACY_DUPLICATES[@]}"; do
  run vercel project rm "$p" --yes
done

echo ""
echo "--- Verify the three apps ---"
echo "  curl -sS -o /dev/null -w '%{http_code}\\n' https://tmmt-ops.vercel.app/login"
echo "  curl -sS -o /dev/null -w '%{http_code}\\n' https://tmmt-command-center.vercel.app/forms/customer-intake"
echo "  curl -sS -o /dev/null -w '%{http_code}\\n' https://aixmos-landing.vercel.app/"
echo ""
echo "See docs/THREE-APP-ECOSYSTEM.md"
