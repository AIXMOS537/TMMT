#!/usr/bin/env bash
# Retire the legacy Vercel projects for AIXMOS537/TMMT. ONE app remains.
#
# KEEP:   tmmt-ops  → the one app: ops, owner command center, training, forms
# PUBLIC: allinonemanagementsolutions.com → GHL site (not on Vercel at all)
#
# RETIRE (all four deploy the same repo; every push created a BLOCKED deploy):
#   tmmt-command-center  (May prototype; tree preserved at tag archive/command-center-2026-05-18)
#   aixmos-landing       (static AIXMOS/public — superseded by the GHL site)
#   tmmt-training-site   (never had a production deploy; academy = /learn in tmmt-ops)
#   aixmos-offer         (never had a production deploy)
#
# Harvest of env vars, settings, domains and deployed source was completed
# 2026-09-03 → ~/Archive/vercel-harvest-20260903/ (see docs/THREE-APP-ECOSYSTEM.md).
#
# Usage: bash scripts/retire-vercel-duplicates.sh            # dry run
#        bash scripts/retire-vercel-duplicates.sh --apply    # OWNER ONLY — deletes projects
set -euo pipefail

APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true
SCOPE="${VERCEL_SCOPE:-aixmos537}"

RETIRE=(tmmt-command-center aixmos-landing tmmt-training-site aixmos-offer)
KEEP=tmmt-ops

run() { if $APPLY; then echo ">> $*"; "$@"; else echo "DRY-RUN: $*"; fi; }

echo "=== Retire legacy Vercel projects — ONE app remains ==="
echo "  ✓ keep   $KEEP"
for p in "${RETIRE[@]}"; do echo "  ✗ retire $p"; done
echo

echo "--- Pre-flight: the one app must be healthy before anything is deleted ---"
for u in https://tmmt-ops.vercel.app/login https://tmmt-ops.vercel.app/forms/customer-intake https://tmmt-ops.vercel.app/api/health; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$u" || echo ERR)
  echo "  $u → $code"
  [[ "$code" == "200" ]] || { echo "ABORT: $u is not 200"; exit 1; }
done
[ -d "$HOME/Archive/vercel-harvest-20260903" ] && echo "  harvest present: ~/Archive/vercel-harvest-20260903" || echo "  WARN: harvest folder missing"
echo

if ! $APPLY; then
  echo "Dry run. Deleting projects is irreversible — owner re-runs with: bash scripts/retire-vercel-duplicates.sh --apply"
  echo
fi

for p in "${RETIRE[@]}"; do
  run vercel project rm "$p" --yes --scope "$SCOPE"
done

echo
echo "--- After: optional vanity alias for the academy ---"
echo "  vercel domains add tmmt-academy.vercel.app $KEEP --scope $SCOPE   # freed once tmmt-training-site is gone"
